import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorker } from './worker/worker.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(root);
if (existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const production = process.argv.includes('--production');
process.env.NODE_ENV = production ? 'production' : 'development';
process.env.NEXT_TELEMETRY_DISABLED = '1';
const { default: next } = await import('next');
const port = Number(process.env.PORT || 4310);
process.env.PORT = String(port);
process.env.STUDIO_SESSION_TOKEN = randomBytes(32).toString('hex');
process.env.STUDIO_CSRF_TOKEN = randomBytes(32).toString('hex');
const app = next({ dev: !production, dir: root, hostname: '127.0.0.1', port, webpack: true });
await app.prepare();
const stopWorker = startWorker(root);
const handle = app.getRequestHandler();
const server = http.createServer(async (req, res) => {
  if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Invalid local host.' })); }
  const nonce = randomBytes(18).toString('base64');
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}'${production ? '' : " 'unsafe-eval'"}; style-src 'self'${production ? ` 'nonce-${nonce}'` : " 'unsafe-inline'"}; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
  req.headers['content-security-policy'] = csp; req.headers['x-studio-nonce'] = nonce;
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.url === '/' && req.method === 'GET') res.setHeader('Set-Cookie', `studio_session=${process.env.STUDIO_SESSION_TOKEN}; HttpOnly; SameSite=Strict; Path=/`);
  try { await handle(req, res); } catch { if (!res.headersSent) res.writeHead(500); res.end('The local application could not complete this request.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Eta Logics AI Creator Studio: http://127.0.0.1:${port} · Next.js · ${process.env.STUDIO_LIVE_ENABLED==='true'?'LIVE CONFIGURATION · paid consent required':'SIMULATION ONLY'}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await stopWorker(); await app.close(); process.exit(0); }));
