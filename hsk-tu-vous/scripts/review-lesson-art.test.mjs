import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VISUAL_CHECKS, assertLessonArtReviewed } from "./review-lesson-art.mjs";

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
