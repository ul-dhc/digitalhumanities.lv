import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const headers = ['record_id', 'language', 'translation_id', 'content_type', 'title', 'slug', 'published_at', 'event_date', 'summary', 'body_markdown', 'image_url', 'image_alt', 'external_url', 'featured', 'status', 'project_id', 'series_id', 'speakers', 'event_time', 'timezone', 'location', 'registration_url', 'recording_url'];
const csv = rows => [headers, ...rows.map(row => headers.map(key => row[key] ?? ''))].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
// Sheets exports unquoted header names.
const sheet = rows => headers.join(',') + '\n' + csv(rows).split('\n').slice(1).join('\n');
const row = overrides => ({ language: 'lv', translation_id: 'test', content_type: 'news', title: 'Test', slug: 'test', published_at: '2026-10-13', status: 'published', ...overrides });

async function run(projects, seminars, malformed = false) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dh-sync-'));
  try {
    await fs.mkdir(path.join(dir, 'scripts'));
    await fs.mkdir(path.join(dir, 'src/data'), { recursive: true });
    await fs.copyFile(new URL('../src/data/institutions.json', import.meta.url), path.join(dir, 'src/data/institutions.json'));
    const responses = { '2026101301': malformed ? '<html>Sign in</html>' : sheet(projects), '2026101302': sheet(seminars), '548994246': sheet([]), '341542364': sheet([]) };
    const mock = `globalThis.fetch = async input => { const url = new URL(input); if (url.hostname === 'script.google.com') return new Response(JSON.stringify({ok:true,data:[]}), {headers:{'content-type':'application/json'}}); return new Response(${JSON.stringify(responses)}[url.searchParams.get('gid')], {headers:{'content-type':'text/csv'}}); };\n`;
    const source = await fs.readFile(new URL('./sync-google-sheets.mjs', import.meta.url), 'utf8');
    await fs.writeFile(path.join(dir, 'scripts/sync.mjs'), mock + source);
    const result = spawnSync(process.execPath, [path.join(dir, 'scripts/sync.mjs')], { encoding: 'utf8' });
    const read = async name => JSON.parse(await fs.readFile(path.join(dir, 'src/data', name + '.json'), 'utf8'));
    return { result, projects: result.status === 0 ? await read('project-entries') : null, seminars: result.status === 0 ? await read('seminar-entries') : null, entries: result.status === 0 ? await read('new-entries') : null };
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

test('imports bilingual project updates and seminar details; ignores empty checkbox rows', async () => {
  const output = await run([row({ body_markdown: 'First paragraph, with comma.\n\n**Second paragraph**' }), row({ language: 'en' }), { featured: 'FALSE' }], [row({ translation_id: 'workshop', slug: 'workshop', content_type: 'seminar', event_date: '2026-11-03', speakers: 'Speaker', event_time: '14:00', location: 'Riga', registration_url: 'https://example.com/register', recording_url: 'https://example.com/video' }), { featured: 'FALSE' }]);
  assert.equal(output.result.status, 0, output.result.stderr);
  assert.equal(output.projects.length, 2);
  assert.equal(output.projects[0].record_id, 'test-lv');
  assert.match(output.projects[0].archive_url, /\/lv\/projekti\/digilate\/#test$/);
  assert.match(output.projects[1].archive_url, /\/en\/projects\/digilate\/#test$/);
  assert.equal(output.projects[0].body_markdown, 'First paragraph, with comma.\n\n**Second paragraph**');
  assert.equal(output.seminars.length, 1);
  assert.equal(output.seminars[0].timezone, 'Europe/Riga');
  assert.equal(output.seminars[0].speakers, 'Speaker');
  assert.equal(output.seminars[0].registration_url, 'https://example.com/register');
  assert.equal(output.entries[0].record_id, 'workshop-lv');
  assert.match(output.entries[0].archive_url, /\/lv\/seminari\/#workshop$/);
});

test('keeps draft status and rejects a non-CSV response instead of silently clearing data', async () => {
  const draft = await run([row({ status: 'draft' })], []);
  assert.equal(draft.projects[0].status, 'draft');
  const failed = await run([], [], true);
  assert.notEqual(failed.result.status, 0);
  assert.match(failed.result.stderr, /CSV galvene/);
});
