import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  assertReusableVoiceMetadata,
  assertVoiceEpisodeLanguage,
  normalizeVoiceToken,
  voiceTranscriptionLanguages,
} from "./voice-language.mjs";

const ru = JSON.parse(await fs.readFile(new URL("../content/voice-profile.json", import.meta.url), "utf8"));
const tg = JSON.parse(await fs.readFile(new URL("../content/locales/tg/voice-profile.json", import.meta.url), "utf8"));
const metadata = (profile) => ({
  provider: profile.provider,
  voiceProfileId: profile.profileId,
  languageCode: profile.locale,
  ttsModel: profile.ttsModel,
  voice: profile.voiceName,
  transcriptionModel: profile.transcriptionModel,
});

test("transcription uses each explanation language together with Mandarin", () => {
  assert.deepEqual(voiceTranscriptionLanguages(ru), ["ru-RU", "zh-CN"]);
  assert.deepEqual(voiceTranscriptionLanguages(tg), ["tg-TJ", "cmn-Hans-CN"]);
  assert.throws(() => voiceTranscriptionLanguages({ locale: "uz-UZ" }), /Russian or Tajik/);
});

test("Russian normalization stays compatible and Tajik letters remain distinct", () => {
  assert.equal(normalizeVoiceToken("ЁЖ", "ru-RU"), "еж");
  assert.equal(normalizeVoiceToken("ЁД Ҳ Қ Ӣ Ӯ Ғ Ҷ", "tg-TJ"), "ёд ҳ қ ӣ ӯ ғ ҷ");
  assert.notEqual(normalizeVoiceToken("ёд", "tg-TJ"), normalizeVoiceToken("ед", "tg-TJ"));
  assert.equal(normalizeVoiceToken("我要两杯茶", "tg-TJ"), "我要两杯茶");
});

test("a Russian profile cannot voice or import a Tajik episode", () => {
  assert.doesNotThrow(() => assertVoiceEpisodeLanguage({ languageCode: "tg-TJ" }, tg));
  assert.throws(() => assertVoiceEpisodeLanguage({ languageCode: "tg-TJ" }, ru), /Refused to mix/);
  assert.throws(() => assertVoiceEpisodeLanguage({}, tg), /missing/);
});

test("resume refuses a different language, voice or TTS model", () => {
  assert.doesNotThrow(() => assertReusableVoiceMetadata(metadata(tg), tg));
  assert.throws(() => assertReusableVoiceMetadata(metadata(ru), tg), /does not match/);
  assert.throws(() => assertReusableVoiceMetadata({ ...metadata(tg), ttsModel: ru.ttsModel }, tg), /does not match/);
  assert.throws(() => assertReusableVoiceMetadata({ ...metadata(tg), voice: "Puck" }, tg), /does not match/);
  assert.throws(() => assertReusableVoiceMetadata({ ...metadata(tg), languageCode: "ru-RU" }, tg), /does not match/);
});

test("historical Russian metadata is accepted while Tajik provenance is explicit", () => {
  const historicalRu = metadata(ru);
  delete historicalRu.languageCode;
  delete historicalRu.voiceProfileId;
  assert.doesNotThrow(() => assertReusableVoiceMetadata(historicalRu, ru));
  const unscopedTg = metadata(tg);
  delete unscopedTg.languageCode;
  assert.throws(() => assertReusableVoiceMetadata(unscopedTg, tg), /does not match/);
});
