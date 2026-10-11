import { assertNotPreviouslyPublished } from "./published-evidence.mjs";
import { requireFreshGitMain } from './git-freshness.mjs';
import fs from "node:fs/promises";
import path from "node:path";
import {
  getEpisode,
  requireCurrentCta,
  narrationHash,
  normalizeVoiceProvider,
  requireApprovedVoiceProfile,
  reviewDir,
  writeStatus,
  validateEpisode,
  writeJson,
} from "./lib.mjs";

const id = process.argv[2];
if (!id) {
  throw new Error(
    "Foydalanish: node scripts/prepare-online-tts.mjs <episode-ID>",
  );
}

const sourceRevision = requireFreshGitMain();
assertNotPreviouslyPublished(id);
const { episode, filePath } = await getEpisode(id);
validateEpisode(episode);
const ctaValidation = await requireCurrentCta(episode);
const voiceProfile = await requireApprovedVoiceProfile(id);
if (normalizeVoiceProvider(episode.voiceProvider) !== "text-to-speech-online") {
  throw new Error(
    `text-to-speech.online tanlanmagan (voiceProvider: ${episode.voiceProvider || "ko‘rsatilmagan"}).`,
  );
}
if (episode.voiceProfileId !== voiceProfile.profileId) {
  throw new Error(
    "Episode voiceProfileId ovoz profiliga mos emas. Profilni o‘zgartirmang; HSK AI egasidan qaror so‘rang.",
  );
}

const folder = reviewDir(id);
const inbox = path.join(folder, "incoming");
await fs.mkdir(inbox, { recursive: true });
const scriptPath = path.join(folder, "tts-input.txt");
// Preserve spoken words and punctuation while avoiding blank-line pauses that
// some TTS exports omit from their word-level VTT timestamps.
const ttsNarration = episode.scenes
  .map((scene) => scene.narration.trim())
  .join(" ")
  .replace(/\s+/g, " ")
  .trim();
await fs.writeFile(scriptPath, `${ttsNarration}\n`, "utf8");
episode.voiceTextHash = narrationHash(episode);
await writeJson(filePath, episode);
await writeStatus(id, {
  stage: "tts-browser-automation-ready",
  sourceRevision,
  updatedAt: new Date().toISOString(),
  provider: "text-to-speech.online",
  voiceProfileId: voiceProfile.profileId,
  voiceName: voiceProfile.voiceName,
  voiceTextHash: episode.voiceTextHash,
  ctaExperimentId: episode.ctaExperiment.id,
  ctaRuleVersion: ctaValidation.ruleVersion,
  script: scriptPath,
  expectedAudio: path.join(inbox, "voice.mp3"),
  expectedCaptions: [
    path.join(inbox, "captions.vtt"),
    path.join(inbox, "captions.srt"),
  ],
});

console.log(
  `Агент должен продолжить через browser automation: открыть https://text-to-speech.online/ и вставить ${scriptPath}. Не запрашивайте у владельца ручной экспорт.`,
);
console.log(
  `Используйте только профиль ${voiceProfile.profileId}: Russian (${voiceProfile.locale}) → мужской голос ${voiceProfile.voiceName} → скорость ${voiceProfile.speedPercent}% → высота тона ${voiceProfile.pitchPercent}% → ${voiceProfile.outputFormat}.`,
);
console.log(
  `Сгенерируйте и скачайте MP3 и word-level VTT (SRT допустим) в ${inbox}, затем импортируйте оба файла через content:import-tts. Остановитесь только при конкретном внешнем барьере сайта.`,
);
