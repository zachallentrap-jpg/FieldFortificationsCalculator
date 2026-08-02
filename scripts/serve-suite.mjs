// Zero-dependency static server for the assembled toolkit in dist/ (Node built-ins
// only, zero outbound calls). Replit's publish flow wants a persistent run command;
// this is it.
//
// The cache headers are load-bearing for the update workflow:
//   any sw.js, any .html  → no-cache (must revalidate, or a new deploy is never seen)
//   assets/*-HASH.*       → immutable (safe: the name changes when the content does)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT) || 5000;
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.webmanifest': 'application/manifest+json',
};

const cacheHeaderFor = (rel) => {
  if (basename(rel) === 'sw.js' || rel.endsWith('.html') || rel === '') return 'no-cache, must-revalidate';
  return rel.includes('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
};

const send = (res, status, body, type, cache) => {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': cache,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(body);
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '') rel = 'index.html';

    const abs = join(DIST, normalize(rel));
    const root = DIST.endsWith(sep) ? DIST : DIST + sep;
    if (!abs.startsWith(root)) {
      return send(res, 403, 'forbidden', 'text/plain; charset=utf-8', 'no-store');
    }

    let target = abs;
    let key = normalize(rel).replaceAll(sep, '/');
    try {
      const s = await stat(target);
      if (s.isDirectory()) {
        target = join(target, 'index.html');
        key = key.replace(/\/?$/, '/index.html');
      }
    } catch {
      return send(res, 404, 'not found', 'text/plain; charset=utf-8', 'no-store');
    }

    const body = await readFile(target);
    send(res, 200, body, MIME[extname(target)] ?? 'application/octet-stream', cacheHeaderFor(key));
  } catch {
    send(res, 500, 'server error', 'text/plain; charset=utf-8', 'no-store');
  }
}).listen(PORT, HOST, () => {
  console.log(`toolkit serving dist/ on http://${HOST}:${PORT}`);
});
