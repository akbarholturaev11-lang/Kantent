import test from "node:test";
import assert from "node:assert/strict";
import { parseEbur128Summary } from "./mix-check.mjs";

test("reads integrated loudness, range and true peak from the ebur128 summary", () => {
  const log = `[Parsed_ebur128_0 @ 0x1] t: 1.2 TARGET:-23 LUFS M: -20.0 S: -20.0 I: -30.0 LUFS
[Parsed_ebur128_0 @ 0x1] Summary:

  Integrated loudness:
    I:         -16.4 LUFS
    Threshold: -26.6 LUFS

  Loudness range:
    LRA:         5.1 LU

  True peak:
    Peak:       -1.7 dBFS`;
  assert.deepEqual(parseEbur128Summary(log), { integratedLufs: -16.4, loudnessRangeLu: 5.1, truePeakDbtp: -1.7 });
  assert.deepEqual(parseEbur128Summary("no summary"), { integratedLufs: null, loudnessRangeLu: null, truePeakDbtp: null });
});
