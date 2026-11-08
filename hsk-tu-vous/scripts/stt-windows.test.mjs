import test from "node:test";
import assert from "node:assert/strict";
import { offsetAnnotations, parseSilences, planSttWindows, windowsTouching } from "./stt-windows.mjs";

// Real silencedetect (-35 dB, 0.25 s) of the saved 57.024 s RU one-take, 2026-11-08.
const RU_ONE_TAKE = "1.18325-1.558958 4.154167-4.481625 5.250625-5.988208 8.105-9.454083 10.097875-10.477292 12.938625-13.263625 16.370583-16.694958 17.3145-17.570208 18.663875-19.257292 24.99875-25.311667 26.512208-27.183375 30.620667-31.104458 32.990833-33.568458 37.520458-38.219708 38.881-39.307958 42.02075-42.472 44.036542-44.477458 46.085-46.697458 47.466833-47.717375 48.753583-49.004292 49.727083-50.100833 51.540833-51.867667 56.628667-56.96";
const log = RU_ONE_TAKE.split(" ").map((pair) => {
  const [start, end] = pair.split("-");
  return `[silencedetect @ 0x1] silence_start: ${start}\n[silencedetect @ 0x1] silence_end: ${end} | silence_duration: 0.3`;
}).join("\n");

test("real RU one-take: windows cut only at measured silence midpoints", () => {
  const silences = parseSilences(log);
  assert.equal(silences.length, 23);
  const windows = planSttWindows({ durationMs: 57024, silences });
  assert.ok(windows.length >= 3 && windows.length <= 4, `got ${windows.length}`);
  assert.equal(windows[0].startMs, 0);
  assert.equal(windows.at(-1).endMs, 57024);
  const mids = silences.map((s) => Math.round((s.startMs + s.endMs) / 2));
  for (const [index, w] of windows.entries()) {
    assert.ok(w.endMs - w.startMs <= 22000);
    if (index) assert.equal(w.startMs, windows[index - 1].endMs, "contiguous, no audio lost");
    if (index) assert.ok(mids.includes(w.startMs), "boundary is a silence midpoint");
  }
});

test("short scene audio stays one request; speech without silence is never cut", () => {
  assert.deepEqual(planSttWindows({ durationMs: 12000, silences: [] }), [{ startMs: 0, endMs: 12000 }]);
  assert.throws(() => planSttWindows({ durationMs: 60000, silences: [] }), /refusing to cut/);
});

test("window timestamps move to whole-take time without rounding drift", () => {
  assert.deepEqual(offsetAnnotations([{ text: "他", start_offset: "0.400s", end_offset: "0.600s" },
    { text: "比", startOffset: 0.6, endOffset: 0.9 }], 18961),
  [{ text: "他", startOffset: "19.361s", endOffset: "19.561s" }, { text: "比", startOffset: "19.561s", endOffset: "19.861s" }]);
  assert.deepEqual(windowsTouching([{ startMs: 0, endMs: 10 }, { startMs: 10, endMs: 20 }], [{ startMs: 12, endMs: 14 }]), [1]);
});
