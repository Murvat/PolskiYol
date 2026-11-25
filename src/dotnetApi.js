export const useDotnetApi = import.meta.env?.VITE_POLSKIYOL_BACKEND === 'dotnet';

let accessToken;
let expiresAt = 0;
let refreshRequest;
let sessionVersion = 0;

class ApiError extends Error {
  constructor(status, body) {
    const message = Object.values(body?.errors || {}).flat()[0] ||
      (typeof body === 'string' ? body : body?.detail || body?.title);
    super(message || 'Əməliyyat mümkün olmadı. Yenidən cəhd edin.');
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token, binary } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, {
    method, credentials: 'same-origin', cache: 'no-store', headers,
    body: body === undefined || body instanceof FormData ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const details = contentType.includes('json') ? await response.json().catch(() => null) : await response.text();
    throw new ApiError(response.status, details);
  }
  return {
    data: response.status === 204 ? null : binary ? await response.blob() : (response.headers.get('content-type') || '').includes('json') ? await response.json() : null,
    next: response.headers.get('X-Next-Before-Id'),
  };
}

function remember(session) {
  accessToken = session.accessToken;
  expiresAt = Date.parse(session.expiresAtUtc);
  return accessToken;
}

export async function getAccessToken() {
  if (accessToken && expiresAt - Date.now() > 10000) return accessToken;
  if (!refreshRequest) {
    const version = sessionVersion;
    refreshRequest = request('/api/auth/refresh', { method: 'POST' })
      .then(({ data }) => version === sessionVersion ? remember(data) : undefined)
      .catch((error) => {
        if (error.status === 401) return undefined;
        throw error;
      })
      .finally(() => { refreshRequest = undefined; });
  }
  return refreshRequest;
}

async function authenticated(path, options = {}) {
  const token = await getAccessToken();
  if (!token) throw new ApiError(401);
  try {
    return await request(path, { ...options, token });
  } catch (error) {
    if (error.status !== 401) throw error;
    if (accessToken === token) expiresAt = 0;
    const refreshed = await getAccessToken();
    if (!refreshed) throw error;
    return request(path, { ...options, token: refreshed });
  }
}

export async function loginAccount(body) {
  if (refreshRequest) await refreshRequest.catch(() => {});
  const { data } = await request('/api/auth/login', { method: 'POST', body });
  sessionVersion++;
  remember(data);
}

export function registerAccount(role, body) {
  if (role !== 'student' && role !== 'teacher') throw new Error('Hesab növü yanlışdır.');
  return request('/api/auth/register/' + role, { method: 'POST', body });
}

export async function logoutAccount() {
  sessionVersion++;
  if (refreshRequest) await refreshRequest.catch(() => {});
  await request('/api/auth/logout', { method: 'POST' });
  accessToken = undefined;
  expiresAt = 0;
}

export async function getAccount() {
  try {
    return (await authenticated('/api/auth/me')).data;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export async function assignTeacher(body) {
  return authenticated('/api/students/teacher-assignment', { method: 'PUT', body });
}

const nameOf = (profile) => profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') : '';
const asUtc = (value) => value && !/(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value + 'Z' : value;
const id = (value) => String(value);
const accountLink = '/account';

async function readList(path, maxPages = Infinity) {
  const rows = [];
  let after;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (after) query.set('beforeId', after);
    const result = await authenticated(path + '?' + query);
    rows.push(...result.data);
    after = result.next;
    maxPages--;
  } while (after && maxPages > 0);
  return rows;
}

export async function loadApiSession({ account }) {
  const user = await getAccount();
  if (account || !user) return { user, signIn: accountLink, signOut: accountLink };
  const tutor = user.roles.includes('Teacher');
  if (!tutor && !user.roles.includes('Student')) return { user, signIn: accountLink, signOut: accountLink };

  const now = new Date();
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(now);
  const year = today.slice(0, 4);
  const [profiles, lessons, payments, materials, posts, conversations] = await Promise.all([
    authenticated(tutor ? '/api/students' : '/api/students/me').then(({ data }) => tutor ? data : [data]),
    authenticated('/api/lessons').then(({ data }) => data),
    authenticated('/api/payments?year=' + year).then(({ data }) => data),
    readList('/api/materials'),
    readList('/api/feed-posts'),
    authenticated('/api/conversations').then(({ data }) => data),
  ]);
  const student = tutor ? null : profiles[0];
  const teacher = student?.teacherId == null ? null : (await authenticated('/api/teachers/' + student.teacherId)).data;
  const threads = await Promise.all(conversations.map(async (conversation) => {
    try {
      const messages = await readList('/api/conversations/' + conversation.id + '/messages');
      return { conversation, messages };
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }));
  const unassigned = student && student.teacherId == null;

  return {
    user, signIn: accountLink, signOut: accountLink,
    data: {
      api: true, demo: false, role: tutor ? 'tutor' : 'student', today,
      studentId: student ? id(student.id) : undefined, unassigned,
      name: nameOf(student) || user.email,
      tutorName: tutor ? user.email : nameOf(teacher) || 'Müəllim',
      students: profiles.map(profile => ({
        id: id(profile.id), name: nameOf(profile), phone: profile.phoneNumber, user_id: true,
        level: '—', goal: '', progress: 0, email: '',
      })),
      conversations: threads.filter(Boolean).map(({ conversation }) => ({
        id: conversation.id, studentId: id(conversation.studentId),
      })),
      lessons: lessons.map(item => ({
        id: id(item.id), title: item.topic, duration: item.durationMinutes,
        starts_at: asUtc(item.startsAt), status: 'scheduled',
        student_id: student ? id(student.id) : null,
      })),
      payments: payments.map(item => ({
        id: id(item.id), title: String(item.month).padStart(2, '0') + '/' + item.year,
        student_id: id(item.studentId), amount: Math.round(item.expectedAmount * 100),
        due_date: item.dueDate, status: item.paidAt ? 'paid' : 'pending', paid_at: item.paidAt,
      })),
      posts: posts.map(item => ({ id: id(item.id), title: item.title, body: item.content, category: 'Elan', created_at: asUtc(item.createdAt) })),
      materials: materials.map(item => ({
        id: id(item.id), title: item.fileName, body: item.description || '',
        category: 'PDF', level: '—', apiFile: true, hasCover: item.hasCover,
      })),
      messages: threads.filter(Boolean).flatMap(({ conversation, messages }) => messages.map(message => ({
        id: id(message.id), student_id: id(conversation.studentId), body: message.content,
        sender_role: message.senderType === 1 || String(message.senderType).toLowerCase() === 'teacher' ? 'tutor' : 'student',
        created_at: asUtc(message.sentAt), read_at: true,
      }))),
    },
  };
}

export async function changeApiPortal(input, session) {
  const { action } = input;
  const studentId = Number(input.student_id);
  const post = (path, body) => authenticated(path, { method: 'POST', body });
  switch (action) {
    case 'save_lesson':
      if (input.id) break;
      return post('/api/lessons', { topic: input.title, startsAt: input.starts_at, durationMinutes: input.duration, studentIds: [studentId] });
    case 'save_payment': {
      if (input.id) break;
      const [year, month] = input.due_date.split('-').map(Number);
      return post('/api/payments', { studentId, year, month, dueDate: input.due_date, expectedAmount: input.amount / 100 });
    }
    case 'payment_status':
      if (input.status !== 'paid') break;
      return authenticated('/api/payments/' + Number(input.id) + '/paid', { method: 'PATCH' });
    case 'save_post':
      if (input.id) break;
      return post('/api/feed-posts', { title: input.title, content: input.body });
    case 'save_material': {
      if (input.id || !(input.file instanceof File) || !input.file.size) break;
      const body = new FormData();
      body.set('file', input.file);
      if (input.body) body.set('description', input.body);
      return post('/api/materials', body);
    }
    case 'save_cover': {
      if (!(input.file instanceof File) || !input.file.size) break;
      const body = new FormData();
      body.set('file', input.file);
      return post('/api/materials/' + Number(input.id) + '/cover', body);
    }
    case 'delete': {
      const endpoint = { posts: 'feed-posts', materials: 'materials' }[input.entity];
      if (!endpoint) break;
      return authenticated('/api/' + endpoint + '/' + Number(input.id), { method: 'DELETE' });
    }
    case 'send_message': {
      const thread = session?.data?.conversations.find(item => item.studentId === id(input.student_id));
      if (!thread) throw new Error('Söhbət mövcud deyil. Təyinatı yoxlayın.');
      return post('/api/conversations/' + thread.id + '/messages', { content: input.body });
    }
    case 'read_messages':
      return { data: null };
  }
  throw new Error('Bu əməliyyat API-də mövcud deyil.');
}

export async function downloadMaterial(material) {
  const { data } = await authenticated('/api/materials/' + Number(material.id) + '/download', { binary: true });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = material.title;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function readMaterialCover(material) {
  return (await authenticated('/api/materials/' + Number(material.id) + '/cover', { binary: true })).data;
}
