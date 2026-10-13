import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await fs.writeFile(new URL('../dist/version.json', import.meta.url), JSON.stringify({
  commit,
  built_at: new Date().toISOString(),
  run_id: process.env.GITHUB_RUN_ID || 'local',
  run_attempt: process.env.GITHUB_RUN_ATTEMPT || '1',
}) + '\n');
console.log(`Deployment version: ${commit}`);
