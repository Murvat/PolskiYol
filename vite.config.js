import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { handleApi } from './server/api.js';

const localDemo = {
  name: 'polskiyol-local-demo',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/')) return next();

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
};

export default defineConfig({
  plugins: [react(), tailwindcss(), localDemo],
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
  server: { allowedHosts: ['terminal.local'] },
});
