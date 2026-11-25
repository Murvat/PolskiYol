const apiRoute = /^\/api\/(?:auth\/(?:login|logout|refresh|me|register\/(?:student|teacher))|students(?:\/(?:me|teacher-assignment|\d+))?|teachers\/\d+|lessons(?:\/\d+)?|payments(?:\/(?:summary|\d+(?:\/paid)?))?|feed-posts(?:\/\d+)?|materials(?:\/\d+(?:\/(?:cover|download))?)?|conversations(?:\/\d+(?:\/messages(?:\/\d+)?)?)?)\/?$/;
const hubRoute = /^\/hubs\/messages(?:\/negotiate)?\/?$/;

export function isDotnetRoute(pathname) {
  return apiRoute.test(pathname) || hubRoute.test(pathname);
}

export async function proxyDotnet(request, target) {
  const original = new URL(request.url);
  const base = new URL(target);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    return Response.json({ error: 'API ünvanı düzgün konfiqurasiya edilməyib.' }, { status: 503 });
  }

  const headers = new Headers();
  for (const name of ['accept', 'authorization', 'content-type', 'upgrade',
    'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol', 'sec-websocket-extensions']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (original.pathname.startsWith('/api/auth/')) {
    const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim())
      .find(value => value.startsWith('refreshToken='));
    if (cookie) headers.set('cookie', cookie);
  }

  const upstream = new URL(original.pathname + original.search, base);
  return fetch(upstream, {
    method: request.method, headers, body: request.body, redirect: 'manual',
  });
}
