import test from "node:test";
import assert from "node:assert/strict";
import { validateProductionDuration } from "./duration-policy.mjs";

const policy = { effectiveFromDate: "2026-10-23",
  targetSec: 50, targetRangeSec: [45, 55], includesCta: true };
const episode = seconds => ({ date: "2026-10-23",
  scenes: [{ durationFrames: (seconds - 11) * 30 }, { kind: "cta", durationFrames: 330 }] });

test("reports natural durations outside the preferred range without limiting them", () => {
  for (const seconds of [30, 44, 56, 70]) {
    const result = validateProductionDuration(episode(seconds), policy);
    assert.equal(result.durationSec, seconds);
    assert.equal(result.withinTargetBand, false);
  }
});
test("counts the CTA and accepts both target boundaries", () => {
  for (const seconds of [45, 50, 55]) {
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
  assert.throws(() => validateProductionDuration(episode(50), { ...policy, targetSec: 30 }), /Invalid/);
});
