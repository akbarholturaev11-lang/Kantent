import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStorytellingEpisode } from './storytelling-plan.mjs';
import { validateLessonPresentation } from './lesson-presentation-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function dateInTimezone(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function auditPlanningBuffer(calendar, { today, episodeIsReady = () => true } = {}) {
  if (!calendar || !Array.isArray(calendar.items)) throw new Error('Missing calendar.items');
  if (!ISO_DATE.test(today ?? '')) throw new Error('today must be YYYY-MM-DD');
  const min = calendar.planningBuffer?.minimumFutureEpisodes;
  const target = calendar.planningBuffer?.targetFutureEpisodes;
  if (!Number.isInteger(min) || !Number.isInteger(target) || min < 1 || target < min) {
    throw new Error('Invalid calendar.planningBuffer (expected 1 <= minimum <= target)');
  }
  const future = calendar.items
    .filter(item => item?.status === 'planned' && ISO_DATE.test(item.date ?? '') && item.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const missing = [];
  const ready = [];
  for (const item of future) {
    if (typeof item.episodeFile !== 'string' || !/^episodes\/[a-z0-9][a-z0-9-]*\.json$/.test(item.episodeFile)) {
      missing.push({ date: item.date, id: item.id, reason: 'invalid episode path' });
    } else if (!episodeIsReady(item)) {
      missing.push({ date: item.date, id: item.id, reason: 'episode missing or not draft-ready' });
    } else {
      ready.push({ date: item.date, id: item.id, file: item.episodeFile });
    }
  }
  return {
    date: today,
    timezone: calendar.timezone,
    minimumFutureEpisodes: min,
    targetFutureEpisodes: target,
    readyFutureEpisodes: ready.length,
    status: ready.length < min ? 'below-minimum' : ready.length < target ? 'replenish' : 'healthy',
    shortfallToTarget: Math.max(0, target - ready.length),
    ready,
    missing,
    note: 'Read-only audit. No scenario, date, hook, CTA, video, or publication was modified.',
  };
}

export function isDraftReady(rootDirectory, item) {
  const file = path.join(rootDirectory, 'content', item.episodeFile);
  try {
    const episode = JSON.parse(fs.readFileSync(file, 'utf8'));
    const visualSystem = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'content', 'visual-system.json'), 'utf8'));
    validateLessonPresentation(episode, visualSystem.lessonPresentation);
    const sources = episode.learningFactSources;
    const scenes = episode.scenes;
    return episode.id === item.id && episode.date === item.date &&
      episode.timezone === 'Asia/Shanghai' && episode.languageCode === 'ru-RU' &&
      typeof episode.topic === 'string' && episode.topic.trim().length > 0 &&
      Number.isFinite(episode.durationTargetSec) && episode.durationTargetSec > 0 &&
      Array.isArray(episode.learningFacts) && episode.learningFacts.length > 0 &&
      Array.isArray(episode.examples) && episode.examples.length > 0 &&
      Array.isArray(sources) && sources.length > 0 &&
      sources.every(source =>
        typeof source.title === 'string' && source.title.trim().length > 0 &&
        typeof source.url === 'string' && source.url.startsWith('https://') &&
        /^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt) &&
        typeof source.supports === 'string' && source.supports.trim().length > 0) &&
      !Object.hasOwn(episode, 'cta') && !Object.hasOwn(episode, 'ctaExperiment') &&
      episode.hookExperiment?.id && episode.hookExperiment?.hypothesis &&
      ['question', 'contrast', 'scenario'].includes(episode.hookExperiment.formatId) &&
      Array.isArray(scenes) && scenes.length >= 3 &&
      scenes.every(scene =>
        scene.kind !== 'cta' && typeof scene.narration === 'string' &&
        scene.narration.trim().length > 0 &&
        Array.isArray(scene.cards) && scene.cards.length > 0 &&
        scene.cards.every(card =>
          typeof card.hanzi === 'string' && card.hanzi.trim() &&
          typeof card.pinyin === 'string' && card.pinyin.trim() &&
          typeof card.meaning === 'string' && card.meaning.trim())) &&
      validateStorytellingEpisode(episode).length === 0;
  } catch {
    return false;
  }
}

function parseArgs(args) {
  const options = { json: false, date: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') options.json = true;
    else if (args[i] === '--date') options.date = args[++i];
    else if (args[i] === '--help') return { help: true };
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  return options;
}

export function runCli(args = process.argv.slice(2), directory = root) {
  const options = parseArgs(args);
  if (options.help) {
    console.log('Usage: node scripts/self-improvement-check.mjs [--date YYYY-MM-DD] [--json]');
    return 0;
  }
  const calendar = JSON.parse(fs.readFileSync(path.join(directory, 'content/calendar.json'), 'utf8'));
  const today = options.date ?? dateInTimezone(new Date(), calendar.timezone);
  const report = auditPlanningBuffer(calendar, { today, episodeIsReady: item => isDraftReady(directory, item) });
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else console.log(`Planning buffer (${report.date}, ${report.timezone}): ${report.readyFutureEpisodes}/${report.targetFutureEpisodes} ready future episodes; ${report.status}; ${report.shortfallToTarget} to add. Missing: ${report.missing.length}.`);
  return report.status === 'below-minimum' ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = runCli(); }
  catch (error) { console.error(`Planning buffer audit failed: ${error.message}`); process.exitCode = 1; }
}
