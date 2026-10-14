import http from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL, validateDraft, statusAt, imageType } from './lib.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
if (existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const port = Number(process.env.PORT || 4310);
const origin = `http://127.0.0.1:${port}`;
const data = path.resolve(root, process.env.STUDIO_DATA_DIR || 'data');
mkdirSync(path.join(data, 'references'), { recursive: true });
const db = new DatabaseSync(path.join(data, 'studio.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY, filename TEXT NOT NULL, mime TEXT NOT NULL, stored TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, created INTEGER NOT NULL, settings TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
 PRAGMA user_version=1;`);
const session = randomBytes(32).toString('hex');
const csrf = randomBytes(32).toString('hex');
const sessions = req => (req.headers.cookie || '').split(';').some(v => v.trim() === `studio_session=${session}`);
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 15 * 1024 * 1024) throw new Error('Upload too large. Maximum image size is 10 MB.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('Invalid JSON request.'); }
}
function asset(id) { return db.prepare('SELECT * FROM assets WHERE id=?').get(id); }
function jobView(row) { const job = { id: row.id, created: row.created, settings: JSON.parse(row.settings) }; return { ...job, status: statusAt(job), mode: 'simulation', output: statusAt(job) === 'completed' ? `/api/output/${job.id}` : null, error: statusAt(job) === 'failed' ? 'Simulated provider failure. No paid request was sent.' : null }; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
function stream(res, file, type, download = false, req) {
  const size = statSync(file).size;
  const range = req?.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  if (download) headers['Content-Disposition'] = 'attachment; filename="studio-simulation.mp4"';
  if (range) { const start = Number(range[1]); const end = Math.min(range[2] ? Number(range[2]) : size - 1, size - 1); if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); } res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 }); createReadStream(file, { start, end }).pipe(res); }
  else { res.writeHead(200, { ...headers, 'Content-Length': size }); createReadStream(file).pipe(res); }
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) return json(res, 403, { error: 'Invalid local host.' });
  const url = new URL(req.url, origin); const p = url.pathname;
  try {
    if (p === '/' && req.method === 'GET') { res.setHeader('Set-Cookie', `studio_session=${session}; HttpOnly; SameSite=Strict; Path=/`); return stream(res, path.join(root, 'public/index.html'), 'text/html'); }
    if (['/app.js', '/style.css'].includes(p) && req.method === 'GET') return stream(res, path.join(root, 'public', p.slice(1)), mime[path.extname(p)]);
    if (!sessions(req)) return json(res, 401, { error: 'Open the studio locally to establish a session.' });
    if (req.method !== 'GET' && ( ![origin, `http://localhost:${port}`].includes(req.headers.origin) || req.headers['x-studio-csrf'] !== csrf || req.headers['content-type'] !== 'application/json')) return json(res, 403, { error: 'Invalid local request protection. Refresh the page.' });
    if (p === '/api/bootstrap' && req.method === 'GET') return json(res, 200, { csrf, model: MODEL, mode: 'simulation', draft: JSON.parse(db.prepare("SELECT value FROM settings WHERE key='draft'").get()?.value || 'null'), integration: 'Higgsfield requested; live adapter pending verified credentials, model capabilities, and paid-test approval.' });
    if (p === '/api/assets' && req.method === 'POST') {
      const input = await body(req);
      if (typeof input.bytes !== 'string' || typeof input.filename !== 'string') throw new Error('Invalid upload.');
      const bytes = Buffer.from(input.bytes, 'base64');
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('Each image must be smaller than 10 MB.');
      const [type, ext] = imageType(bytes); const id = randomUUID(); const stored = id + ext;
      const file = path.join(data, 'references', stored); writeFileSync(file + '.tmp', bytes); renameSync(file + '.tmp', file);
      const filename = path.basename(input.filename).slice(0, 200);
      db.prepare('INSERT INTO assets VALUES(?,?,?,?)').run(id, filename, type, stored);
      return json(res, 201, { id, filename, url: `/api/assets/${id}` });
    }
    if (p.startsWith('/api/assets/') && req.method === 'GET') {
      const row = asset(p.split('/')[3]); if (!row) return json(res, 404, { error: 'Image not found.' });
      if (url.searchParams.has('metadata')) return json(res, 200, { id: row.id, filename: row.filename, url: `/api/assets/${row.id}` });
      return stream(res, path.join(data, 'references', row.stored), row.mime);
    }
    if (p === '/api/draft' && req.method === 'POST') {
      const input = await body(req);
      if (typeof input.prompt !== 'string' || input.prompt.length > 6000 || !Array.isArray(input.references) || input.references.length > 8 || input.references.some(id => !asset(id))) throw new Error('Invalid draft.');
      db.prepare("INSERT INTO settings VALUES('draft',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(input)); return json(res, 200, { saved: true });
    }
    if (p === '/api/jobs' && req.method === 'GET') return json(res, 200, db.prepare('SELECT * FROM jobs ORDER BY created DESC LIMIT 200').all().map(jobView));
    if (p === '/api/jobs' && req.method === 'POST') {
      const input = await body(req); const settings = validateDraft(input, id => Boolean(asset(id)));
      if (typeof input.token !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.token)) throw new Error('Invalid submission token.');
      const existing = db.prepare('SELECT * FROM jobs WHERE token=?').get(input.token); if (existing) return json(res, 200, jobView(existing));
      const id = randomUUID(); db.prepare('INSERT INTO jobs VALUES(?,?,?,?)').run(id, input.token, Date.now(), JSON.stringify(settings));
      return json(res, 201, jobView(db.prepare('SELECT * FROM jobs WHERE id=?').get(id)));
    }
    if (p.startsWith('/api/output/') && req.method === 'GET') {
      const row = db.prepare('SELECT * FROM jobs WHERE id=?').get(p.split('/')[3]); if (!row || jobView(row).status !== 'completed') return json(res, 404, { error: 'No completed output available.' });
      const fixture = path.join(root, 'fixtures', `simulation-${JSON.parse(row.settings).ratio.replace(':', '-')}.mp4`);
      if (!existsSync(fixture)) return json(res, 503, { error: 'Simulation fixture is unavailable.' });
      return stream(res, fixture, 'video/mp4', url.searchParams.has('download'), req);
    }
    return json(res, 404, { error: 'Not found.' });
  } catch (error) { json(res, 400, { error: error.message }); }
});
server.listen(port, '127.0.0.1', () => console.log(`Eta Logics AI Creator Studio: ${origin} · SIMULATION ONLY`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
