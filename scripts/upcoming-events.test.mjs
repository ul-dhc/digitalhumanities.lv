import assert from 'node:assert/strict';
import test from 'node:test';
import { getUpcomingEvents, rigaDate } from '../src/utils/upcoming-events.mjs';

const event = (id, date, extra = {}) => ({ record_id: id, event_date: date,
  language: 'lv', status: 'published', content_type: 'seminar', ...extra });

test('selects the nearest published event in the requested language, ignoring old events and news', () => {
  const records = [event('later', '2027-03-11'), event('past', '2026-11-23'),
    event('next', '2026-12-09'), event('draft', '2026-11-25', { status: 'draft' }),
    event('english', '2026-11-25', { language: 'en' }),
    event('cfp', '2026-11-25', { content_type: 'news' })];
  assert.deepEqual(getUpcomingEvents(records, 'lv', '2026-11-24').map(e => e.record_id), ['next', 'later']);
});
test('keeps today, switches after the event date, and returns no event when all have passed', () => {
  const records = [event('first', '2026-12-09'), event('second', '2026-12-10')];
  assert.equal(getUpcomingEvents(records, 'lv', '2026-12-09')[0].record_id, 'first');
  assert.equal(getUpcomingEvents(records, 'lv', '2026-12-10')[0].record_id, 'second');
  assert.equal(getUpcomingEvents(records, 'lv', '2026-12-11').length, 0);
});
test('merges duplicate IDs and keeps the richer seminar record', () => {
  const old = event('same', '2026-12-09');
  const rich = { ...old, registration_url: 'https://example.com/register' };
  assert.deepEqual(getUpcomingEvents([old, rich], 'lv', '2026-11-24'), [rich]);
});
test('uses the Riga calendar day even before UTC midnight', () => {
  assert.equal(rigaDate(new Date('2026-12-08T22:30:00Z')), '2026-12-09');
});

test('prioritises a featured upcoming event and removes that priority after its date', () => {
  const records = [event('music', '2026-12-04'), event('clarin', '2026-12-09', { featured: true })];
  assert.equal(getUpcomingEvents(records, 'lv', '2026-11-24')[0].record_id, 'clarin');
  assert.equal(getUpcomingEvents(records, 'lv', '2026-12-10').length, 0);
});
