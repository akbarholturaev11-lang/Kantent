import test from "node:test";
import assert from "node:assert/strict";
import { validateProductionDuration } from "./duration-policy.mjs";

const policy = { effectiveFromDate: "2026-10-23",
  targetSec: 50, targetRangeSec: [0, 55], includesCta: true };
const episode = seconds => ({ date: "2026-10-23",
  scenes: [{ durationFrames: Math.round((seconds - 11) * 30) }, { kind: "cta", durationFrames: 330 }] });

test("accepts naturally short duration and reports only the preferred upper pacing band", () => {
  for (const seconds of [12, 30, 42.8, 44]) {
    const result = validateProductionDuration(episode(seconds), policy);
    assert.equal(result.durationSec, seconds);
    assert.equal(result.withinTargetBand, true);
  }
  for (const seconds of [56, 70]) {
    const result = validateProductionDuration(episode(seconds), policy);
    assert.equal(result.durationSec, seconds);
    assert.equal(result.withinTargetBand, false);
  }
});
test("counts the CTA and accepts the target and upper guidance boundary", () => {
  for (const seconds of [12, 50, 55]) {
    const result = validateProductionDuration(episode(seconds), policy);
    assert.equal(result.durationSec, seconds);
    assert.equal(result.withinTargetBand, true);
  }
});
test("reports a longer natural narration without truncating it", () => {
  const e = episode(56);
  const before = structuredClone(e);
  assert.equal(validateProductionDuration(e, policy).withinTargetBand, false);
  assert.deepEqual(e, before);
});
test("preserves historical episodes and rejects missing speech timing", () => {
  assert.equal(validateProductionDuration({ date: "2026-10-21" }, policy), null);
  assert.throws(() => validateProductionDuration({ date: "2026-10-23", scenes: [{ durationSec: 50 }] }, policy), /audio-aligned/);
});
test("rejects contradictory duration settings", () => {
  assert.throws(() => validateProductionDuration(episode(50), { ...policy, targetSec: 60 }), /Invalid/);
});
