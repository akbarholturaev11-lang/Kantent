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
test('counts only complete sourced CTA-free drafts with matching identity', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsk-feedback-'));
  try {
    fs.mkdirSync(path.join(tmp, 'content/episodes'), { recursive: true });
    const item = { id: 'ep', date: '2026-10-12', episodeFile: 'episodes/ep.json' };
    const file = path.join(tmp, 'content/episodes/ep.json');
    const card = { hanzi: '我在家。', pinyin: 'Wǒ zài jiā.', meaning: 'Я дома.' };
    const complete = {
      id: item.id, date: item.date, timezone: 'Asia/Shanghai',
      languageCode: 'ru-RU', topic: '在', durationTargetSec: 30,
      learningFacts: ['在 denotes location'], examples: ['我在家。'],
      learningFactSources: [{
        title: 'Location reference', url: 'https://example.org/grammar/zai',
        checkedAt: '2026-10-11', supports: 'subject + 在 + place',
      }],
      hookExperiment: { id: 'hook-v1', formatId: 'scenario', hypothesis: 'Show location before explaining.' },
      scenes: [
        { kind: 'hook', narration: 'Где ты?', cards: [card] },
        { kind: 'context', narration: 'Здесь нужна 在.', cards: [card] },
        { kind: 'example', narration: 'Я дома.', cards: [card] },
      ],
    };
    const write = (episode) => fs.writeFileSync(file, JSON.stringify(episode));
    write(complete);
    assert.equal(Boolean(isDraftReady(tmp, item)), true);
    write({ ...complete, learningFactSources: [] });
    assert.equal(Boolean(isDraftReady(tmp, item)), false, 'no checked source means not ready');
    write({ ...complete, scenes: [{ kind: 'hook', narration: 'Что?' }] });
    assert.equal(Boolean(isDraftReady(tmp, item)), false, 'placeholder scene means not ready');
    write({ ...complete, cta: { text: 'duplicate' } });
    assert.equal(Boolean(isDraftReady(tmp, item)), false, 'CTA must come from central registry');
    write({ ...complete, id: 'wrong' });
    assert.equal(Boolean(isDraftReady(tmp, item)), false, 'identity mismatch');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
test('invalid buffer config is rejected', () => {
  const calendar = makeCalendar([]);
  calendar.planningBuffer.minimumFutureEpisodes = 5;
  assert.throws(() => auditPlanningBuffer(calendar, { today: '2026-10-09' }), /Invalid/);
});
