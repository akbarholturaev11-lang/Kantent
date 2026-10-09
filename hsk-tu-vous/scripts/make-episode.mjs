import { requireFreshGitMain } from './git-freshness.mjs';
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  PROJECT_ROOT,
  getCalendarItem,
  getCalendarItemByDate,
  getRunEpisodeByDate,
  normalizeVoiceProvider,
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
const { episode } = await getRunEpisodeByDate(item.date);
if (normalizeVoiceProvider(episode.voiceProvider) !== "text-to-speech-online") {
  throw new Error("HSK AI faqat content/voice-profile.json dagi yagona ovoz profiliga ruxsat beradi.");
}

const folder = path.join(PROJECT_ROOT, "review", item.id);
const hasImportedVoice =
  episode.audioSrc &&
  ["online-tts-srt", "online-tts-vtt"].includes(episode.captionSource) &&
  episode.captions?.length;
const script = hasImportedVoice
  ? "render-episode.mjs"
  : "prepare-online-tts.mjs";
const result = spawnSync(
  process.execPath,
  [path.join(PROJECT_ROOT, "scripts", script), item.id],
  { cwd: PROJECT_ROOT, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(script + " завершился с ошибкой.");

if (hasImportedVoice) {
  console.log("Пакет готов для ручной проверки: " + folder);
} else {
  const status = await readStatus(item.id);
  console.log("TTS-текст подготовлен. Агент должен продолжить через browser automation: создать и скачать MP3+word-level SRT/VTT, импортировать их и затем собрать пакет.");
  console.log("Файл сценария: " + status.script);
  console.log("Папка для загрузок: " + path.join(folder, "incoming"));
}
