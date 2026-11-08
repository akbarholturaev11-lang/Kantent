import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VISUAL_CHECKS, assertLessonArtReviewed, lessonArtPreflight } from "./review-lesson-art.mjs";
import { validateArtManifest } from "./generate-lesson-art.mjs";

test("frames are reviewed before every render of an illustrated lesson", () => {
  for (const file of ["./render-episode.mjs", "./render-tiktok-review.mjs"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /validateLessonPresentation\(episode, visualSystem\.lessonPresentation\);\n\/\/ Lesson-art review service[^\n]*\nawait assertLessonArtReviewed\(episode\);/);
  }
  assert.equal(VISUAL_CHECKS.length, 6);
  assert.ok(VISUAL_CHECKS.some((check) => /no people/.test(check)) && VISUAL_CHECKS.some((check) => /text-free/.test(check)));
});

test("a lesson without lesson art needs no frame review", async () => {
  assert.equal(await assertLessonArtReviewed({ id: "x", scenes: [{ id: "s", motionBeats: [{ id: "b", visual: {} }] }] }), null);
});

test("the paid image API is opt-in; frames are a Codex task by default", () => {
  const source = readFileSync(new URL("./generate-lesson-art.mjs", import.meta.url), "utf8");
  assert.match(source, /if \(!paid\) \{[\s\S]*writeCodexBrief/);
  assert.match(source, /else if \(options\[i\] === "--paid"\) paid = true;/);
});

test("frames are checked BEFORE paid voice in both production entry points", async () => {
  for (const file of ["./make-episode.mjs", "./mcp-server.mjs"]) {
    const full = readFileSync(new URL(file, import.meta.url), "utf8");
    // The MCP date workflow lives in prepareReviewForDate (shared by today/date tools).
    const source = full.slice(Math.max(0, full.indexOf("async function prepareReviewForDate")));
    const art = source.indexOf("await lessonArtPreflight(episode)");
    assert.ok(art > 0, file + " runs the frame preflight");
    assert.ok(art < source.indexOf('"generate-voice-gemini.mjs"'), file + " checks frames before the first paid voice stage");
  }
  assert.deepEqual(await lessonArtPreflight({ id: "x", scenes: [] }), { required: false, ready: true });
  const missing = await lessonArtPreflight({ id: "no-such-lesson-art", scenes: [{ id: "s", motionBeats: [{ id: "b", visual: { illustration: {} } }] }] });
  assert.equal(missing.stage, "lesson-art-required");
  assert.match(missing.reason, /content\/lesson-art\/no-such-lesson-art\.json is missing/);
  assert.match(missing.nextAgentAction, /visual-variety-plan/);
});

test("frames never carry a baked-in character; the renderer draws the HSK AI cast", () => {
  const base = { episodeId: "x", model: "a/b", style: "s".repeat(50) };
  const asset = { name: "street", prompt: "p".repeat(40), aspectRatio: "9:16" };
  assert.ok(validateArtManifest({ ...base, assets: [asset] }));
  assert.throws(() => validateArtManifest({ ...base, assets: [{ ...asset, characters: ["panda"] }] }), /text-free backgrounds/);
});
