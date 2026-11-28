export function database(env) {
  if (!env.DB) throw new Error('Database unavailable');
  return env.DB;
}

export async function actorFor(db, user) {
  const owner = await db.prepare('SELECT owner_id, tutor_name FROM settings WHERE id = 1').first();
  if (!owner) return null;

  const tutorName = owner.tutor_name;
  if (owner.owner_id === user.userId) {
    return { role: 'tutor', studentId: null, name: tutorName, tutorName };
  }

  const student = await db.prepare('SELECT id, name FROM students WHERE user_id = ?').bind(user.userId).first();
  return student ? { role: 'student', studentId: student.id, name: student.name, tutorName } : null;
}

function lessonMembership(alias) {
  return `EXISTS (SELECT 1 FROM lesson_students WHERE lesson_id = ${alias}.id AND student_id = ?)`;
}

export async function lessonForActor(db, actor, lessonId) {
  if (actor.role === 'tutor') {
    return db.prepare('SELECT * FROM lessons WHERE id = ?').bind(lessonId).first();
  }
  if (actor.role === 'student') {
    return db.prepare(`SELECT * FROM lessons l WHERE l.id = ? AND ${lessonMembership('l')}`)
      .bind(lessonId, actor.studentId).first();
  }
  return null;
}

export async function portalData(db, actor, liveLessonsEnabled = false) {
  const isStudent = actor.role === 'student';
  const scope = (table, order) => isStudent
    ? db.prepare(`SELECT * FROM ${table} WHERE student_id = ? ORDER BY ${order}`).bind(actor.studentId)
    : db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`);

  const studentColumns = 'id, name, email, level, goal, progress, user_id, created_at';
  const studentsQuery = isStudent
    ? db.prepare(`SELECT ${studentColumns} FROM students WHERE id = ?`).bind(actor.studentId)
    : db.prepare(`SELECT ${studentColumns} FROM students ORDER BY created_at DESC`);
  const lessonColumns = `l.id, l.title, l.starts_at, l.duration, l.meeting_url, l.meeting_type, l.status,
    (SELECT count(*) FROM lesson_students WHERE lesson_id = l.id) AS student_count`;
  const lessonsQuery = isStudent
    ? db.prepare(`SELECT ${lessonColumns} FROM lessons l WHERE ${lessonMembership('l')} ORDER BY l.starts_at ASC`)
      .bind(actor.studentId)
    : db.prepare(`
        SELECT ${lessonColumns}, (
          SELECT json_group_array(student_id) FROM lesson_students WHERE lesson_id = l.id
        ) AS roster
        FROM lessons l ORDER BY l.starts_at ASC
      `);

  const [students, lessons, payments, materials, posts, messages] = await db.batch([
    studentsQuery,
    lessonsQuery,
    scope('payments', 'due_date DESC'),
    db.prepare('SELECT * FROM materials ORDER BY created_at DESC'),
    db.prepare('SELECT * FROM posts ORDER BY created_at DESC'),
    scope('messages', 'created_at DESC LIMIT 500'),
  ]);

  return {
    ...actor,
    demo: false,
    liveLessonsEnabled,
    today: new Date().toISOString().slice(0, 10),
    students: students.results,
    lessons: lessons.results.map(({ roster, ...lesson }) => {
      const studentIds = isStudent ? [actor.studentId] : JSON.parse(roster);
      return { ...lesson, student_id: studentIds[0] ?? null, student_ids: studentIds };
    }),
    payments: payments.results,
    materials: materials.results,
    posts: posts.results,
    messages: messages.results,
  };
}

function toHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

export function token() {
  return toHex(crypto.getRandomValues(new Uint8Array(24)));
}
