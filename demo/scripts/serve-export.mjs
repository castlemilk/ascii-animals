import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { basePath, exportRoot } from './finalize-export.mjs';

const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
};

/** A static host mounted only at the real Pages base path; no SPA fallback. */
export function createExportServer({ outputDir = exportRoot, mount = basePath } = {}) {
  const root = path.resolve(outputDir);
  return createServer(async (request, response) => {
    const finish = (status, body, headers = {}) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    const notFound = async () => {
      try {
        const bytes = await readFile(path.join(root, '404.html'));
        return finish(404, bytes, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': String(bytes.length) });
      } catch { return finish(404, 'File not found'); }
    };
    if (!['GET', 'HEAD'].includes(request.method)) return finish(405, 'Method not allowed', { Allow: 'GET, HEAD' });
    let url, pathname;
    try {
      url = new URL(request.url, 'http://localhost');
      pathname = decodeURIComponent(url.pathname);
    } catch { return finish(400, 'Invalid URL'); }
    if (pathname === mount) return finish(308, 'Use the trailing slash', { Location: `${mount}/${url.search}` });
    if (!pathname.startsWith(`${mount}/`)) return finish(404, 'Outside the project base path');
    const relative = pathname.slice(mount.length + 1);
    if (relative.includes('\\') || relative.includes('\0') || relative.split('/').some(segment => segment === '..' || segment === '.')) {
      return finish(400, 'Invalid path');
    }
    let candidate = path.resolve(root, relative);
    if (candidate !== root && !candidate.startsWith(root + path.sep)) return notFound();
    try {
      if ((await stat(candidate)).isDirectory()) {
        if (!url.pathname.endsWith('/')) return finish(308, 'Use the trailing slash', { Location: `${url.pathname}/${url.search}` });
        candidate = path.join(candidate, 'index.html');
      }
      const resolved = await realpath(candidate);
      const actualRoot = await realpath(root);
      if (!resolved.startsWith(actualRoot + path.sep)) return notFound();
      const bytes = await readFile(resolved);
      return finish(200, bytes, {
        'Content-Type': contentTypes[path.extname(resolved)] || 'application/octet-stream',
        'Content-Length': String(bytes.length),
      });
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return notFound();
      console.error(error.message);
      return finish(500, 'Static file error');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || process.argv[2] || 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer between 0 and 65535.');
  const server = createExportServer();
  server.listen(port, '127.0.0.1', () => console.log(`Static export: http://127.0.0.1:${server.address().port}${basePath}/`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
}
