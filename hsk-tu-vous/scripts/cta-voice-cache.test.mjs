import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readCtaVoice, saveCtaVoice, findCtaVoiceForTake, ctaCaptionsVtt } from "./cta-voice-cache.mjs";
import { readFileSync } from "node:fs";

test("a cached CTA is reusable only with exact copy, locale, settings, transport and intact bytes", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-cta-test-"));
  try {
    const file = path.join(root, "sample.wav");
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=d=0.4", "-ar", "24000", file]);
    const wav = await fs.readFile(file);
    const profile = { status: "approved", locale: "tg-TJ", profileId: "test", voiceName: "Kore",
      ttsModel: "test-tts", transcriptionModel: "test-stt", spokenStyle: "clear", sampleRateHz: 24000, channels: 1 };
    const words = [{ text: "Санҷ.", start_offset: "0.1s", end_offset: "0.3s" }];
    const args = { text: "Санҷ.", profile, transport: "openrouter", wav, words };
    const key = await saveCtaVoice(root, args);
    await saveCtaVoice(root, args);
    const hit = await readCtaVoice(root, args.text, profile, "openrouter");
    assert.deepEqual(hit.wav, wav);
    assert.deepEqual(hit.words, words);
    assert.equal(await readCtaVoice(root, "Санҷ!", profile, "openrouter"), null);
    assert.equal(await readCtaVoice(root, args.text, { ...profile, locale: "ru-RU" }, "openrouter"), null);
    assert.equal(await readCtaVoice(root, args.text, { ...profile, spokenStyle: "fast" }, "openrouter"), null);
    assert.equal(await readCtaVoice(root, args.text, profile, "gemini-direct"), null);
    await fs.appendFile(path.join(root, key, "voice.wav"), "tamper");
    await assert.rejects(readCtaVoice(root, args.text, profile, "openrouter"), /checksum/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("the kept ending of earlier videos joins the take instead of a new voice; nothing re-voices a kept CTA", () => {
  const source = readFileSync(new URL("./generate-voice-gemini.mjs", import.meta.url), "utf8");
  const loop = source.slice(source.indexOf("if (!chunkBytes && cachedCta && index === ttsChunks.length - 1) {"),
    source.indexOf("if (!chunkBytes) {\n      // Backup is allowed only"));
  assert.match(loop, /chunkBytes = cachedCta\.wav;/u);
  assert.match(loop, /chunkTransport = cachedCta\.transport;/u, "the chunk records the route its recording came from");
  assert.match(loop, /delete metadata\.ctaVoicedOnTakeTransport;/u, "the reused recording is never saved again under another transport");
  assert.doesNotMatch(source, /cachedCtaFitsTake|CTA_CACHE_TRANSPORT_MISMATCH/u);
  assert.match(source, /if \(useCache && \(!cachedCta \|\| metadata\.ctaVoicedOnTakeTransport\) && !verifiedSampleFallbackUsed\)/);
});

test("the CTA clip cut runs the bundled ffmpeg with its runtime library env", async () => {
  const { readFileSync } = await import("node:fs");
  const voice = readFileSync(new URL("./generate-voice-gemini.mjs", import.meta.url), "utf8");
  assert.match(voice, /extractCtaWav\(ffmpegRuntime\.ffmpegPath, wavPath, clip, start, ffmpegRuntime\.env\)/);
  const cache = readFileSync(new URL("./cta-voice-cache.mjs", import.meta.url), "utf8");
  assert.match(cache, /export function extractCtaWav\(ffmpeg, wavPath, output, startMs, env = process\.env\)[\s\S]*\{ env,/);
});

test("each saved CTA keeps its subtitles, and a take finds the ending saved on its own transport", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-cta-test-"));
  try {
    const file = path.join(root, "sample.wav");
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=d=0.4", "-ar", "24000", file]);
    const wav = await fs.readFile(file);
    const profile = { status: "approved", locale: "tg-TJ", profileId: "test", voiceName: "Kore",
      ttsModel: "test-tts", transcriptionModel: "test-stt", spokenStyle: "clear", sampleRateHz: 24000, channels: 1 };
    const words = [{ text: "HSK", start_offset: "0.100s", end_offset: "0.250s" }, { text: "AI-ро", start_offset: "0.250s", end_offset: "1.400s" }];
    const key = await saveCtaVoice(root, { text: "HSK  AI-ро", profile, transport: "openrouter", wav, words });
    const captions = await fs.readFile(path.join(root, key, "captions.vtt"), "utf8");
    assert.equal(captions, ctaCaptionsVtt(words));
    assert.match(captions, /^WEBVTT\n\n00:00:00\.100 --> 00:00:00\.250\nHSK\n\n00:00:00\.250 --> 00:00:01\.400\nAI-ро\n$/u);
    const receipt = JSON.parse(await fs.readFile(path.join(root, key, "receipt.json"), "utf8"));
    assert.deepEqual([receipt.text, receipt.locale, receipt.transport], ["HSK AI-ро", "tg-TJ", "openrouter"]);
    // Real 2026-11-16 TG run: the API route was Direct, the body was voiced on
    // the OpenRouter backup; the OpenRouter ending must be found, not re-voiced.
    assert.equal((await findCtaVoiceForTake(root, "HSK AI-ро", profile, ["openrouter"], "gemini-direct"))?.key, key);
    assert.equal((await findCtaVoiceForTake(root, "HSK AI-ро", profile, [], "openrouter"))?.key, key, "a CTA-only take uses the preferred transport");
    // Owner 2026-11-17: the recording of earlier videos is reused on any route of the same profile.
    assert.equal((await findCtaVoiceForTake(root, "HSK AI-ро", profile, ["gemini-direct"], "gemini-direct"))?.key, key);
    const direct = await saveCtaVoice(root, { text: "HSK AI-ро", profile, transport: "gemini-direct", wav, words });
    assert.equal((await findCtaVoiceForTake(root, "HSK AI-ро", profile, ["gemini-direct"], "openrouter"))?.key, direct, "the take's own route first");
    assert.equal((await findCtaVoiceForTake(root, "HSK AI-ро", profile, ["openrouter"], "gemini-direct"))?.key, key);
    assert.equal(await findCtaVoiceForTake(root, "HSK AI-ро", { ...profile, voiceName: "Puck" }, ["openrouter"], "openrouter"), null, "never another voice");
    await fs.writeFile(path.join(root, key, "captions.vtt"), "WEBVTT\n");
    await assert.rejects(readCtaVoice(root, "HSK AI-ро", profile, "openrouter"), /subtitle checksum/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("a lesson take plans the separate ending whenever any route keeps one", () => {
  const source = readFileSync(new URL("./generate-voice-gemini.mjs", import.meta.url), "utf8");
  assert.match(source, /findCtaVoiceForTake\(ctaCacheRoot, reusableCta\.narration, voiceProfile,\s*lessonChunkTransports, config\.ttsTransport\)/);
  assert.match(source, /findCtaVoiceForTake\(ctaCacheRoot, reusableCta\.narration, voiceProfile, \[\], config\.apiProvider\)/);
});

test("an owner-approved --replace-cta swaps only the ending chunk of a resumed take for the kept CTA and keeps the old one as evidence", () => {
  const voice = readFileSync(new URL("./generate-voice-gemini.mjs", import.meta.url), "utf8");
  assert.match(voice, /--replace-cta needs --resume <generation-folder> of a lesson take/u);
  assert.match(voice, /--replace-cta refuses an imported take/u);
  const block = voice.slice(voice.indexOf("if (REPLACE_CTA_OWNER_WORDS) {"), voice.indexOf("const persistMetadata ="));
  for (const moved of ["voice-part-${chunkNumber}.wav", "transcription-part-${chunkNumber}", "part-${chunkNumber}-",
    '"voice.wav", "voice.mp3"', "recovery-diagnostic"]) assert.ok(block.includes(moved), moved);
  assert.match(block, /metadata\.ttsChunks = metadata\.ttsChunks\.slice\(0, last\)/u, "the lesson body chunks stay");
  assert.match(block, /ownerWords: REPLACE_CTA_OWNER_WORDS/u);
  assert.match(block, /"ctaVoicedOnTakeTransport"\]\) delete metadata\[key\]/u);
  assert.doesNotMatch(block, /fs\.rm\(|unlink/u, "nothing is deleted");
});
