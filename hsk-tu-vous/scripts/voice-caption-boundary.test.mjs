import assert from "node:assert/strict";
import test from "node:test";
import { assertCaptionsDoNotCrossBoundary } from "./voice-caption-boundary.mjs";

test("keeps lesson words ending at the CTA boundary", () => {
  const captions = [
    { text: "one", startMs: 5_700, endMs: 5_950 },
    { text: "two", startMs: 6_000, endMs: 6_200 },
  ];
  assert.deepEqual(assertCaptionsDoNotCrossBoundary(captions, 6_000), [captions[0]]);
});

test("rejects a cue crossing the CTA boundary rather than silently discarding it", () => {
  assert.throws(() => assertCaptionsDoNotCrossBoundary([
    { text: "spoken", startMs: 5_950, endMs: 6_150 },
  ], 6_000), /crosses the lesson CTA boundary/);
});
