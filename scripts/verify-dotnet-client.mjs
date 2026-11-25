import assert from 'node:assert/strict';
import { loadApiSession, changeApiPortal, loginAccount, registerAccount } from '../src/dotnetApi.js';
import { isDotnetRoute, proxyDotnet } from '../server/dotnetProxy.js';

const calls = [];
globalThis.fetch = async (input, init) => {
  calls.push([input, init]);
  const [path, query] = String(input).split('?');
  switch (path) {
    case '/api/auth/register/student': return new Response(null, { status: 201 });
    case '/api/auth/login': return Response.json({ accessToken: 'test-token', expiresAtUtc: new Date(Date.now() + 300000).toISOString() });
    case '/api/auth/me': return Response.json({ email: 'student@example.test', roles: ['Student'] });
    case '/api/students/me': return Response.json({ id: 10, teacherId: 5, firstName: 'Student' });
    case '/api/teachers/5': return Response.json({ id: 5, firstName: 'Teacher' });
    case '/api/conversations': return Response.json([{ id: 80, studentId: 10 }]);
    case '/api/conversations/80/messages':
      if (init.method === 'POST') return Response.json({ id: 91 }, { status: 201 });
      return new URLSearchParams(query).has('beforeId')
        ? Response.json([{ id: 88, senderType: 0, content: 'Earlier' }])
        : Response.json([{ id: 90, senderType: 1, content: 'Latest' }], { headers: { 'X-Next-Before-Id': '90' } });
    case '/api/lessons':
    case '/api/payments':
    case '/api/materials':
    case '/api/feed-posts':
      return Response.json([]);
    default:
      return new Response(null, { status: 404 });
  }
};

await registerAccount('student', { email: 'student@example.test' });
await loginAccount({ email: 'student@example.test', password: 'test' });
const session = await loadApiSession({});
assert.equal(session.data.tutorName, 'Teacher');
assert.equal(session.data.messages.length, 2);
assert.deepEqual(session.data.messages.map(message => message.sender_role), ['tutor', 'student']);
assert.equal(calls.find(([path]) => path === '/api/auth/me')[1].headers.Authorization, 'Bearer test-token');
await changeApiPortal({ action: 'send_message', student_id: '10', body: 'New' }, session);
assert.deepEqual(JSON.parse(calls.at(-1)[1].body), { content: 'New' });
await assert.rejects(() => changeApiPortal({ action: 'save_student' }, session), /API-də/);

assert.equal(isDotnetRoute('/api/materials/42/cover'), true);
assert.equal(isDotnetRoute('/hubs/messages/negotiate'), true);
assert.equal(isDotnetRoute('/api/session'), false);
assert.equal(isDotnetRoute('/api/portal'), false);
assert.equal(isDotnetRoute('/api/admin'), false);
globalThis.fetch = async (url, init) => {
  assert.equal(url.href, 'https://api.example.test/api/auth/refresh');
  assert.equal(init.headers.get('cookie'), 'refreshToken=xyz');
  assert.equal(init.headers.has('x-chatgpt-user-id'), false);
  assert.equal(init.redirect, 'manual');
  return new Response(null, { status: 204 });
};
await proxyDotnet(new Request('https://app.example.test/api/auth/refresh', {
  method: 'POST',
  headers: { cookie: 'legacy=private; refreshToken=xyz', 'x-chatgpt-user-id': 'private' },
}), 'https://api.example.test');

console.log('ASP.NET Core portal contract checks passed.');
