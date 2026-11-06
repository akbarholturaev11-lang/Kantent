import assert from "node:assert/strict";
import test from "node:test";
import { activeNarratedBeat } from "./narrated-beat-state.mjs";

test("does not reveal a narrated visual before its first spoken cue", () => {
  const beats = [{ id: "choice", localFrame: 18 }, { id: "answer", localFrame: 64 }];
  assert.equal(activeNarratedBeat(beats, 17), null);
  assert.equal(activeNarratedBeat(beats, 18).id, "choice");
  assert.equal(activeNarratedBeat(beats, 63).id, "choice");
  assert.equal(activeNarratedBeat(beats, 64).id, "answer");
});
