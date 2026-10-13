import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const source = await fs.readFile(new URL('./verify-deployment.mjs', import.meta.url), 'utf8');
function verify(versions) {
  const mock = `let attempts = 0; globalThis.setTimeout = cb => queueMicrotask(cb); globalThis.fetch = async () => new Response(JSON.stringify(${JSON.stringify(versions)}[Math.min(attempts++, ${versions.length - 1})]));\n`;
  return spawnSync(process.execPath, ['--input-type=module', '--eval', mock + source], {
    encoding: 'utf8', env: { ...process.env, EXPECTED_COMMIT: 'new-commit', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2' },
  });
}
test('waits for fresh spreadsheet build even when commit has not changed', () => {
  const result = verify([
    { commit: 'new-commit', run_id: '123', run_attempt: '1' },
    { commit: 'new-commit', run_id: '123', run_attempt: '2' },
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /earlier build/);
  assert.match(result.stdout, /Verified live deployment/);
});
test('does not report success when the public site still serves old code', () => {
  const result = verify([{ commit: 'old-commit', run_id: '122', run_attempt: '1' }]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Verification 6\/6/);
});
