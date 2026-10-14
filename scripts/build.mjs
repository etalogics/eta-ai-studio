import { spawnSync } from 'node:child_process';
import path from 'node:path';
const build = spawnSync(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'build', '--webpack'], {
  stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
});
if (build.error) console.error(build.error.message);
process.exit(build.status ?? 1);
