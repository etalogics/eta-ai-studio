import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
export function openStore(root = process.cwd(), directory = process.env.STUDIO_DATA_DIR || 'data') {
  const data = path.resolve(root,directory); mkdirSync(path.join(data,'references'),{recursive:true});mkdirSync(path.join(data,'outputs'),{recursive:true});
  const db = new DatabaseSync(path.join(data,'studio.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
  try {
    const version=db.prepare('PRAGMA user_version').get().user_version;if(version>2)throw new Error('Database schema is newer than this app.');
    if(version<1)db.exec(readFileSync(path.join(root,'db/migrations/001-initial.sql'),'utf8'));
    if(version<2)db.exec(readFileSync(path.join(root,'db/migrations/002-provider-jobs.sql'),'utf8'));
    db.exec('COMMIT;');return {db,data};
  } catch(error){db.exec('ROLLBACK;');db.close();throw error;}
}
