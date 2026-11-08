import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The generator is a CLI with top-level side effects (git freshness, paid
// APIs), so its wiring of the tested pure helpers is asserted structurally.
const source = readFileSync(new URL("./generate-voice-gemini.mjs", import.meta.url), "utf8");
const between = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, "missing section " + from);
  return source.slice(start, end);
};

test("PR #56 fallback: Direct TTS may switch to OpenRouter only before any saved chunk", () => {
  const tts = between("async function generateTtsWav(config, text) {", "async function uploadForTranscription");
  assert.match(tts, /if \(config\.ttsTransport === "openrouter"\) return synthesizeWithOpenRouter\(config, text\);/);
  assert.match(tts, /withOpenRouterBackup\(\{\s*stage: "tts",\s*enabled: Boolean\(config\.openRouterBackupKey\),\s*allowFallback: config\.completedTtsChunks === 0,/);
  assert.match(tts, /config\.ttsTransport = "openrouter";\s*config\.transcriptionTransport = "openrouter";\s*config\.fallbackEvents\.push\(event\);/);
  assert.match(tts, /primary: \(\) => withGeminiKeyFailover\(/, "Google key rotation stays inside the Direct primary");
  const loop = between("for (const [index, chunk] of ttsChunks.entries()) {", "if (ttsChunks.length > 1) {");
  assert.match(loop, /config\.completedTtsChunks = completedTtsChunks;\s*const generated = await generateTtsWav/);
  assert.match(loop, /transport: chunkTransport/);
});

test("STT and clip recovery fall back on the SAME saved audio; per-run budget", () => {
  const stt = between("const result = await transcribeUntilAligned({", "attempts = result.attempts;");
  assert.match(stt, /maxAttempts: attempts \+ \(windowedStt \? 2 : STT_ATTEMPTS_PER_RUN\)/);
  assert.match(stt, /if \(windowedStt\) return transcribeWindows\(attempt\);/);
  assert.match(stt, /if \(config\.transcriptionTransport === "openrouter"\) return openRouterStt\(\);/);
  assert.match(stt, /stage: "stt",[\s\S]*backup: openRouterStt,[\s\S]*primary: \(\) => transcribeDirect\(attempt\)/);
  assert.match(stt, /audioPath: transcriptionAudioPath/);
  assert.doesNotMatch(source, /captions && attempts < 3/, "no cumulative cap that strands a resumed take");
  const recovery = between("async function recoverActualWordClips", "function safeErrorMessage");
  assert.match(recovery, /stage: "stt-recovery"/);
  const saved = between("async function transcribeSavedAudio(", "async function cachedClipTranscription(");
  assert.match(saved, /apiKey: openRouterKeyFor\(config\), model: config\.transcribeModel, audioPath: filePath,/);
  assert.match(saved, /primary: \(\) => transcribeDirectAudio\(filePath, languageCodes, displayName, config\),/,
    "Direct and backup read the same saved clip");
  assert.match(recovery, /provider: config\.transcriptionTransport/);
});

test("resume and checkpoints carry the actual transports; no OpenRouter key -> no silent resume", () => {
  const resume = between("if (RESUME_FOLDER_NAME) {\n  try {", "} else {\n  metadata = {");
  assert.match(resume, /config\.ttsTransport = metadata\.ttsTransport \?\? config\.apiProvider;/);
  assert.match(resume, /config\.transcriptionTransport = config\.apiProvider;/,
    "STT on saved audio asks the requested transport first again on resume");
  const cache = between("async function cachedClipTranscription(", "async function recoverActualWordClips(");
  assert.match(cache, /if \(saved && \(saved\.provider !== "openrouter" \|\| config\.transcriptionTransport === "openrouter"\)\)/);
  assert.match(cache, /result = await request\(\{ allowBackup: !saved \}\);/, "no second paid backup call for a clip already answered");
  assert.match(cache, /await fs\.writeFile\(alternatePath, JSON\.stringify\(saved/, "the backup answer is kept as evidence");
  assert.match(resume, /requires HSK_AI_OPENROUTER_FALLBACK_ENABLED=true and OPENROUTER_API_KEY/);
  const checkpoint = between("const persistCheckpoint = () => atomicWriteJson(checkpointPath, {", "});");
  for (const field of ["ttsTransport", "transcriptionTransport", "fallbackEvents"])
    assert.match(checkpoint, new RegExp(field + ": config\\." + field));
  assert.match(source, /metadata\.googleQuotaKeyRotationEnabled = false;/);
});

test("errors that reach logs, metadata or artifacts never carry a credential", async () => {
  const { redactCredentials } = await import("./video-credentials.mjs");
  const raw = "HTTP 401 key AIzaSyA1234567890abcdefghijklmnop, AQ.FakeTestOnlyKeyZZZZZZZZZZZZZ, " +
    "sk-or-v1-0123456789abcdef0123 and Authorization: Bearer abcdefghijklmnop.qrstuvwxyz";
  const clean = redactCredentials(raw);
  assert.doesNotMatch(clean, /AIzaSy|FakeTestOnly|0123456789abcdef|abcdefghijklmnop/);
  assert.equal((clean.match(/\[redacted\]/g) ?? []).length, 4);
  assert.equal(redactCredentials("HTTP 429 daily quota; retry in 23h"), "HTTP 429 daily quota; retry in 23h");
  assert.match(source, /function safeErrorMessage\(error\) \{\s*return redactCredentials\(/);
});

test("GitHub render job can enable the owner's backup; it is off unless the Actions variable says true", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/video-review.yml", import.meta.url), "utf8");
  assert.match(workflow, /HSK_AI_OPENROUTER_FALLBACK_ENABLED: \$\{\{ vars\.HSK_AI_OPENROUTER_FALLBACK_ENABLED \|\| 'false' \}\}/);
  assert.match(workflow, /HSK_AI_OPENROUTER_FALLBACK_ENABLED" == "true" && -z "\$OPENROUTER_API_KEY"/,
    "an enabled backup without its key fails before any paid request");
});

test("sample fallback re-fingerprints the copied sample, so checkpoint and import agree", () => {
  const fallback = between("const rejectedMp3 = await archiveRejectedFile(mp3Path);", "verifiedSampleFallbackUsed = true;");
  const copy = fallback.indexOf("fs.copyFile(fallback.wavPath, wavPath)");
  const rehash = fallback.indexOf("metadata.wavSha256 = sha256(sampleWavBytes);");
  assert.ok(copy > 0 && rehash > copy, "hashes are recomputed AFTER the sample replaces the rejected audio");
  assert.match(fallback, /metadata\.mp3Sha256 = sha256\(await fs\.readFile\(mp3Path\)\);/);
  assert.match(fallback, /if \(ttsChunks\.length === 1\)\s*metadata\.ttsChunks\[0\] = \{[\s\S]*transport: "verified-sample-copy"/);
  const after = between("verifiedSampleFallbackUsed = true;", "break;");
  assert.match(after, /await persistMetadata\(\);\s*await persistCheckpoint\(\);/);
});

test("V8-01: Mandarin gap recovery repairs a zero-length provider word like the main aligner", () => {
  const blocks = between("function timedBlocks(annotations, durationMs) {", "async function recoverActualWordClips");
  assert.match(blocks, /const inverted = endMs <= startMs && \(startMs \+ 1 - endMs > 250 \|\| startMs \+ 1 > durationMs \+ 100\);/);
  assert.match(blocks, /if \(endMs <= startMs\) endMs = startMs \+ 1;/, "a small inversion is repaired by 1 ms");
  assert.doesNotMatch(blocks, /endMs <= startMs \|\| endMs > durationMs \+ 100\)\s*throw/, "no blanket rejection of a zero-length word");
  // V9-01: an impossible word is dropped as untimed (its span is re-recognized), never thrown for the whole take.
  assert.match(blocks, /if \(outside \|\| inverted\) \{\s*console\.warn\("GEMINI_UNTIMED_WORD_DROPPED "[\s\S]*?return;\s*\}/);
  assert.doesNotMatch(blocks.slice(0, blocks.indexOf("\n}\n")), /throw new Error/);
  const main = between("function flattenRecognized(", "function alignWords(");
  assert.match(main, /if \(correctionMs > 250\)/, "same 250 ms bound as the main aligner");
});

test("requestJson retries only a never-connected Google request, with bounded backoff", () => {
  const request = between("async function requestJson(", "function getAudioData(");
  assert.match(request, /catch \(error\) \{\s*\/\/[^\n]*\n[^\n]*\n\s*if \(!isPreConnectFailure\(error\) \|\| attempt >= maxAttempts\) throw error;/);
});

test("V-10/V-11 wiring: main alignment and recovery share one verified spoken matcher", () => {
  const align = between("function alignWords(", "let cachedSpokenMatch;");
  assert.match(align, /const spoken = alignSpokenTokens\(expected, recognized, spokenMatch\(\)\);/);
  assert.match(align, /if \(spoken\.aligned\) return captionsFromAligned\(words, expected, spoken\.aligned,/);
  const captions = between("function captionsFromAligned(", "async function uploadForTranscription");
  assert.match(captions, /text: word\.display,/, "captions always show the source narration, never the ASR spelling");
  assert.match(source, /const pairs = collectHanziPinyinPairs\(episode\);/);
  const recovery = between("async function recoverActualWordClips({", "function safeErrorMessage");
  assert.match(recovery, /const match = spokenMatch\(\);/);
  assert.equal((recovery.match(/buildRecoveryPlan\(expected, blocks, durationMs, \{ match \}\)/g) ?? []).length, 2);
  assert.match(recovery, /selectRecoveredBlocks\(gap\.tokens, gapBlocks, \{ match \}\)/);
});

test("a resumed take re-checks its saved STT responses before spending a new attempt", () => {
  const stt = between("let attempts = metadata.transcriptionAttempts?.[index]", "const result = await transcribeUntilAligned({");
  const recheck = stt.indexOf("transcription-part-${chunkNumber}-attempt-${saved}.json");
  assert.ok(recheck > 0, "saved attempt files are read");
  assert.match(stt, /const reused = alignWords\(ttsChunks\[index\]\.text, previous\.wordAnnotations,/);
  assert.match(stt, /metadata\.reusedSavedTranscriptions\.push\(\{ chunk: index \+ 1, attempt: saved \}\)/);
});

test("X-10 wiring: single-hint passes only for missing languages, only in windows with a gap", () => {
  const recovery = between("async function recoverActualWordClips({", "function safeErrorMessage");
  const first = recovery.indexOf("let plan = buildRecoveryPlan(expected, blocks, durationMs, { match });");
  const passes = recovery.indexOf("for (const windowIndex of windowsTouching(windows, plan.gaps)) {");
  const replan = recovery.indexOf("plan = buildRecoveryPlan(expected, blocks, durationMs, { match });", passes);
  const clips = recovery.indexOf("for (const gap of plan.gaps) {");
  assert.ok(first > 0 && passes > first && replan > passes && clips > replan, "plan -> passes on gap windows -> re-plan -> gap clips");
  assert.match(recovery, /if \(plan\.gaps\.length && transcriptionLanguages\.length > 1\)/);
  const saved = between("async function transcribeSavedAudio(", "async function cachedClipTranscription(");
  assert.match(saved, /language: openRouterHint,/, "OpenRouter passes get their single ISO hint");
  assert.match(recovery, /transcribeSavedAudio\(clipPath, \[code\],/);
  assert.match(recovery, /language-passes\.json/);
  assert.match(recovery, /cachedClipTranscription\(path\.join\(directory, name \+ "\.json"\)/, "a paid pass is saved and reused");
  assert.match(recovery, /if \(plan\.gaps\.length > 8 \* windows\.length\)/);
});

test("one-take is the default; long takes are transcribed in saved silence-bounded windows", () => {
  assert.match(source, /const TTS_MODE_SETTING = \(process\.env\.HSK_AI_TTS_MODE \?\? "one-take"\)/);
  assert.match(source, /const ttsMode = ONE_TAKE \? "continuous-pilot" : "scene";/, "stored id unchanged: saved takes stay resumable");
  const loop = between("metadata.sttWindows ??= [];", "if (!chunkAlignment?.captions) {\n      // Direct Gemini STT");
  assert.match(loop, /planSttWindows\(\{/);
  assert.match(loop, /cutWavClip\(chunkWavPath, window\.startMs, window\.endMs, clipPath, ffmpegRuntime\);/);
  assert.match(loop, /annotations\.push\(\.\.\.offsetAnnotations\(record\.annotations, window\.startMs\)\);/);
  assert.match(loop, /metadata\.sttWindows\[index\] = sttWindows;\s*await persistMetadata\(\);/, "windows are fixed per take");
  const cache = between("async function cachedClipTranscription(", "async function recoverActualWordClips(");
  assert.match(cache, /return saved\?\.key === key && Array\.isArray\(saved\.annotations\) && saved\.annotations\.length \? saved : null;/);
});

test("an alignment failure on the last STT attempt reaches recovery instead of aborting", () => {
  assert.match(source, /if \(!result\.transcription\) \{\s*await persistMetadata\(\);\s*await persistCheckpoint\(\);\s*throw result\.error;\s*\}/,
    "a spent budget with no response is a transport failure, never written as a null attempt");
});
