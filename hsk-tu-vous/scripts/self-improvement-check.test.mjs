import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditPlanningBuffer, dateInTimezone, isDraftReady } from './self-improvement-check.mjs';

const makeCalendar = (dates) => ({ timezone: 'Asia/Shanghai', planningBuffer: { minimumFutureEpisodes: 3, targetFutureEpisodes: 4 }, items: dates.map((date, i) => ({ date, id: `ep-${i}`, status: 'planned', episodeFile: `episodes/ep-${i}.json` })) });

test('uses calendar timezone, not the runner timezone', () => {
  assert.equal(dateInTimezone(new Date('2026-10-09T16:30:00Z'), 'Asia/Shanghai'), '2026-10-10');
});
test('ignores today and past entries and reports shortfall accurately', () => {
  const report = auditPlanningBuffer(makeCalendar(['2026-10-08', '2026-10-09', '2026-10-12', '2026-10-14']), { today: '2026-10-09' });
  assert.equal(report.readyFutureEpisodes, 2);
  assert.equal(report.shortfallToTarget, 2);
  assert.equal(report.status, 'below-minimum');
});
test('distinguishes minimum coverage from target', () => {
  const report = auditPlanningBuffer(makeCalendar(['2026-10-12', '2026-10-14', '2026-10-16']), { today: '2026-10-09' });
  assert.equal(report.status, 'replenish');
  assert.equal(report.shortfallToTarget, 1);
});
test('does not count a missing or invalid episode as ready', () => {
  const calendar = makeCalendar(['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19']);
  const report = auditPlanningBuffer(calendar, { today: '2026-10-09', episodeIsReady: item => item.id !== 'ep-2' });
  assert.equal(report.readyFutureEpisodes, 3);
  assert.equal(report.missing[0].id, 'ep-2');
});
test('does not treat already published slots as future drafts', () => {
  const calendar = makeCalendar(['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19']);
  calendar.items[0].status = 'published';
  assert.equal(auditPlanningBuffer(calendar, { today: '2026-10-09' }).status, 'replenish');
});
test('checks the actual lesson identity and narration', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsk-feedback-'));
  try {
    fs.mkdirSync(path.join(tmp, 'content/episodes'), { recursive: true });
    const item = { id: 'ep', date: '2026-10-12', episodeFile: 'episodes/ep.json' };
    const file = path.join(tmp, 'content/episodes/ep.json');
    fs.writeFileSync(file, JSON.stringify({ id: 'ep', date: '2026-10-12', topic: '在', hookExperiment: { id: 'h1' }, scenes: [{ kind: 'lesson', narration: 'Я дома.' }] }));
    assert.equal(Boolean(isDraftReady(tmp, item)), true);
    fs.writeFileSync(file, JSON.stringify({ id: 'wrong', date: '2026-10-12', topic: '在', hookExperiment: { id: 'h1' }, scenes: [{ kind: 'lesson', narration: 'Я дома.' }] }));
    assert.equal(isDraftReady(tmp, item), false);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
test('invalid buffer config is rejected', () => {
  const calendar = makeCalendar([]);
  calendar.planningBuffer.minimumFutureEpisodes = 5;
  assert.throws(() => auditPlanningBuffer(calendar, { today: '2026-10-09' }), /Invalid/);
});
