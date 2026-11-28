import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { createLiveHandlers } from "../server/live/index.js";
const serverRoot = new URL("../dist/server/", import.meta.url).pathname;
const paths = (await readdir(serverRoot, { recursive: true }))
  .filter((p) => p.endsWith(".js"))
  .sort((a, b) =>
    a === "index.js" ? -1 : b === "index.js" ? 1 : a.localeCompare(b),
  );
const mf = new Miniflare({
  modules: paths.map((p) => ({ type: "ESModule", path: serverRoot + p })),
  modulesRoot: serverRoot,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  bindings: { TUTOR_SETUP_TOKEN: "local-test-owner-token-123456789" },
  cf: false,
});
const db = await mf.getD1Database("DB");
try {
  const migrations = new URL("../drizzle/", import.meta.url);
  const applyMigration = async (file) => {
    const sql = await readFile(new URL(file, migrations), "utf8");
    await db.batch(sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)
      .map(statement => db.prepare(statement)));
  };
  const files = (await readdir(migrations)).filter(file => file.endsWith(".sql")).sort();
  await applyMigration(files[0]);
  await db.batch([
    db.prepare("INSERT INTO students (id, name, email, level, goal, created_at) VALUES ('legacy-student', 'Legacy', 'legacy@example.test', 'A1', '', '2020-01-01')"),
    db.prepare("INSERT INTO lessons (id, student_id, title, starts_at, duration, meeting_url) VALUES ('legacy-lesson', 'legacy-student', 'Legacy', '2020-01-01', 60, 'https://example.com/legacy')"),
  ]);
  for (const file of files.slice(1)) await applyMigration(file);
  const migrated = await db.prepare("SELECT l.meeting_url, l.meeting_type, ls.student_id FROM lessons l JOIN lesson_students ls ON l.id = ls.lesson_id WHERE l.id = 'legacy-lesson'").first();
  assert.deepEqual(migrated, { meeting_url: "https://example.com/legacy", meeting_type: "external", student_id: "legacy-student" });
  await db.batch([
    db.prepare("DELETE FROM lessons WHERE id = 'legacy-lesson'"),
    db.prepare("DELETE FROM students WHERE id = 'legacy-student'"),
  ]);
  let checks = 0;
  async function request(user, body, status = 200) {
    const headers = {};
    if (user) {
      headers["oai-authenticated-user-id"] = user;
      headers["oai-authenticated-user-email"] = user + "@example.test";
    }
    if (body) {
      headers["Content-Type"] = "application/json";
      headers.Origin = "http://app.local";
    }
    const r = await mf.dispatchFetch("http://app.local/api/portal", {
      method: body ? "POST" : "GET",
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    assert.equal(
      r.status,
      status,
      JSON.stringify({ body, data, status: r.status, expected: status }),
    );
    checks++;
    return data;
  }
  await request(null, null, 401);
  await request("stranger", null, 403);
  async function session(query = "", user) {
    const response = await mf.dispatchFetch("http://app.local/api/session" + query, {
      headers: user ? {
        "oai-authenticated-user-id": user,
        "oai-authenticated-user-email": user + "@example.test",
      } : {},
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /private, no-store/);
    checks++;
    return response.json();
  }
  const next = await session("?return_to=%2Flessons%2Flesson-123%2Flive");
  assert.match(decodeURIComponent(next.signIn), /return_to=\/lessons\/lesson-123\/live$/);
  const unsafeNext = await session("?return_to=%2F%2Fexample.test");
  assert.match(decodeURIComponent(unsafeNext.signIn), /return_to=\/account$/);
  const demo = await session("?demo=student");
  assert.equal(demo.data.role, "student");
  assert.equal(demo.data.demo, true);
  assert.equal(demo.user, null);
  const account = await session("?account=1&invite=sample-invitation");
  assert.equal(account.data, null);
  assert.match(decodeURIComponent(account.signIn), /\/account\?invite=sample-invitation$/);
  await request(
    "owner",
    { action: "activate", code: "incorrect-owner-token", name: "Test tutor" },
    403,
  );
  await request("owner", {
    action: "activate",
    code: "local-test-owner-token-123456789",
    name: "Test tutor",
  });
  await request(
    "attacker",
    {
      action: "activate",
      code: "local-test-owner-token-123456789",
      name: "Other",
    },
    409,
  );
  const a = await request("owner", {
    action: "save_student",
    name: "Test A",
    email: "a@example.test",
    level: "A1",
    goal: "Learning",
    progress: 12,
  });
  const b = await request("owner", {
    action: "save_student",
    name: "Test B",
    email: "b@example.test",
    level: "A2",
    goal: "Work",
    progress: 40,
  });
  const invitation = await request("owner", { action: "invite", id: a.id });
  await request("student-a", { action: "join", code: invitation.code });
  await request("student-b", { action: "join", code: invitation.code }, 400);
  const invB = await request("owner", { action: "invite", id: b.id });
  await request("student-b", { action: "join", code: invB.code });
  const aData = await request("student-a");
  assert.equal(aData.students.length, 1);
  assert.equal(aData.students[0].id, a.id);
  assert.equal(aData.role, "student");
  assert.ok(!JSON.stringify(aData).includes("invite_hash"));
  checks++;
  const lesson = await request("owner", {
    action: "save_lesson",
    student_id: a.id,
    title: "Test Polish lesson",
    starts_at: "2026-10-15T12:00:00.000Z",
    duration: 60,
    meeting_url: "https://example.com/lesson",
  });
  await request(
    "owner",
    {
      action: "save_lesson",
      student_id: b.id,
      title: "Clashing lesson",
      starts_at: "2026-10-15T12:30:00.000Z",
      duration: 60,
      meeting_url: "",
    },
    409,
  );
  await request(
    "student-a",
    {
      action: "save_lesson",
      student_id: a.id,
      title: "Unauthorized lesson",
      starts_at: "2026-10-15T17:00:00.000Z",
      duration: 60,
      meeting_url: "",
    },
    403,
  );
  const payment = await request("owner", {
    action: "save_payment",
    student_id: a.id,
    title: "October lessons",
    amount: 24000,
    due_date: "2026-10-20",
  });
  await request(
    "student-a",
    { action: "payment_status", id: payment.id, status: "paid" },
    403,
  );
  await request("owner", {
    action: "payment_status",
    id: payment.id,
    status: "paid",
  });
  await request(
    "student-a",
    { action: "send_message", student_id: b.id, body: "Should be forbidden" },
    403,
  );
  await request("student-a", {
    action: "send_message",
    student_id: a.id,
    body: "Dzień dobry!",
  });
  await request("owner", {
    action: "send_message",
    student_id: a.id,
    body: "Cześć!",
  });
  await request("student-a", { action: "read_messages", student_id: a.id });
  await request("owner", {
    action: "save_material",
    title: "Polish greetings",
    category: "Danışıq",
    level: "A1",
    body: "Cześć — Salam",
    url: "",
  });
  await request("owner", {
    action: "save_post",
    title: "Welcome",
    category: "Elan",
    body: "Ready for our next lesson.",
  });
  const finalA = await request("student-a");
  assert.equal(finalA.lessons[0].id, lesson.id);
  assert.equal(finalA.payments[0].status, "paid");
  assert.equal(finalA.messages.length, 2);
  assert.ok(finalA.messages.find((m) => m.sender_role === "tutor").read_at);
  assert.equal(finalA.materials.length, 1);
  assert.equal(finalA.posts.length, 1);
  checks++;
  const finalB = await request("student-b");
  assert.equal(finalB.lessons.length, 0);
  assert.equal(finalB.payments.length, 0);
  assert.equal(finalB.messages.length, 0);
  checks++;
  const studentSession = await session("", "student-b");
  assert.equal(studentSession.data.demo, false);
  assert.equal(studentSession.data.role, "student");
  assert.deepEqual(studentSession.data.students.map(({ id }) => id), [b.id]);
  assert.deepEqual(studentSession.data.lessons, []);
  const explicitDemo = await session("?demo=student", "owner");
  assert.equal(explicitDemo.data.demo, true);
  assert.ok(explicitDemo.data.students.every((student) => student.id !== b.id));
  await request(
    "student-a",
    { action: "delete", entity: "students", id: b.id },
    403,
  );
  const group = await request("owner", {
    action: "save_lesson", student_ids: [a.id, b.id], title: "Group lesson",
    starts_at: new Date(Date.now() + 60000).toISOString(), duration: 60, meeting_url: "",
  });
  const ownerGroup = (await request("owner")).lessons.find(item => item.id === group.id);
  assert.deepEqual(new Set(ownerGroup.student_ids), new Set([a.id, b.id]));
  const studentGroup = (await request("student-b")).lessons.find(item => item.id === group.id);
  assert.deepEqual(studentGroup.student_ids, [b.id]);

  const recentEnds = [];
  let pauseIssuance;
  const fake = {
    id: "fake",
    isConfigured: () => true,
    issueJoinCredentials: async ({ role }) => {
      await pauseIssuance?.();
      return { role };
    },
    parseEvent: async ({ request }) => request.json(),
    endSession: async ({ sessionId }) => recentEnds.push(sessionId),
  };
  const live = createLiveHandlers({ fake });
  const env = { DB: db, LIVE_LESSONS_ENABLED: "true", LIVE_LESSON_PROVIDER: "fake" };
  await db.prepare("UPDATE lessons SET meeting_type = 'live' WHERE id = ?").bind(group.id).run();
  async function liveRequest(user, action = "", expected = 200) {
    const response = await live.fetch(new Request("http://app.local/api/lessons/" + group.id + "/live" + (action ? "/" + action : ""), {
      method: action ? "POST" : "GET",
      headers: { Origin: "http://app.local", "oai-authenticated-user-id": user, "oai-authenticated-user-email": user + "@example.test" },
    }), env);
    assert.equal(response.status, expected);
    assert.match(response.headers.get("cache-control"), /private, no-store/);
    checks++;
    return response.json();
  }
  assert.equal((await liveRequest("student-a")).state, "waiting");
  await liveRequest("student-a", "start", 403);
  await liveRequest("student-a", "join", 409);
  await liveRequest("stranger", "join", 403);
  const starts = await Promise.all([liveRequest("owner", "start"), liveRequest("owner", "start")]);
  assert.deepEqual(starts.map(item => item.state), ["starting", "starting"]);
  assert.deepEqual(await liveRequest("owner", "join"), { provider: "fake", credentials: { role: "tutor" } });
  await liveRequest("student-a", "join", 409);
  const room = await db.prepare("SELECT room_key FROM live_rooms WHERE lesson_id = ?").bind(group.id).first();
  async function providerEvent(type, sessionId) {
    const response = await live.fetch(new Request("http://app.local/api/lessons/live/events/fake", {
      method: "POST", body: JSON.stringify({ type, sessionId, roomKey: room.room_key }),
    }), env);
    assert.equal(response.status, 200);
  }
  await providerEvent("started", "instance");
  await providerEvent("started", "instance");
  assert.deepEqual(await liveRequest("student-a", "join"), { provider: "fake", credentials: { role: "student" } });
  await liveRequest("student-b", "end", 403);
  await request("owner", { action: "delete", entity: "students", id: a.id }, 409);
  await request("owner", {
    action: "save_lesson", id: group.id, student_ids: [b.id], title: "Roster change",
    starts_at: ownerGroup.starts_at, duration: 60, meeting_url: "",
  }, 409);
  let releaseCredentials;
  let beginIssuance;
  const issuing = new Promise(resolve => { beginIssuance = resolve; });
  const blocked = new Promise(resolve => { releaseCredentials = resolve; });
  pauseIssuance = () => { beginIssuance(); return blocked; };
  const racingJoin = liveRequest("student-a", "join", 409);
  await issuing;
  assert.equal((await liveRequest("owner", "end")).state, "ended");
  releaseCredentials();
  await racingJoin;
  pauseIssuance = null;
  await liveRequest("owner", "end");
  await liveRequest("student-a", "join", 409);
  await providerEvent("started", "late-instance");
  assert.deepEqual(recentEnds, ["instance", "late-instance"]);
  assert.equal((await liveRequest("student-a")).state, "ended");

  await request("owner", { action: "delete", entity: "students", id: a.id });
  await request("student-a", null, 403);
  for (const table of ["lesson_students", "payments", "messages"]) {
    const count = await db
      .prepare(`SELECT count(*) AS n FROM ${table} WHERE student_id=?`)
      .bind(a.id)
      .first();
    assert.equal(count.n, 0);
    checks++;
  }
  assert.equal((await request("student-b")).lessons.find(item => item.id === group.id).id, group.id);
  assert.equal((await request("owner")).lessons.find(item => item.id === lesson.id).status, "cancelled");
  assert.equal(studentGroup.student_count, 2);
  const staleRoom = await request("owner", {
    action: "save_lesson", student_ids: [b.id], title: "Expired live lesson",
    starts_at: new Date(Date.now() - 3600000).toISOString(), duration: 30, meeting_url: "",
  });
  await db.batch([
    db.prepare("UPDATE lessons SET meeting_type = 'live' WHERE id = ?").bind(staleRoom.id),
    db.prepare("INSERT INTO live_rooms (lesson_id, provider, room_key, state, session_id, closes_at) VALUES (?, 'fake', 'expired-room', 'live', 'expired-instance', ?)").bind(staleRoom.id, new Date(Date.now() - 60000).toISOString()),
  ]);
  await live.scheduled(env);
  assert.ok(recentEnds.includes("expired-instance"));
  assert.equal((await db.prepare("SELECT state FROM live_rooms WHERE lesson_id = ?").bind(staleRoom.id).first()).state, "ended");

  const removedMember = await live.fetch(new Request("http://app.local/api/lessons/" + group.id + "/live", {
    headers: { "oai-authenticated-user-id": "student-a", "oai-authenticated-user-email": "student-a@example.test" },
  }), env);
  assert.equal(removedMember.status, 403);
  const csrf = await mf.dispatchFetch("http://app.local/api/portal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://other.test",
    },
    body: JSON.stringify({ action: "delete", entity: "students", id: b.id }),
  });
  assert.equal(csrf.status, 403);
  checks++;
  for (const path of [
    "/?demo=tutor",
    "/?demo=student",
    "/home",
    "/students?demo=tutor",
    "/lessons?demo=tutor",
    "/lessons/" + group.id + "/live",
    "/materials?demo=tutor",
    "/feed?demo=tutor",
    "/messages?demo=tutor",
    "/payments?demo=student",
    "/account",
  ]) {
    const r = await mf.dispatchFetch("http://app.local" + path);
    const html = await r.text();
    assert.equal(r.status, 200, path);
    assert.ok(html.includes("Polski"), path);
    assert.ok(!html.includes("Məlumatları yükləmək mümkün olmadı"), path);
    checks++;
  }
  const shell = await mf.dispatchFetch("http://app.local/");
  const html = await shell.text();
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    const response = await mf.dispatchFetch("http://app.local" + asset);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /immutable/);
    checks++;
  }
  const missing = await mf.dispatchFetch("http://app.local/missing-page");
  assert.equal(missing.status, 404);
  const missingApi = await mf.dispatchFetch("http://app.local/api/typo");
  assert.equal(missingApi.status, 404);
  assert.match(missingApi.headers.get("content-type"), /application\/json/);
  checks += 2;
  console.log(
    JSON.stringify({
      passed: checks,
      result:
        "Portal checks, populated D1 migration, roster isolation, live room lifecycle, concurrent join and end, and classroom routes verified.",
    }),
  );
} finally {
  await mf.dispose();
}
