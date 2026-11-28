import { getChatGPTUser } from '../auth.js';
import { actorFor, database, lessonForActor } from '../data.js';
import zoom from './providers/zoom.js';

const providers = { zoom };
const minute = 60_000;
const lessonRoute = /^\/api\/lessons\/([\w-]{1,100})\/live(?:\/(start|join|end))?$/;
const eventRoute = /^\/api\/lessons\/live\/events\/([\w-]+)$/;

function providerFor(registry, id) {
  return Object.hasOwn(registry, id) ? registry[id] : undefined;
}

function configuredProvider(env, registry) {
  const provider = providerFor(registry, env.LIVE_LESSON_PROVIDER || 'zoom');
  return env.LIVE_LESSONS_ENABLED === 'true' && provider?.isConfigured(env) ? provider : null;
}

export function liveFeatureEnabled(env) {
  return Boolean(configuredProvider(env, providers));
}

function response(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function error(status, message) {
  return response({ error: message }, status);
}

function findRoom(db, lessonId) {
  return db.prepare('SELECT * FROM live_rooms WHERE lesson_id = ?').bind(lessonId).first();
}

function roomStatus(lesson, room, actor, now, enabled) {
  const startsAt = Date.parse(lesson.starts_at);
  const endsAt = startsAt + lesson.duration * minute;
  const inPreview = now >= startsAt - 10 * minute;
  const upcoming = !room && now < endsAt;
  const open = room && now < Date.parse(room.closes_at) && ['starting', 'live'].includes(room.state);
  const tutor = actor.role === 'tutor';

  let state = 'ended';
  if (!enabled || lesson.meeting_type !== 'live') state = 'unavailable';
  else if (lesson.status === 'cancelled') state = 'cancelled';
  else if (room?.state === 'ending') state = 'ending';
  else if (lesson.status === 'scheduled' && open) state = room.state;
  else if (lesson.status === 'scheduled' && upcoming) state = inPreview ? 'waiting' : 'scheduled';

  const active = state === 'live' || state === 'starting';
  return {
    state,
    role: actor.role,
    title: lesson.title,
    canPreview: state === 'waiting' || active,
    canStart: tutor && state === 'waiting',
    canJoin: state === 'live' || (tutor && state === 'starting'),
    canEnd: tutor && active,
  };
}

function queueCleanup(db, roomKey, sessionId, now) {
  return db.prepare('INSERT OR IGNORE INTO live_room_cleanup (room_key, session_id, retry_at) VALUES (?, ?, ?)')
    .bind(roomKey, sessionId, now);
}

async function sweep(db, env, registry, now = new Date().toISOString()) {
  await db.batch([
    db.prepare(`UPDATE live_rooms SET state = 'ending' WHERE state IN ('starting', 'live')
      AND (closes_at <= ? OR lesson_id IN (SELECT id FROM lessons WHERE status != 'scheduled'))`).bind(now),
    db.prepare(`INSERT OR IGNORE INTO live_room_cleanup (room_key, session_id, retry_at)
      SELECT room_key, session_id, ? FROM live_rooms WHERE state = 'ending' AND session_id IS NOT NULL`).bind(now),
    db.prepare("UPDATE live_rooms SET state = 'ended' WHERE state = 'ending' AND session_id IS NULL"),
  ]);

  const { results } = await db.prepare(`SELECT q.*, r.provider FROM live_room_cleanup q
    JOIN live_rooms r ON r.room_key = q.room_key WHERE q.retry_at <= ? ORDER BY q.retry_at LIMIT 30`)
    .bind(now).all();
  await Promise.all(results.map(async job => {
    const adapter = providerFor(registry, job.provider);
    if (!adapter?.isConfigured(env)) return;
    const retryAt = new Date(Date.parse(now) + Math.min(2 ** job.attempts, 30) * minute).toISOString();
    const claim = await db.prepare(`UPDATE live_room_cleanup SET attempts = attempts + 1, retry_at = ?
      WHERE room_key = ? AND session_id = ? AND retry_at = ?`)
      .bind(retryAt, job.room_key, job.session_id, job.retry_at).run();
    if (!claim.meta.changes) return;
    try {
      await adapter.endSession({ env, sessionId: job.session_id });
      await db.batch([
        db.prepare("UPDATE live_rooms SET state = 'ended' WHERE room_key = ? AND state = 'ending' AND session_id = ?")
          .bind(job.room_key, job.session_id),
        db.prepare('DELETE FROM live_room_cleanup WHERE room_key = ? AND session_id = ?').bind(job.room_key, job.session_id),
      ]);
    } catch {
      console.warn('Live session cleanup will retry', { provider: job.provider, attempts: job.attempts + 1 });
    }
  }));
}

async function handleEvent(request, env, provider, registry) {
  if (request.method !== 'POST') return error(405, 'Sorğu metoduna icazə verilmir.');
  if (!provider?.isConfigured(env)) return error(404, 'Sorğu tapılmadı.');
  const event = await provider.parseEvent({ request, env });
  if (event instanceof Response) return event;
  if (!event) return response({ ok: true });
  const db = database(env);
  const room = await db.prepare('SELECT * FROM live_rooms WHERE room_key = ? AND provider = ?')
    .bind(event.roomKey, provider.id).first();
  if (!room) return response({ ok: true });
  const now = new Date().toISOString();
  if (event.type === 'started') {
    const opened = await db.prepare(`UPDATE live_rooms SET state = 'live', session_id = ?
      WHERE room_key = ? AND state = 'starting' AND closes_at > ?
      AND lesson_id IN (SELECT id FROM lessons WHERE status = 'scheduled')`)
      .bind(event.sessionId, room.room_key, now).run();
    if (!opened.meta.changes) {
      const current = await findRoom(db, room.lesson_id);
      if (current?.state !== 'live' || current.session_id !== event.sessionId) {
        await queueCleanup(db, room.room_key, event.sessionId, now).run();
        await sweep(db, env, registry, now);
      }
    }
  } else if (event.type === 'ended') {
    await db.batch([
      db.prepare(`UPDATE live_rooms SET state = 'ended', session_id = ?
        WHERE room_key = ? AND (session_id = ? OR (state = 'starting' AND session_id IS NULL))`)
        .bind(event.sessionId, room.room_key, event.sessionId),
      db.prepare('DELETE FROM live_room_cleanup WHERE room_key = ? AND session_id = ?')
        .bind(room.room_key, event.sessionId),
    ]);
  }
  return response({ ok: true });
}

export function createLiveHandlers(registry = providers) {
  return {
    async fetch(request, env, context) {
      const { pathname, origin } = new URL(request.url);
      const eventMatch = eventRoute.exec(pathname);
      const match = lessonRoute.exec(pathname);
      if (!match && !eventMatch) return null;

      try {
        if (eventMatch) return await handleEvent(request, env, providerFor(registry, eventMatch[1]), registry);
        const [, lessonId, action] = match;
        if (request.method !== (action ? 'POST' : 'GET')) return error(405, 'Sorğu metoduna icazə verilmir.');
        if (action && request.headers.get('Origin') !== origin) return error(403, 'Sorğuya icazə verilmir.');

        const user = getChatGPTUser(request);
        if (!user) return error(401, 'Daxil olun.');
        const db = database(env);
        const actor = await actorFor(db, user);
        if (!actor) return error(403, 'Hesabınıza giriş hələ verilməyib.');
        const lesson = await lessonForActor(db, actor, lessonId);
        if (!lesson) return error(404, 'Dərs tapılmadı.');

        const selected = configuredProvider(env, registry);
        let room = await findRoom(db, lessonId);
        const now = new Date();
        const enabled = Boolean(selected);
        const status = roomStatus(lesson, room, actor, now.getTime(), enabled);
        if (!action) return response(status);
        if (!enabled && action !== 'end') return error(503, 'Canlı dərs hazırda əlçatan deyil.');
        if (action !== 'join' && actor.role !== 'tutor') return error(403, 'Sorğuya icazə verilmir.');

        if (action === 'start') {
          if (status.state === 'starting' || status.state === 'live') return response(status);
          if (!status.canStart) return error(409, 'Dərsi başlatmaq mümkün deyil.');
          const closesAt = new Date(Date.parse(lesson.starts_at) + (lesson.duration + 15) * minute).toISOString();
          await db.prepare(`INSERT OR IGNORE INTO live_rooms (lesson_id, provider, room_key, state, closes_at)
            SELECT id, ?, ?, 'starting', ? FROM lessons WHERE id = ? AND meeting_type = 'live'
            AND status = 'scheduled' AND starts_at = ? AND duration = ?
            AND EXISTS (SELECT 1 FROM lesson_students WHERE lesson_id = lessons.id)`)
            .bind(selected.id, crypto.randomUUID(), closesAt, lessonId, lesson.starts_at, lesson.duration).run();
          room = await findRoom(db, lessonId);
          if (!room) return error(409, 'Dərs dəyişib. Yenidən cəhd edin.');
          return response(roomStatus(lesson, room, actor, now.getTime(), enabled));
        }

        if (action === 'end') {
          if (!room) return error(409, 'Dərs başlamayıb.');
          await db.prepare("UPDATE live_rooms SET state = 'ending' WHERE lesson_id = ? AND state IN ('starting', 'live')")
            .bind(lessonId).run();
          const cleanup = sweep(db, env, registry);
          if (context?.waitUntil) context.waitUntil(cleanup);
          else await cleanup;
          return response(roomStatus(lesson, await findRoom(db, lessonId), actor, now.getTime(), true));
        }

        if (!status.canJoin) return error(409, 'Dərsə hələ qoşulmaq mümkün deyil.');
        const provider = providerFor(registry, room.provider);
        if (!provider?.isConfigured(env)) return error(503, 'Canlı dərs hazırda əlçatan deyil.');
        const credentials = await provider.issueJoinCredentials({ env, room, role: actor.role, actor });
        const latestLesson = await lessonForActor(db, actor, lessonId);
        const latestRoom = await findRoom(db, lessonId);
        if (!latestLesson || !roomStatus(latestLesson, latestRoom, actor, Date.now(), enabled).canJoin) {
          return error(409, 'Dərsə artıq qoşulmaq mümkün deyil.');
        }
        return response({ provider: room.provider, credentials });
      } catch {
        console.error('Live classroom request failed', { event: Boolean(eventMatch) });
        return error(503, 'Canlı dərs hazırda əlçatan deyil. Yenidən cəhd edin.');
      }
    },
    scheduled(env) {
      return sweep(database(env), env, registry);
    },
  };
}

export const liveHandlers = createLiveHandlers();
