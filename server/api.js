import { z } from 'zod';
import { accountLinks, getChatGPTUser } from './auth.js';
import { actorFor, database, hash, portalData, token } from './data.js';
import { demoData } from './demo.js';
import { liveFeatureEnabled, liveHandlers } from './live/index.js';

const id = z.string().min(1).max(100);
const shortText = z.string().trim().min(1).max(180);
const content = z.string().trim().min(1).max(15000);
const level = z.enum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const secureUrl = z.string().trim().max(2000).refine(value => {
  if (!value) return true;
  try {
    return new URL(value).protocol === 'https:' && /^https:\/\//i.test(value);
  } catch {
    return false;
  }
}, 'HTTPS keçidi daxil edin.');

const schemas = {
  activate: z.object({ code: z.string().trim().min(12).max(200), name: shortText }),
  join: z.object({ code: z.string().trim().min(20).max(200) }),
  save_student: z.object({
    id: id.optional(),
    name: shortText,
    email: z.string().trim().email().max(254),
    level,
    goal: z.string().trim().max(500),
    progress: z.number().int().min(0).max(100),
  }),
  invite: z.object({ id }),
  save_lesson: z.object({
    id: id.optional(),
    student_id: id.optional(),
    student_ids: z.array(id).min(1).max(5).optional(),
    title: shortText,
    starts_at: z.string().datetime(),
    duration: z.number().int().min(15).max(240),
    meeting_url: secureUrl,
    meeting_type: z.enum(['external', 'live']).optional(),
  }).refine(values => values.student_ids || values.student_id, {
    path: ['student_ids'],
    message: 'Ən azı bir tələbə seçin.',
  }),
  lesson_status: z.object({ id, status: z.enum(['completed', 'cancelled']) }),
  save_payment: z.object({
    student_id: id,
    title: shortText,
    amount: z.number().int().min(1).max(100000000),
    due_date: z.string().date(),
  }),
  payment_status: z.object({ id, status: z.enum(['paid', 'pending']) }),
  save_material: z.object({
    id: id.optional(),
    title: shortText,
    category: z.enum(['Danışıq', 'Qrammatika', 'Tələffüz', 'Lüğət', 'Oxu']),
    level,
    body: content,
    url: secureUrl,
  }),
  save_post: z.object({
    id: id.optional(),
    title: shortText,
    body: content,
    category: z.enum(['Elan', 'Məsləhət', 'Yenilik']),
  }),
  delete: z.object({ id, entity: z.enum(['students', 'materials', 'posts', 'payments']) }),
  send_message: z.object({ student_id: id, body: content.max(4000) }),
  read_messages: z.object({ student_id: id }),
};

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', ...headers } });
}

function requireUser(request, message) {
  const user = getChatGPTUser(request);
  if (!user) throw new AppError(message, 401);
  return user;
}

async function requireStudent(db, studentId) {
  const student = await db.prepare('SELECT id FROM students WHERE id = ?').bind(studentId).first();
  if (!student) throw new AppError('Tələbə tapılmadı.', 404);
}

async function update(db, sql, ...values) {
  const result = await db.prepare(sql).bind(...values).run();
  if (!result.meta.changes) throw new AppError('Qeyd tapılmadı.', 404);
}

async function session(request, env, params) {
  const identity = getChatGPTUser(request);
  const user = identity ? { displayName: identity.displayName, email: identity.email } : null;
  const demo = params.get('demo');
  let data = null;

  if (params.get('account') !== '1') {
    if (identity && !demo) {
      const db = database(env);
      const actor = await actorFor(db, identity);
      if (actor) data = await portalData(db, actor, liveFeatureEnabled(env));
    }
    data ??= demoData(demo === 'student' ? 'student' : 'tutor');
  }

  return json({ data, user, ...accountLinks(params.get('invite'), params.get('return_to')) });
}

async function activate(db, env, user, values) {
  if (!env.TUTOR_SETUP_TOKEN) throw new AppError('Aktivləşdirmə hələ hazır deyil.', 503);

  const [given, expected] = await Promise.all([hash(values.code), hash(env.TUTOR_SETUP_TOKEN)]);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  if (difference) throw new AppError('Aktivləşdirmə kodu düzgün deyil.', 403);

  const result = await db.prepare('INSERT OR IGNORE INTO settings (id, owner_id, tutor_name) VALUES (1, ?, ?)')
    .bind(user.userId, values.name).run();
  if (!result.meta.changes) throw new AppError('Müəllim hesabı artıq aktivləşdirilib.', 409);
}

async function join(db, user, values, now) {
  if (await actorFor(db, user)) throw new AppError('Hesabınız artıq portala bağlıdır.', 409);
  const result = await db.prepare(`
    UPDATE students SET user_id = ?, invite_hash = NULL, invite_expires = NULL
    WHERE invite_hash = ? AND user_id IS NULL AND invite_expires > ?
      AND NOT EXISTS (SELECT 1 FROM students WHERE user_id = ?)
  `).bind(user.userId, await hash(values.code), now, user.userId).run();
  if (!result.meta.changes) throw new AppError('Dəvət etibarsızdır və ya vaxtı bitib. Müəlliminizdən yeni dəvət istəyin.');
}

async function saveLesson(db, values, recordId, liveEnabled) {
  const studentIds = [...new Set(values.student_ids ?? [values.student_id])];
  const placeholders = studentIds.map(() => '?').join(', ');
  const { results: students } = await db.prepare(`SELECT id FROM students WHERE id IN (${placeholders})`)
    .bind(...studentIds).all();
  if (students.length !== studentIds.length) throw new AppError('Tələbə tapılmadı.', 404);

  const existing = values.id
    ? await db.prepare('SELECT meeting_type FROM lessons WHERE id = ?').bind(recordId).first()
    : null;
  if (values.id && !existing) throw new AppError('Qeyd tapılmadı.', 404);

  const meetingType = values.meeting_type ?? (values.meeting_url ? 'external' : existing?.meeting_type ?? (liveEnabled ? 'live' : 'external'));
  if (meetingType === 'live' && !liveEnabled && existing?.meeting_type !== 'live') {
    throw new AppError('Canlı dərslər hələ aktiv deyil.', 409);
  }
  const writeId = crypto.randomUUID();
  const end = new Date(Date.parse(values.starts_at) + values.duration * 60000).toISOString();
  const openSlot = `NOT EXISTS (
    SELECT 1 FROM lessons WHERE status = 'scheduled' AND id != ?
      AND julianday(starts_at) < julianday(?)
      AND julianday(starts_at, '+' || duration || ' minutes') > julianday(?)
  )`;
  const fields = [values.title, values.starts_at, values.duration, meetingType === 'external' ? values.meeting_url : '', meetingType, writeId];
  const range = [recordId, end, values.starts_at];

  const write = values.id
    ? db.prepare(`
        UPDATE lessons SET title = ?, starts_at = ?, duration = ?, meeting_url = ?, meeting_type = ?, schedule_write_id = ?
        WHERE id = ? AND ${openSlot}
        AND NOT EXISTS (SELECT 1 FROM live_rooms WHERE lesson_id = lessons.id)
      `).bind(...fields, recordId, ...range)
    : db.prepare(`
        INSERT INTO lessons (id, title, starts_at, duration, meeting_url, meeting_type, schedule_write_id, status)
        SELECT ?, ?, ?, ?, ?, ?, ?, 'scheduled' WHERE ${openSlot}
      `).bind(recordId, ...fields, ...range);

  // D1 runs the batch in one transaction. An overlap can make the first statement
  // a no-op, so the roster changes only if this exact schedule write succeeded.
  const written = 'EXISTS (SELECT 1 FROM lessons WHERE id = ? AND schedule_write_id = ?)';
  const [result] = await db.batch([
    write,
    db.prepare(`DELETE FROM lesson_students WHERE lesson_id = ? AND ${written}`)
      .bind(recordId, recordId, writeId),
    ...studentIds.map(studentId => db.prepare(`
        INSERT INTO lesson_students (lesson_id, student_id) SELECT ?, ? WHERE ${written}
      `).bind(recordId, studentId, recordId, writeId)),
  ]);

  if (!result.meta.changes) {
    if (values.id && !await db.prepare('SELECT id FROM lessons WHERE id = ?').bind(recordId).first()) {
      throw new AppError('Qeyd tapılmadı.', 404);
    }
    if (values.id && await db.prepare('SELECT 1 FROM live_rooms WHERE lesson_id = ?').bind(recordId).first()) {
      throw new AppError('Canlı dərs başladıqdan sonra cədvəli dəyişmək mümkün deyil.', 409);
    }
    throw new AppError('Bu vaxtda başqa dərsiniz var. Fərqli vaxt seçin.', 409);
  }
}

async function deleteStudent(db, studentId) {
  const hasActiveRoom = `EXISTS (
    SELECT 1 FROM lesson_students ls JOIN live_rooms r ON r.lesson_id = ls.lesson_id
    WHERE ls.student_id = ? AND r.state IN ('starting', 'live', 'ending')
  )`;
  const [, deleted] = await db.batch([
    db.prepare(`
      UPDATE lessons SET status = 'cancelled' WHERE status = 'scheduled'
        AND EXISTS (SELECT 1 FROM lesson_students WHERE lesson_id = lessons.id AND student_id = ?)
        AND NOT EXISTS (SELECT 1 FROM lesson_students WHERE lesson_id = lessons.id AND student_id != ?)
        AND NOT ${hasActiveRoom}
    `).bind(studentId, studentId, studentId),
    db.prepare(`DELETE FROM students WHERE id = ? AND NOT ${hasActiveRoom}`).bind(studentId, studentId),
  ]);
  if (!deleted.meta.changes) {
    if (await db.prepare(`SELECT 1 WHERE ${hasActiveRoom}`).bind(studentId).first()) {
      throw new AppError('Tələbəni silməzdən əvvəl canlı dərsi bitirin.', 409);
    }
    throw new AppError('Qeyd tapılmadı.', 404);
  }
}

async function postPortal(request, env, origin, context) {
  if (request.headers.get('origin') !== origin) throw new AppError('Sorğuya icazə verilmir.', 403);
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') throw new AppError('JSON gözlənilir.', 415);
  if (Number(request.headers.get('content-length')) > 120000) throw new AppError('Məlumat çox uzundur.', 413);

  const raw = await request.text();
  if (raw.length > 30000) throw new AppError('Məlumat çox uzundur.', 413);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new AppError('Sorğu düzgün deyil.');
  }

  const action = z.string().parse(input?.action);
  const user = requireUser(request, 'Əvvəlcə hesabınıza daxil olun.');
  if (!Object.hasOwn(schemas, action)) throw new AppError('Naməlum əməliyyat.');
  const db = database(env);
  const now = new Date().toISOString();

  if (action === 'activate') {
    await activate(db, env, user, schemas.activate.parse(input));
    return json({ ok: true });
  }
  if (action === 'join') {
    await join(db, user, schemas.join.parse(input), now);
    return json({ ok: true });
  }

  const actor = await actorFor(db, user);
  if (!actor) throw new AppError('Bu portala girişiniz yoxdur.', 403);
  const messageAction = action === 'send_message' || action === 'read_messages';
  if (!messageAction && actor.role !== 'tutor') throw new AppError('Bu əməliyyat yalnız müəllim üçündür.', 403);

  const values = schemas[action].parse(input);
  if (messageAction && actor.role === 'student' && actor.studentId !== values.student_id) {
    throw new AppError(action === 'read_messages' ? 'İcazə verilmir.' : 'Bu söhbətə girişiniz yoxdur.', 403);
  }
  const recordId = values.id ?? crypto.randomUUID();

  switch (action) {
    case 'save_student': {
      const fields = [values.name, values.email, values.level, values.goal, values.progress];
      if (values.id) {
        await update(db, 'UPDATE students SET name = ?, email = ?, level = ?, goal = ?, progress = ? WHERE id = ?', ...fields, recordId);
      } else {
        await db.prepare('INSERT INTO students (id, name, email, level, goal, progress, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(recordId, ...fields, now).run();
      }
      break;
    }
    case 'invite': {
      const code = token();
      const expires = new Date(Date.now() + 7 * 86400000).toISOString();
      await update(db, 'UPDATE students SET invite_hash = ?, invite_expires = ? WHERE id = ? AND user_id IS NULL', await hash(code), expires, recordId);
      return json({ ok: true, code, expires });
    }
    case 'save_lesson':
      await saveLesson(db, values, recordId, liveFeatureEnabled(env));
      break;
    case 'lesson_status': {
      await update(db, 'UPDATE lessons SET status = ? WHERE id = ?', values.status, recordId);
      if (await db.prepare("SELECT 1 FROM live_rooms WHERE lesson_id = ? AND state != 'ended'").bind(recordId).first()) {
        const cleanup = liveHandlers.scheduled(env);
        if (context?.waitUntil) context.waitUntil(cleanup);
        else await cleanup;
      }
      break;
    }
    case 'save_payment':
      await requireStudent(db, values.student_id);
      await db.prepare("INSERT INTO payments (id, student_id, title, amount, due_date, status) VALUES (?, ?, ?, ?, ?, 'pending')")
        .bind(recordId, values.student_id, values.title, values.amount, values.due_date).run();
      break;
    case 'payment_status':
      await update(db, 'UPDATE payments SET status = ?, paid_at = ? WHERE id = ?', values.status, values.status === 'paid' ? now : null, recordId);
      break;
    case 'save_material': {
      const fields = [values.title, values.category, values.level, values.body, values.url];
      if (values.id) {
        await update(db, 'UPDATE materials SET title = ?, category = ?, level = ?, body = ?, url = ? WHERE id = ?', ...fields, recordId);
      } else {
        await db.prepare('INSERT INTO materials (id, title, category, level, body, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(recordId, ...fields, now).run();
      }
      break;
    }
    case 'save_post': {
      const fields = [values.title, values.body, values.category];
      if (values.id) {
        await update(db, 'UPDATE posts SET title = ?, body = ?, category = ? WHERE id = ?', ...fields, recordId);
      } else {
        await db.prepare('INSERT INTO posts (id, title, body, category, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(recordId, ...fields, now).run();
      }
      break;
    }
    case 'delete':
      if (values.entity === 'students') await deleteStudent(db, recordId);
      else await update(db, `DELETE FROM ${values.entity} WHERE id = ?`, recordId);
      break;
    case 'send_message':
      await requireStudent(db, values.student_id);
      await db.prepare('INSERT INTO messages (id, student_id, sender_role, body, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(recordId, values.student_id, actor.role, values.body, now).run();
      break;
    case 'read_messages':
      await db.prepare('UPDATE messages SET read_at = ? WHERE student_id = ? AND sender_role != ? AND read_at IS NULL')
        .bind(now, values.student_id, actor.role).run();
      break;
  }
  return json({ ok: true, id: recordId });
}

export async function handleApi(request, env, context) {
  const { pathname, origin, searchParams } = new URL(request.url);
  if (pathname !== '/api/session' && pathname !== '/api/portal') return null;

  try {
    if (request.method === 'GET') {
      if (pathname === '/api/session') return await session(request, env, searchParams);

      const user = requireUser(request, 'Daxil olun.');
      const db = database(env);
      const actor = await actorFor(db, user);
      if (!actor) throw new AppError('Hesabınıza giriş hələ verilməyib.', 403);
      return json(await portalData(db, actor, liveFeatureEnabled(env)));
    }
    if (request.method === 'POST' && pathname === '/api/portal') return await postPortal(request, env, origin, context);
    return json({ error: 'Sorğu metoduna icazə verilmir.' }, 405, { Allow: pathname === '/api/session' ? 'GET' : 'GET, POST' });
  } catch (error) {
    if (error instanceof AppError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => issue.path.join('.') + ': ' + issue.message).join(', ');
      return json({ error: 'Məlumatları yoxlayın: ' + issues }, 400);
    }
    console.error('Portal request failed', error);
    return json({ error: 'Hazırda məlumatı yükləmək və ya saxlamaq mümkün deyil. Yenidən cəhd edin.' }, 503);
  }
}
