import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const client = resolve(root, 'dist/client');
const server = resolve(root, 'dist/server');
const metadata = resolve(root, 'dist/.openai');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const assets = {};
for (const path of (await readdir(client, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => resolve(entry.parentPath, entry.name).slice(client.length + 1))
  .sort()) {
  const type = contentTypes[extname(path)];
  if (!type) throw new Error('Add a content type for client asset ' + path);
  assets['/' + path] = { type, content: await readFile(resolve(client, path), 'utf8') };
}

await Promise.all([rm(server, { recursive: true, force: true }), rm(metadata, { recursive: true, force: true })]);
await mkdir(metadata, { recursive: true });

async function copyHostingMetadata() {
  try {
    await cp(resolve(root, '.openai/hosting.json'), resolve(metadata, 'hosting.json'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await Promise.all([
  build({
    absWorkingDir: root,
    entryPoints: ['server/index.js'],
    outfile: resolve(server, 'index.js'),
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    legalComments: 'inline',
    plugins: [{
      name: 'embed-vite-assets',
      setup(builder) {
        builder.onResolve({ filter: /^polskiyol-client-assets$/ }, () => ({
          path: 'client-assets',
          namespace: 'polskiyol',
        }));
        builder.onLoad({ filter: /^client-assets$/, namespace: 'polskiyol' }, () => ({
          contents: JSON.stringify(assets),
          loader: 'json',
        }));
      },
    }],
  }),
  copyHostingMetadata(),
  cp(resolve(root, 'drizzle'), resolve(metadata, 'drizzle'), { recursive: true }),
]);
