import { DatabaseSync } from 'node:sqlite';
import { statusAt, LIVE_MODEL } from '../lib.mjs';
import { openStore } from '../db/store.mjs';

export type Asset = { id: string; filename: string; mime: string; stored: string };
export type Draft = { prompt: string; model: string; duration: number; ratio: string; references: string[]; simulateFailure?: boolean };
export type JobRow = { id: string; token: string; created: number; settings: string };
type Store = { db: DatabaseSync; data: string };
const globalStore = globalThis as typeof globalThis & { studioStore?: Store };
export function getStore(): Store {
  if (globalStore.studioStore) return globalStore.studioStore;
  return globalStore.studioStore = openStore();
}
export function asset(id: string): Asset | undefined { return getStore().db.prepare('SELECT * FROM assets WHERE id=?').get(id) as Asset | undefined; }
export function jobView(row: JobRow) {
  const job = { id: row.id, created: row.created, settings: JSON.parse(row.settings) as Draft };
  if (job.settings.model === LIVE_MODEL.id) {
    const provider = getStore().db.prepare('SELECT state,request_id,error FROM provider_jobs WHERE job_id=?').get(row.id) as {state:string;request_id:string|null;error:string|null} | undefined;
    const state = provider?.state || 'failed';
    const status = ['pending','queued','uploading','submitting'].includes(state) ? 'pending' : ['processing','downloading'].includes(state) ? 'processing' : state;
    return {...job,status,mode:'live',providerRequestId:provider?.request_id || null,output:status==='completed'?`/api/output/${job.id}`:null,error:provider?.error || null};
  }
  const status = statusAt(job);
  return { ...job, status, mode: 'simulation', output: status === 'completed' ? `/api/output/${job.id}` : null, error: status === 'failed' ? 'Simulated provider failure. No paid request was sent.' : null };
}
