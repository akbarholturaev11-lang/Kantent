import { confirmedPublishedFor, confirmedPublishedInAllLanguages } from "./published-evidence.mjs";
import { requireFreshGitMain } from './git-freshness.mjs';
import { requestedLanguages, prepareLanguagePackages } from "./bilingual-production.mjs";
import { languageEnvironment, languageSettings } from "./language-context.mjs";
import { resolveTodayVideo } from "./resolve-production-date.mjs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  PROJECT_ROOT,
  CALENDAR_PATH,
  getCalendarItem,
  getCalendarItemByDate,
  getRunEpisodeByDate,
  requireApprovedVoiceProfile,
  readStatus,
  readJson,
  reviewDir,
  narrationHash,
  writeJson,
} from "./lib.mjs";

const input = process.argv[2];
if (!input) {
  throw new Error("Foydalanish: npm run content:make -- today|YYYY-MM-DD|episode-ID [--language all|ru|tg]");
}

const args = process.argv.slice(3);
let selectedLanguage = process.env.HSK_CONTENT_LANGUAGE ?? "all";
if (args.length) {
  if (args.length === 2 && args[0] === "--language") selectedLanguage = args[1];
  else if (args.length === 1 && args[0].startsWith("--language=")) selectedLanguage = args[0].slice(11);
  else throw new Error("Only --language all|ru|tg is supported after the date/ID.");
}
const languages = requestedLanguages(selectedLanguage);

const sourceRevision = requireFreshGitMain();
console.log('GitHub source verified:', sourceRevision.remoteMainSha);

let resolved;
if (input === "today") {
  resolved = resolveTodayVideo(await readJson(CALENDAR_PATH), new Date(), { confirmedPublishedEpisodeIds: confirmedPublishedInAllLanguages(languages) });
  console.log(`Calendar ${resolved.timezone}: ${resolved.requestedDate} -> ${resolved.selectedDate} (${resolved.selection})`);
}
const item = resolved ? await getCalendarItemByDate(resolved.selectedDate) : /^\d{4}-\d{2}-\d{2}$/.test(input)
  ? await getCalendarItemByDate(input)
  : await getCalendarItem(input);
const result = await prepareLanguagePackages(languages, async (language) => {
  const published = confirmedPublishedFor(item.id);
  if (published.length) return { status: { stage: "externally-verified-published", records: published }, reviewFolder: reviewDir(item.id) };
  const { episode } = await getRunEpisodeByDate(item.date);
  const voiceProfile = await requireApprovedVoiceProfile(item.id);
  if (episode.voiceProvider !== voiceProfile.provider)
    throw new Error("Episode voice provider does not match " + languageSettings().voiceProfilePath);

  const folder = reviewDir(item.id);
  const hasImportedVoice =
    episode.audioSrc &&
    episode.voiceProfileId === voiceProfile.profileId &&
    episode.voiceTextHash === narrationHash(episode) &&
    episode.captionSource === "gemini-word-timestamps" &&
    episode.captions?.length;
  const runStage = (script) => {
    const result = spawnSync(
      process.execPath,
      [path.join(PROJECT_ROOT, "scripts", script), item.id],
      { cwd: PROJECT_ROOT, stdio: "inherit", env: languageEnvironment(language) },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(script + " завершился с ошибкой.");
  };

  if (!hasImportedVoice) runStage("generate-voice-gemini.mjs");
  runStage("render-episode.mjs");
  console.log("Пакет готов для ручной проверки: " + folder);
  const status = await readStatus(item.id);
  for (const [platform, exported] of Object.entries(status.platformPackages ?? {})) {
    console.log(`${platform}: ${exported.video}`);
  }
  return { stage: "ready-for-review", reviewFolder: folder, status, sourceRevision };
});
await writeJson(path.join(PROJECT_ROOT, "review", item.id, "languages-status.json"), { date: item.date, episodeId: item.id, ...result });
console.log(JSON.stringify(result, null, 2));
if (!result.complete) process.exitCode = 1;
