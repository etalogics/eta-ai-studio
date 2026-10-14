import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { readProviderConfig } from '../provider-config.mjs';
import { createHiggsfieldClient } from '../lib/higgsfield/adapter.mjs';
process.loadEnvFile('.env');
const config = readProviderConfig();
if (!config.credential) { console.log('No local credentials configured.'); process.exit(1); }
try {
  const result = await createHiggsfieldClient(config).verify();
  const db = new DatabaseSync(path.resolve(process.env.STUDIO_DATA_DIR || 'data','studio.sqlite'));
  const value = { ...result, checkedAt: new Date().toISOString(), fingerprint: config.fingerprint };
  db.prepare("INSERT INTO settings VALUES('provider-auth',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(value)); db.close();
  console.log(JSON.stringify({ accepted:result.accepted, httpStatus:result.httpStatus, paidRequests:0 }));
  if (!result.accepted) process.exitCode=1;
} catch { console.log('Provider verification could not complete. No paid request was sent.'); process.exitCode=1; }
