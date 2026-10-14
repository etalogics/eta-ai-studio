import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { statusAt } from '../lib.mjs';

export type Asset = { id: string; filename: string; mime: string; stored: string };
export type Draft = { prompt: string; model: string; duration: number; ratio: string; references: string[]; simulateFailure?: boolean };
export type JobRow = { id: string; token: string; created: number; settings: string };
type Store = { db: DatabaseSync; data: string };
const globalStore = globalThis as typeof globalThis & { studioStore?: Store };
export function getStore(): Store {
  if (globalStore.studioStore) return globalStore.studioStore;
  const data = path.resolve(process.cwd(), process.env.STUDIO_DATA_DIR || 'data');
  mkdirSync(path.join(data, 'references'), { recursive: true });
  const db = new DatabaseSync(path.join(data, 'studio.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const version = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (version.user_version > 1) throw new Error('Database schema is newer than this app. Use a matching version.');
  if (version.user_version < 1) {
    db.exec('BEGIN IMMEDIATE;');
    try { db.exec(readFileSync(path.join(process.cwd(), 'db/migrations/001-initial.sql'), 'utf8')); db.exec('COMMIT;'); }
    catch (error) { db.exec('ROLLBACK;'); throw error; }
  }
  return globalStore.studioStore = { db, data };
}
export function asset(id: string): Asset | undefined { return getStore().db.prepare('SELECT * FROM assets WHERE id=?').get(id) as Asset | undefined; }
export function jobView(row: JobRow) {
  const job = { id: row.id, created: row.created, settings: JSON.parse(row.settings) as Draft };
  const status = statusAt(job);
  return { ...job, status, mode: 'simulation', output: status === 'completed' ? `/api/output/${job.id}` : null, error: status === 'failed' ? 'Simulated provider failure. No paid request was sent.' : null };
}
