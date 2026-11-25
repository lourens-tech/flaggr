// Serves the web export in e2e/.web for the click-through tests, with the
// single-page-app fallback to index.html. Run by playwright.config.ts.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(__dirname, process.env.E2E_WEB_DIR ?? '.web');
const PORT = Number(process.env.E2E_WEB_PORT ?? 8090);
const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.gif': 'image/gif', '.webp': 'image/webp',
};

http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = path.normalize(path.join(DIR, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIR)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIR, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`flagrr e2e web on http://localhost:${PORT}`));
