import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStorytellingEpisode } from './storytelling-plan.mjs';
import { validateLessonPresentation } from './lesson-presentation-policy.mjs';
import { validateSeriesCalendar } from './series-plan.mjs';
import {contentTypeOf,weeklyCoverage} from './content-schedule.mjs';
import {reviewPromoVariants} from './promo-plan.mjs';
import { readLanguages, assertLocalizedLessonSource } from './language-context.mjs';

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
  const seriesErrors = validateSeriesCalendar(calendar);
  if (seriesErrors.length) throw Error(seriesErrors.join('\n'));
  if (!ISO_DATE.test(today ?? '')) throw new Error('today must be YYYY-MM-DD');
  const min = calendar.planningBuffer?.minimumFutureEpisodes;
  const target = calendar.planningBuffer?.targetFutureEpisodes;
  if (!Number.isInteger(min) || !Number.isInteger(target) || min < 1 || target < min) {
    throw new Error('Invalid calendar.planningBuffer (expected 1 <= minimum <= target)');
  }
  if(calendar.weeklySchedule) {
    const slots=weeklyCoverage(calendar,{today,count:target,itemIsReady:episodeIsReady});
    const ready=slots.filter(slot=>slot.ready).map(slot=>({date:slot.date,id:slot.item.id,contentType:slot.contentType,
      file:slot.item.episodeFile??slot.item.promoFile}));
    const missing=slots.filter(slot=>!slot.ready).map(({item,...slot})=>({...slot,id:item?.id,
      existing:Boolean(item),status:item?.status}));
    return {date:today,timezone:calendar.timezone,minimumFutureEpisodes:min,targetFutureEpisodes:target,
      expectedFutureSlots:slots.length,readyFutureEpisodes:ready.length,weeklyCoverage:true,
      status:ready.length<min?'below-minimum':missing.length?'replenish':'healthy',
      shortfallToTarget:missing.length,ready,missing,
      note:'Read-only source coverage of the next content slots, including complete serial sets; distant lessons cannot hide an unplanned ad/weekend. No media or social posts were created.'};
  }
  const future = calendar.items
    .filter(item => item?.status === 'planned' && ISO_DATE.test(item.date ?? '') && item.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const missing = [];
  const ready = [];
  const checked = new Map();
  const check = item => {
    if (!checked.has(item.id)) {
      const result = episodeIsReady(item);
      checked.set(item.id, typeof result === 'boolean' ? { ready: result } : result);
    }
    return checked.get(item.id);
  };
  for (const item of future) {
    if (typeof item.episodeFile !== 'string' || !/^episodes\/[a-z0-9][a-z0-9-]*\.json$/.test(item.episodeFile)) {
      missing.push({ date: item.date, id: item.id, reason: 'invalid episode path' });
    } else if (item.series && calendar.items.some(peer => peer.series?.id === item.series.id &&
        peer.status === 'planned' && peer.date > today && !check(peer)?.ready)) {
      missing.push({ date: item.date, id: item.id, reason: 'series draft set incomplete; repair all remaining parts before counting the series ready' });
    } else if (!check(item)?.ready) {
      missing.push({ date: item.date, id: item.id, reason: check(item)?.reason ?? 'episode missing or not draft-ready',
        ...(check(item)?.languages ? { languages: check(item).languages } : {}) });
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

/**
 * Evaluate the actual configured production languages, not the presence of a
 * Russian calendar row. This is static source readiness, NOT a TTS/MP4 gate.
 * Voice/caption cues and human editorial verification remain separate.
 */
function checkLessonSource(episode, item, languageCode, visualSystem, { localized = false } = {}) {
  if (episode.id !== item.id || episode.date !== item.date ||
      episode.timezone !== 'Asia/Shanghai' || episode.languageCode !== languageCode)
    throw Error('episode identity, timezone or language mismatch');
  if (!episode.topic?.trim() || !Number.isFinite(episode.durationTargetSec) || episode.durationTargetSec <= 0 ||
      !Array.isArray(episode.learningFacts) || !episode.learningFacts.length ||
      !Array.isArray(episode.examples) || !episode.examples.length)
    throw Error('missing learning fact, examples, topic or duration');
  if (!Array.isArray(episode.learningFactSources) || !episode.learningFactSources.length ||
      !episode.learningFactSources.every(source =>
        typeof source.title === 'string' && source.title.trim() &&
        typeof source.url === 'string' && source.url.startsWith('https://') &&
        ISO_DATE.test(source.checkedAt ?? '') &&
        typeof source.supports === 'string' && source.supports.trim()))
    throw Error('missing source URL/checkedAt/supports; verify external references independently');
  if (Object.hasOwn(episode, 'cta') || Object.hasOwn(episode, 'ctaExperiment') ||
      episode.scenes?.some(scene => scene.kind === 'cta'))
    throw Error('future canonical/localized lesson must be CTA-free');
  if (!episode.hookExperiment?.id || !episode.hookExperiment?.hypothesis ||
      !['question','contrast','scenario'].includes(episode.hookExperiment.formatId))
    throw Error('missing registered hook hypothesis/format');
  if (!Array.isArray(episode.scenes) || episode.scenes.length < 3 ||
      !episode.scenes.every(scene => typeof scene.narration === 'string' && scene.narration.trim()))
    throw Error('incomplete teaching narration');
  validateLessonPresentation(episode, visualSystem.lessonPresentation);
  if (episode.date < visualSystem.lessonPresentation.effectiveFromDate &&
      !episode.scenes.every(scene => Array.isArray(scene.cards) && scene.cards.length &&
        scene.cards.every(card => typeof card.hanzi === 'string' && card.hanzi.trim() &&
          typeof card.pinyin === 'string' && card.pinyin.trim() &&
          typeof card.meaning === 'string' && card.meaning.trim())))
    throw Error('legacy lesson missing complete teaching cards');
  if (validateStorytellingEpisode(episode).length)
    throw Error('invalid authored storytelling metadata');
  if (episode.date >= visualSystem.lessonPresentation.effectiveFromDate &&
      (!episode.storytelling?.situation || !episode.storytelling?.selectionReason ||
       !episode.storytelling?.firstPayoff || !Array.isArray(episode.storytelling?.reHooks)))
    throw Error('new action lesson missing topic-authored storytelling situation/selection/payoff');
  if (localized && (!episode.localization || !episode.localization.status))
    throw Error('missing translation status/source binding');
}

export function inspectDraftReadiness(rootDirectory, item) {
  const languages = {};
  try {
    if (contentTypeOf(item) === 'advertisement') {
      if(item.promoFile !== `promos/${item.id}.json`) throw Error('invalid promo path');
      const report=reviewPromoVariants(item.id,{root:rootDirectory});
      return {ready:report.plansComplete, languages:report.variants,
        ...(report.plansComplete?{}:{reason:'complete source-bound promo plans required in every default language'})};
    }
    if (typeof item?.episodeFile !== 'string' ||
        !/^episodes\/[a-z0-9][a-z0-9-]*\.json$/.test(item.episodeFile))
      throw Error('invalid canonical episode path');
    const config = readLanguages(rootDirectory);
    const visualSystem = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'content/visual-system.json'), 'utf8'));
    const readEpisode = (contentRoot) => JSON.parse(fs.readFileSync(path.join(rootDirectory, contentRoot, item.episodeFile), 'utf8'));
    const canonical = readEpisode(config.languages.ru.contentRoot);
    for (const language of config.defaultProductionLanguages) {
      try {
        const settings = config.languages[language];
        const episode = language === 'ru' ? canonical : readEpisode(settings.contentRoot);
        if (language !== 'ru') assertLocalizedLessonSource(episode, canonical, language);
        checkLessonSource(episode, item, settings.languageCode, visualSystem, { localized: language !== 'ru' });
        languages[language] = { ready: true };
      } catch (error) {
        languages[language] = { ready: false, reason: error.message };
      }
    }
    const failed = Object.entries(languages).filter(([,value]) => !value.ready);
    return { ready: failed.length === 0, languages,
      ...(failed.length ? { reason: failed.map(([lang, value]) => lang + ': ' + value.reason).join('; ') } : {}) };
  } catch (error) {
    return { ready: false, languages, reason: 'source/configuration: ' + error.message };
  }
}

export function isDraftReady(rootDirectory, item) {
  return inspectDraftReadiness(rootDirectory, item).ready;
}

/** Compatibility entry for checks explicitly scoped to the canonical Russian source. */
export function isCanonicalDraftReady(rootDirectory, item) {
  try {
    const episode = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'content', item.episodeFile), 'utf8'));
    const visual = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'content/visual-system.json'), 'utf8'));
    checkLessonSource(episode, item, 'ru-RU', visual);
    return true;
  } catch { return false; }
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
  const report = auditPlanningBuffer(calendar, { today, episodeIsReady: item => inspectDraftReadiness(directory, item) });
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else console.log(`Multilingual source buffer (${report.date}, ${report.timezone}): ${report.readyFutureEpisodes}/${report.targetFutureEpisodes} ready future episodes; ${report.status}; ${report.shortfallToTarget} shortfall. Missing: ${report.missing.length}.\n${report.missing.map(m => `${m.date} ${m.id}: ${m.reason}`).join('\n')}`);
  return report.status === 'below-minimum' ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = runCli(); }
  catch (error) { console.error(`Planning buffer audit failed: ${error.message}`); process.exitCode = 1; }
}
