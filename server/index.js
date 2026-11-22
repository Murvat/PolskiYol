import assets from 'polskiyol-client-assets';
import { handleApi } from './api.js';

const pages = new Set(['/', '/home', '/students', '/lessons', '/materials', '/feed', '/messages', '/payments', '/account']);

function serveAsset(request, asset, options = {}) {
  const { status = 200, cache = 'no-cache' } = options;
  return new Response(request.method === 'HEAD' ? null : asset.content, {
    status,
    headers: {
      'Content-Type': asset.type,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      return await handleApi(request, env) ?? Response.json({ error: 'Sorğu tapılmadı.' }, { status: 404 });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    if (pathname !== '/index.html' && Object.hasOwn(assets, pathname)) {
      const cache = pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
      return serveAsset(request, assets[pathname], { cache });
    }

    if (pathname.startsWith('/assets/')) return new Response('Asset not found', { status: 404 });

    const page = pathname.replace(/\/$/, '') || '/';
    return serveAsset(request, assets['/index.html'], { status: pages.has(page) ? 200 : 404 });
  },
};
