import assert from "node:assert/strict";
import test from "node:test";
import { compileCueTimeline } from "./compile-cue-timeline.mjs";
import { assertCueTimelineMatches } from "./cue-timeline.mjs";
import { narrationHash } from "./lib.mjs";

function episode(languageCode = "ru-RU") {
  const value = {
    id: "timeline-fixture", languageCode, motionDesign: true,
    motionDesignStyle: "le-context-v1", captionSource: "gemini-word-timestamps",
    scenes: [{ id: "lesson", kind: "example", narration: "всё хорошо", startMs: 0, endMs: 1000,
      motionBeats: [{ id: "all", kind: "meaning", cueText: "всё" }] }],
    captions: [
      { text: "все", startMs: 100, endMs: 300 },
      { text: "хорошо", startMs: 400, endMs: 800 },
    ],
  };
  value.voiceTextHash = narrationHash(value);
  return value;
}

test("compiles locale-aware cues and captions into one versioned timeline", () => {
  const ru = episode("ru-RU");
  const timeline = compileCueTimeline(ru);
  assertCueTimelineMatches(ru, timeline);
  assert.equal(timeline.languageCode, "ru-RU");
  assert.equal(timeline.scenes[0].motionBeats[0].startMs, 100);
  assert.equal(timeline.captionSections[0].endMs, 1000);

  const tg = episode("tg-TJ");
  assert.throws(() => compileCueTimeline(tg), /missing\/ambiguous exact spoken cue/);
});

test("rejects a stale timeline when locale, voice text, or scene identity changes", () => {
  const value = episode();
  const timeline = compileCueTimeline(value);
  assert.throws(() => assertCueTimelineMatches({ ...value, languageCode: "tg-TJ" }, timeline), /does not match/);
  assert.throws(() => assertCueTimelineMatches({ ...value, voiceTextHash: "stale" }, timeline), /does not match/);
  assert.throws(() => assertCueTimelineMatches({ ...value, scenes: [{ ...value.scenes[0], id: "changed" }] }, timeline), /does not match/);
});

test("rejects a stale timeline when imported word cues, audio identity, or cue plans change", () => {
  const value = episode();
  value.audioSha256 = "first-audio-hash";
  const timeline = compileCueTimeline(value);
  const changedCaptions = structuredClone(value);
  changedCaptions.captions[0].startMs += 1;
  assert.throws(() => assertCueTimelineMatches(changedCaptions, timeline), /does not match/);
  assert.throws(() => assertCueTimelineMatches({ ...value, audioSha256: "replacement-audio-hash" }, timeline), /does not match/);
  const changedPlan = structuredClone(value);
  changedPlan.scenes[0].motionBeats[0].cueText = "хорошо";
  assert.throws(() => assertCueTimelineMatches(changedPlan, timeline), /does not match/);
  const tamperedTimeline = { ...timeline, wordCues: [{ text: "wrong", startMs: 0, endMs: 1 }] };
  assert.throws(() => assertCueTimelineMatches(value, tamperedTimeline), /does not match/);
});
