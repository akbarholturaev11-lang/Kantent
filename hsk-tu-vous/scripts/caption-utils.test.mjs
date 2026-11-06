import assert from "node:assert/strict";
import test from "node:test";
import { groupTimedCaptions } from "./caption-utils.mjs";

const style = {
  maxWordsPerPage: 1,
  maxCharactersPerPage: 32,
  maxPageDurationMs: 1000,
  maxGapMs: 500,
  holdAfterWordMs: 300,
};

test("keeps a word cue visible through its audio across a scene section boundary", () => {
  const pages = groupTimedCaptions([
    { text: "spoken", startMs: 5950, endMs: 6150 },
    { text: "next", startMs: 6200, endMs: 6350 },
  ], {
    ...style,
    sections: [
      { startMs: 0, endMs: 6000, styleId: "pill" },
      { startMs: 6000, endMs: 10000, styleId: "headline" },
    ],
  });
  assert.equal(pages[0].endMs, 6150);
  assert.equal(pages[1].startMs, 6200);
});

test("rejects overlapping caption pages that would hide an audible word", () => {
  assert.throws(() => groupTimedCaptions([
    { text: "first", startMs: 0, endMs: 100 },
    { text: "second", startMs: 50, endMs: 150 },
  ], { ...style, sections: [{ startMs: 0, endMs: 1000, styleId: "pill" }] }), /would hide an audible word/);
});
