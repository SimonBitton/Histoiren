import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.env.PORT || '8000', 10);
const host = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.jsdelivr.net https://upload.wikimedia.org https://thumb.wikimedia.org; connect-src 'self' https://fr.wikipedia.org https://raw.githubusercontent.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; media-src 'none'; worker-src 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

function send(response, status, body, extraHeaders = {}) {
  response.writeHead(status, { ...SECURITY_HEADERS, ...extraHeaders });
  response.end(body);
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  } catch {
    send(response, 400, 'Bad Request');
    return;
  }

  const relativeRequest = pathname.replace(/^\/+/, '');
  const requestedPath = extname(relativeRequest) ? relativeRequest : 'index.html';
  const filePath = resolve(root, requestedPath);
  const pathFromRoot = relative(root, filePath);
  if (pathFromRoot.startsWith('..') || pathFromRoot.includes('\0')) {
    send(response, 403, 'Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size > 6_000_000) throw new Error('invalid file');
    const body = request.method === 'HEAD' ? undefined : await readFile(filePath);
    send(response, 200, body, {
      'Cache-Control': requestedPath.startsWith('data/')
        ? 'public, max-age=3600, stale-while-revalidate=86400'
        : 'no-cache',
      'Content-Length': String(info.size),
      'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream'
    });
  } catch {
    send(response, 404, 'Not Found');
  }
});

server.listen(port, host, () => {
  console.log(`Histoiren disponible sur http://${host}:${port}`);
});
