import { assertNotPreviouslyPublished } from "./published-evidence.mjs";
import { requireFreshGitMain } from './git-freshness.mjs';
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  PROJECT_ROOT,
  getCalendarItem,
  getCalendarItemByDate,
  getRunEpisodeByDate,
  requireApprovedVoiceProfile,
  readStatus,
} from "./lib.mjs";

const input = process.argv[2];
if (!input) {
  throw new Error("Foydalanish: npm run content:make -- YYYY-MM-DD [episode-ID]");
}

const sourceRevision = requireFreshGitMain();
console.log('GitHub source verified:', sourceRevision.remoteMainSha);

const item = /^\d{4}-\d{2}-\d{2}$/.test(input)
  ? await getCalendarItemByDate(input)
  : await getCalendarItem(input);
assertNotPreviouslyPublished(item.id);
const { episode } = await getRunEpisodeByDate(item.date);
const voiceProfile = await requireApprovedVoiceProfile(item.id);
if (episode.voiceProvider !== voiceProfile.provider)
  throw new Error("Episode voice provider does not match content/voice-profile.json.");

const folder = path.join(PROJECT_ROOT, "review", item.id);
const hasImportedVoice =
  episode.audioSrc &&
  episode.voiceProfileId === voiceProfile.profileId &&
  episode.captionSource === "gemini-word-timestamps" &&
  episode.captions?.length;
const runStage = (script) => {
  const result = spawnSync(
    process.execPath,
    [path.join(PROJECT_ROOT, "scripts", script), item.id],
    { cwd: PROJECT_ROOT, stdio: "inherit" },
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
