const encoder = new TextEncoder();

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function signingKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(secret, message) {
  const key = await signingKey(secret);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

async function jwt(secret, claims) {
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64url(encoder.encode(JSON.stringify(claims)));
  const message = header + '.' + payload;
  return message + '.' + base64url(await sign(secret, message));
}

function configured(env) {
  return Boolean(env.ZOOM_VIDEO_SDK_KEY && env.ZOOM_VIDEO_SDK_SECRET && env.ZOOM_API_KEY && env.ZOOM_WEBHOOK_SECRET);
}

async function issueJoinCredentials({ env, room, role, actor }) {
  const roomKey = room.room_key;
  const issuedAt = Math.floor(Date.now() / 1000) - 30;
  const expiresAt = issuedAt + 1800;
  const host = role === 'tutor';
  const identity = host ? 'tutor' : 'student:' + actor.studentId;
  const userKey = hex(await sign(env.ZOOM_VIDEO_SDK_SECRET, 'user:' + roomKey + ':' + identity)).slice(0, 32);
  const token = await jwt(env.ZOOM_VIDEO_SDK_SECRET, {
    app_key: env.ZOOM_VIDEO_SDK_KEY,
    role_type: host ? 1 : 0,
    tpc: roomKey,
    session_key: roomKey,
    user_key: userKey,
    version: 1,
    iat: issuedAt,
    exp: expiresAt,
  });
  const passcode = hex(await sign(env.ZOOM_VIDEO_SDK_SECRET, 'passcode:' + roomKey)).slice(0, 10);
  return { roomKey, token, displayName: actor.name.slice(0, 200), passcode, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

async function endSession({ env, sessionId }) {
  const encoded = encodeURIComponent(sessionId);
  const id = /^\/|\/\//.test(sessionId) ? encodeURIComponent(encoded) : encoded;
  const response = await fetch('https://api.zoom.us/v2/videosdk/sessions/' + id + '/status', {
    method: 'PUT',
    headers: { 'x-api-key': env.ZOOM_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'end' }),
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) {
    const problem = await response.json().catch(() => null);
    if (problem?.code === 3001) return; // This specific Zoom session no longer exists.
  }
  if (!response.ok) {
    throw new Error('Zoom session end request failed (' + response.status + ')');
  }
}

async function parseEvent({ request, env }) {
  if (!env.ZOOM_WEBHOOK_SECRET) return new Response(null, { status: 503 });
  const timestamp = request.headers.get('x-zm-request-timestamp') || '';
  const signature = request.headers.get('x-zm-signature') || '';
  if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !/^v0=[a-f\d]{64}$/.test(signature)) {
    return new Response(null, { status: 401 });
  }
  const body = await request.text();
  const key = await signingKey(env.ZOOM_WEBHOOK_SECRET);
  const digest = Uint8Array.from(signature.slice(3).match(/../g), (byte) => Number.parseInt(byte, 16));
  const message = 'v0:' + timestamp + ':' + body;
  if (!await crypto.subtle.verify('HMAC', key, digest, encoder.encode(message))) {
    return new Response(null, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (event?.event === 'endpoint.url_validation') {
    const plainToken = event.payload?.plainToken;
    if (typeof plainToken !== 'string' || !plainToken) return new Response(null, { status: 400 });
    const encryptedToken = hex(await sign(env.ZOOM_WEBHOOK_SECRET, plainToken));
    return Response.json({ plainToken, encryptedToken });
  }
  if (event?.event !== 'session.started' && event?.event !== 'session.ended') {
    return new Response(null, { status: 204 });
  }
  const object = event.payload?.object;
  const roomKey = object?.session_key || object?.session_name;
  const sessionId = object?.session_id || object?.id;
  if (typeof roomKey !== 'string' || !roomKey || typeof sessionId !== 'string' || !sessionId) {
    return new Response(null, { status: 400 });
  }
  return { type: event.event === 'session.started' ? 'started' : 'ended', roomKey, sessionId };
}

export const zoom = { id: 'zoom', isConfigured: configured, issueJoinCredentials, endSession, parseEvent };
export default zoom;
