// Minimal, ZERO-DEPENDENCY static file server for the production build (dist/). Node built-ins
// only — it adds no runtime dependency and makes zero outbound calls, so the app's offline
// invariant is untouched (the server just hands back the already-built, self-contained files).
//
// Why this exists: a static deployment (deploymentTarget="static" in .replit) is the leaner,
// preferred way to host this zero-backend PWA. But Replit's "Publish app" / Autoscale flow wants
// a persistent `run` command to start a server. This is that server — it serves dist/ so the
// same build can go out through either path. Listens on $PORT (Replit sets it) on 0.0.0.0.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';
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
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
};

async function fileAt(path) {
  try {
    const s = await stat(path);
    return s.isFile() ? path : null;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  try {
    const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
    // Strip leading slashes then normalize; refuse any path that escapes dist/ (traversal guard).
    let rel = normalize(rawPath.replace(/^\/+/, ''));
    if (rel === '' || rel === '.') rel = 'index.html';
    const target = join(DIST, rel);
    if (!target.startsWith(DIST.endsWith(sep) ? DIST : DIST + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    // Serve the file; SPA-style fallback to index.html for extension-less unknown routes.
    let resolved = await fileAt(target);
    if (!resolved && !extname(rel)) resolved = await fileAt(join(DIST, 'index.html'));
    if (!resolved) {
      res.writeHead(404).end('Not found');
      return;
    }
    const body = await readFile(resolved);
    res.writeHead(200, { 'Content-Type': MIME[extname(resolved)] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end('Server error');
    console.error(err);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`SAP-1: serving dist/ on http://${HOST}:${PORT}`);
});
