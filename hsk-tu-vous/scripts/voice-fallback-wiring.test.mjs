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
  assert.match(stt, /maxAttempts: attempts \+ STT_ATTEMPTS_PER_RUN/);
  assert.match(stt, /if \(config\.transcriptionTransport === "openrouter"\) return openRouterStt\(\);/);
  assert.match(stt, /stage: "stt",[\s\S]*backup: openRouterStt,[\s\S]*primary: \(\) => transcribeDirect\(attempt\)/);
  assert.match(stt, /audioPath: transcriptionAudioPath/);
  assert.doesNotMatch(source, /captions && attempts < 3/, "no cumulative cap that strands a resumed take");
  const recovery = between("async function recoverActualWordClips", "function safeErrorMessage");
  assert.match(recovery, /stage: "stt-recovery"/);
  assert.match(recovery, /audioPath: clipPath/);
  assert.match(recovery, /provider:config\.transcriptionTransport/);
});

test("resume and checkpoints carry the actual transports; no OpenRouter key -> no silent resume", () => {
  const resume = between("if (RESUME_FOLDER_NAME) {\n  try {", "} else {\n  metadata = {");
  assert.match(resume, /config\.ttsTransport = metadata\.ttsTransport \?\? config\.apiProvider;/);
  assert.match(resume, /config\.transcriptionTransport = metadata\.transcriptionTransport \?\? config\.apiProvider;/);
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
