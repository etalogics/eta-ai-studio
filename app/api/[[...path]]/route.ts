import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { z } from 'zod';
import { MODEL, imageType, validateDraft } from '../../../lib.mjs';
import { readProviderConfig, publicProviderStatus } from '../../../provider-config.mjs';
import { asset, getStore, jobView, type JobRow } from '../../../lib/studio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const uploadSchema = z.object({ filename: z.string().min(1).max(200), bytes: z.string().min(1).max(14 * 1024 * 1024) });
const draftSchema = z.object({ prompt: z.string().max(6000), model: z.string(), duration: z.number(), ratio: z.string(), references: z.array(z.string().uuid()).max(8), simulateFailure: z.boolean().optional() });
const submissionSchema = draftSchema.extend({ token: z.string().regex(/^[a-zA-Z0-9-]{16,80}$/) });
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function readJSON(req: NextRequest): Promise<unknown> {
  if (!req.body) throw new Error('Missing JSON body.');
  const reader = req.body.getReader(); let total = 0; const chunks: Uint8Array[] = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; total += value.length; if (total > 15 * 1024 * 1024) { await reader.cancel(); throw new Error('Request exceeds the upload size limit.'); } chunks.push(value); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Invalid JSON request.'); }
}
function fileResponse(req: NextRequest, file: string, type: string, download = false): Response {
  const size = statSync(file).size;
  const headers: Record<string, string> = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  if (download) headers['Content-Disposition'] = 'attachment; filename="studio-simulation.mp4"';
  const range = req.headers.get('range')?.match(/^bytes=(\d+)-(\d*)$/);
  let start = 0; let end = size - 1; let status = 200;
  if (range) {
    start = Number(range[1]); end = Math.min(range[2] ? Number(range[2]) : size - 1, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = String(end - start + 1);
  return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status, headers });
}
async function handle(req: NextRequest): Promise<Response> {
  const port = process.env.PORT || '4310';
  if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.get('host') || '')) return json({ error: 'Invalid local host.' }, 403);
  if (!process.env.STUDIO_SESSION_TOKEN || req.cookies.get('studio_session')?.value !== process.env.STUDIO_SESSION_TOKEN) return json({ error: 'Open the studio locally to establish a session.' }, 401);
  if (req.method !== 'GET' && (![ `http://127.0.0.1:${port}`, `http://localhost:${port}` ].includes(req.headers.get('origin') || '') || req.headers.get('x-studio-csrf') !== process.env.STUDIO_CSRF_TOKEN || req.headers.get('content-type') !== 'application/json')) return json({ error: 'Invalid local request protection. Refresh the page.' }, 403);
  const url = req.nextUrl; const endpoint = url.pathname;
  try {
    const { db, data } = getStore();
    if (endpoint === '/api/bootstrap' && req.method === 'GET') {
      const saved = db.prepare("SELECT value FROM settings WHERE key='draft'").get() as { value: string } | undefined;
      return json({ csrf: process.env.STUDIO_CSRF_TOKEN, model: MODEL, mode: 'simulation', draft: JSON.parse(saved?.value || 'null') });
    }
    if (endpoint === '/api/provider' && req.method === 'GET') return json(publicProviderStatus(readProviderConfig()));
    if (endpoint === '/api/assets' && req.method === 'POST') {
      const input = uploadSchema.parse(await readJSON(req)); const bytes = Buffer.from(input.bytes, 'base64');
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('Each image must be smaller than 10 MB.');
      const [mime, ext] = imageType(bytes); const id = randomUUID(); const stored = id + ext; const file = path.join(data, 'references', stored);
      writeFileSync(file + '.tmp', bytes); renameSync(file + '.tmp', file);
      const filename = path.basename(input.filename); db.prepare('INSERT INTO assets VALUES(?,?,?,?)').run(id, filename, mime, stored);
      return json({ id, filename, url: `/api/assets/${id}` }, 201);
    }
    if (endpoint.startsWith('/api/assets/') && req.method === 'GET') {
      const row = asset(endpoint.split('/')[3]); if (!row) return json({ error: 'Image not found.' }, 404);
      if (url.searchParams.has('metadata')) return json({ id: row.id, filename: row.filename, url: `/api/assets/${row.id}` });
      return fileResponse(req, path.join(data, 'references', row.stored), row.mime);
    }
    if (endpoint === '/api/draft' && req.method === 'POST') {
      const input = draftSchema.parse(await readJSON(req)); if (input.references.some(id => !asset(id))) throw new Error('Invalid draft references.');
      db.prepare("INSERT INTO settings VALUES('draft',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(input)); return json({ saved: true });
    }
    if (endpoint === '/api/jobs' && req.method === 'GET') return json((db.prepare('SELECT * FROM jobs ORDER BY created DESC LIMIT 200').all() as JobRow[]).map(jobView));
    if (endpoint === '/api/jobs' && req.method === 'POST') {
      const input = submissionSchema.parse(await readJSON(req)); const settings = validateDraft(input, (id: string) => Boolean(asset(id)));
      const existing = db.prepare('SELECT * FROM jobs WHERE token=?').get(input.token) as JobRow | undefined;
      if (existing) return json(jobView(existing));
      const id = randomUUID(); db.prepare('INSERT INTO jobs VALUES(?,?,?,?)').run(id, input.token, Date.now(), JSON.stringify(settings));
      return json(jobView(db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as JobRow), 201);
    }
    if (endpoint.startsWith('/api/output/') && req.method === 'GET') {
      const row = db.prepare('SELECT * FROM jobs WHERE id=?').get(endpoint.split('/')[3]) as JobRow | undefined;
      if (!row || jobView(row).status !== 'completed') return json({ error: 'No completed output available.' }, 404);
      const configured = JSON.parse(row.settings); const fixture = path.join(process.cwd(), 'fixtures', `simulation-${configured.ratio.replace(':', '-')}${configured.duration === 10 ? '-10s' : ''}.mp4`);
      if (!existsSync(fixture)) return json({ error: 'Simulation fixture is unavailable.' }, 503);
      return fileResponse(req, fixture, 'video/mp4', url.searchParams.has('download'));
    }
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: 'Invalid request fields. Check the prompt, settings, and reference images.' }, 400);
    return json({ error: error instanceof Error ? error.message : 'Request failed.' }, 400);
  }
}
export const GET = handle;
export const POST = handle;
