import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { readCtaVoice, saveCtaVoice } from "./cta-voice-cache.mjs";
import { CTA_CACHE_DIR, backfillCtaCaptions, keepVerifiedCtas, listSavedCtas, missingSavedCtas } from "./cta-voice-library.mjs";

// A real 16-bit mono PCM WAV (0.1 s of silence at 24 kHz) without ffmpeg.
function wavBuffer(samples = 2400) {
  const data = Buffer.alloc(samples * 2);
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + data.length, 4); head.write("WAVE", 8);
  head.write("fmt ", 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(24000, 24); head.writeUInt32LE(48000, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write("data", 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

const profile = (locale, profileId) => ({ status: "approved", locale, profileId, provider: "gemini", voiceName: "Kore",
  ttsModel: "test-tts", transcriptionModel: "test-stt", spokenStyle: "clear", sampleRateHz: 24000, channels: 1 });
const RU = profile("ru-RU", "ru-test");
const TG = profile("tg-TJ", "tg-test");
const words = (...list) => list.map((text, i) => ({ text, start_offset: `${(i * 0.4).toFixed(3)}s`, end_offset: `${(i * 0.4 + 0.3).toFixed(3)}s` }));
const writeJson = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(value)); };

async function sandbox() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cta-library-"));
  await writeJson(path.join(root, "content", "languages.json"), { languages: {
    ru: { languageCode: "ru-RU", contentRoot: "content" }, tg: { languageCode: "tg-TJ", contentRoot: "content/locales/tg" } } });
  await writeJson(path.join(root, "content", "voice-profile.json"), RU);
  await writeJson(path.join(root, "content", "locales", "tg", "voice-profile.json"), TG);
  return root;
}

/** An entry as it was saved before subtitles and its description were kept. */
async function oldEntry(root, text, voice, transport, spoken) {
  const cache = path.join(root, CTA_CACHE_DIR);
  const key = await saveCtaVoice(cache, { text, profile: voice, transport, wav: wavBuffer(), words: spoken });
  const receiptPath = path.join(cache, key, "receipt.json");
  const { captionsSha256, text: _t, locale, profileId, transport: _tr, ...old } = JSON.parse(await fs.readFile(receiptPath, "utf8"));
  assert.ok(captionsSha256 && locale && profileId);
  await fs.writeFile(receiptPath, JSON.stringify(old));
  await fs.rm(path.join(cache, key, "captions.vtt"));
  return key;
}

test("old entries are named by language and transport and get their subtitles kept", async () => {
  const root = await sandbox();
  try {
    const ru = await oldEntry(root, "Попробуй HSK AI.", RU, "openrouter", words("Попробуй", "HSK", "AI."));
    // The spoken words drop the «» of the copy: the entry is named from the episode's CTA text.
    const tgText = "Дар паёми хусусӣ «HSK» навис.";
    const tg = await oldEntry(root, tgText, TG, "gemini-direct", words("Дар", "паёми", "хусусӣ", "HSK", "навис."));
    await writeJson(path.join(root, "review", "ep-1", "tg", "tiktok", "episode.json"), { scenes: [{ kind: "cta", narration: tgText }] });

    const before = Object.fromEntries((await listSavedCtas(root)).map((entry) => [entry.key, entry]));
    assert.deepEqual([before[ru].locale, before[ru].transport, before[ru].captions], ["ru-RU", "openrouter", false]);
    assert.deepEqual([before[tg].locale, before[tg].transport, before[tg].text], ["tg-TJ", "gemini-direct", tgText]);

    assert.equal(await backfillCtaCaptions(root), 2);
    assert.equal(await backfillCtaCaptions(root), 0, "a second run changes nothing");
    const after = await listSavedCtas(root);
    assert.ok(after.every((entry) => entry.captions && entry.described));
    const hit = await readCtaVoice(path.join(root, CTA_CACHE_DIR), "Попробуй HSK AI.", RU, "openrouter");
    assert.match(hit.captions, /^WEBVTT\n\n00:00:00\.000 --> 00:00:00\.300\nПопробуй/u);
    const receipt = JSON.parse(await fs.readFile(path.join(root, CTA_CACHE_DIR, tg, "receipt.json"), "utf8"));
    assert.deepEqual([receipt.text, receipt.locale, receipt.transport], [tgText, "tg-TJ", "gemini-direct"]);

    await fs.appendFile(path.join(root, CTA_CACHE_DIR, ru, "captions.vtt"), "tamper");
    await assert.rejects(readCtaVoice(path.join(root, CTA_CACHE_DIR), "Попробуй HSK AI.", RU, "openrouter"), /subtitle checksum/u);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("a verified imported take whose ending is not kept is listed, and keeping never throws", async () => {
  const root = await sandbox();
  try {
    const folder = path.join(root, "review", "ep-2");
    await writeJson(path.join(folder, "episode.json"), { audioSha256: "mp3", voiceProfileId: "ru-test",
      scenes: [{ kind: "lesson", narration: "Урок." }, { kind: "cta", narration: "Попробуй HSK AI." }] });
    await writeJson(path.join(folder, "gemini-production", "2026-11-16T07-30-37-780Z", "metadata.json"),
      { episodeId: "ep-2", production: true, ttsTransport: "openrouter", mp3Sha256: "mp3" });
    await writeJson(path.join(folder, "gemini-production", "2026-11-15T07-30-37-780Z", "metadata.json"),
      { episodeId: "ep-2", production: true, ttsTransport: "openrouter", mp3Sha256: "an older take" });
    const missing = await missingSavedCtas(root);
    assert.deepEqual(missing.map((item) => [item.language, item.platform, item.transport, item.take]),
      [["ru", null, "openrouter", "2026-11-16T07-30-37-780Z"]]);
    // No seed tool in the sandbox: the take cannot be kept, which is reported, not thrown.
    const result = await keepVerifiedCtas({ root, language: "ru", episodeId: "ep-2", stdio: "ignore" });
    assert.deepEqual([result.kept.length, result.failed.length], [0, 1]);
    assert.deepEqual(await keepVerifiedCtas({ root, language: "tg", stdio: "ignore" }), { kept: [], failed: [] });

    // A take whose ending came from the kept library is not listed again.
    const reused = path.join(folder, "gemini-production", "2026-11-16T07-30-37-780Z", "metadata.json");
    await writeJson(reused, { episodeId: "ep-2", production: true, ttsTransport: "openrouter", mp3Sha256: "mp3",
      reusedCtaVoiceKey: "k", ttsChunks: [{ transport: "openrouter" }, { transport: "gemini-direct" }] });
    assert.deepEqual(await missingSavedCtas(root), []);
    // A freshly voiced ending is keyed by the route of its own chunk.
    await writeJson(reused, { episodeId: "ep-2", production: true, ttsTransport: "openrouter", mp3Sha256: "mp3",
      ttsChunks: [{ transport: "openrouter" }, { transport: "gemini-direct" }] });
    assert.deepEqual((await missingSavedCtas(root)).map((item) => item.transport), ["gemini-direct"]);
    await writeJson(reused, { episodeId: "ep-2", production: true, ttsTransport: "openrouter", mp3Sha256: "mp3" });

    await saveCtaVoice(path.join(root, CTA_CACHE_DIR), { text: "Попробуй HSK AI.", profile: RU, transport: "openrouter",
      wav: wavBuffer(), words: words("Попробуй", "HSK", "AI.") });
    assert.deepEqual(await missingSavedCtas(root), [], "a kept ending is no longer missing");
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("production keeps every verified CTA after voice, and Git keeps the cache", () => {
  const make = readFileSync(new URL("./make-episode.mjs", import.meta.url), "utf8");
  const tiktokVoice = make.indexOf('runStage("generate-voice-gemini.mjs", "--platform", "tiktok")');
  const keep = make.indexOf("await keepVerifiedCtas({ language, episodeId: item.id })");
  assert.ok(tiktokVoice > 0 && keep > tiktokVoice, "after both voice imports");
  assert.ok(keep < make.indexOf('runStage("render-tiktok-review.mjs")'));
  const ignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
  assert.doesNotMatch(ignore, /^\.cta-voice-cache\/?\s*$/mu);
});
