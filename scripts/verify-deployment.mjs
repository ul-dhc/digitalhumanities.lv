const expected = process.env.EXPECTED_COMMIT;
if (!expected) throw new Error('EXPECTED_COMMIT is required.');
const url = new URL('version.json', (process.env.SITE_URL || 'https://digitalhumanities.lv').replace(/\/?$/, '/'));
url.searchParams.set('commit', expected);
const runId = process.env.GITHUB_RUN_ID;
const runAttempt = process.env.GITHUB_RUN_ATTEMPT || '1';
if (runId) {
  url.searchParams.set('run', runId);
  url.searchParams.set('attempt', runAttempt);
}
for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const version = await response.json();
    if (version.commit !== expected) throw new Error(`Live commit is ${version.commit}, expected ${expected}.`);
    if (runId && (version.run_id !== runId || version.run_attempt !== runAttempt)) {
      throw new Error('Live content is from an earlier build of this commit.');
    }
    console.log(`Verified live deployment: ${expected}`);
    process.exit(0);
  } catch (error) {
    console.warn(`Verification ${attempt}/6: ${error.message}`);
    if (attempt === 6) throw error;
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
