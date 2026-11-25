import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { isDotnetRoute } from './server/dotnetProxy.js';
import { handleApi } from './server/api.js';

const localDemo = (dotnet) => ({
  name: 'polskiyol-local-demo',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/') || (dotnet && isDotnetRoute(url.pathname))) return next();

      // The development server displays demo data. Sites supplies authenticated
      // identity and the real D1 binding when running the production Worker.
      if (request.method !== 'GET' || url.pathname !== '/api/session') {
        response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'Bu əməliyyat yalnız yerləşdirilmiş portalda mövcuddur.' }));
        return;
      }

      const demo = await handleApi(new Request(url), {});
      response.writeHead(demo.status, Object.fromEntries(demo.headers));
      response.end(await demo.text());
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const dotnet = env.VITE_POLSKIYOL_BACKEND === 'dotnet';
  const target = env.POLSKIYOL_API_TARGET || 'https://localhost:7140';
  const proxy = { target, changeOrigin: true, secure: !/^https:\/\/localhost(?::\d+)?\/?$/.test(target) };

  return {
  plugins: [react(), tailwindcss(), localDemo(dotnet)],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-runtime': ['react-dom/client', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    allowedHosts: ['terminal.local'],
    proxy: dotnet ? { '/api': proxy, '/hubs': { ...proxy, ws: true } } : undefined,
  },
  };
});
