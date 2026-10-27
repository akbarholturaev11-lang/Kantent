import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {actionTextAtFrame, actionSubtitlePresentation} from "./action-text-layout.mjs";
const pilot = JSON.parse(fs.readFileSync(new URL("../content/pilots/quantity-cafe-20261026.json", import.meta.url)));
const layoutFor = (beat) => actionTextAtFrame([{from: 0, durationFrames: 300, beats: [{...beat, localFrame: 0}]}], 1);

test("one subtitle preserves the complete spoken phrase rather than stripping its Chinese words", () => {
  const choice = pilot.scenes[0].beats.find(beat => beat.id === "choose-form");
  for (const text of ["Сказать 二", "или 两?", "Перед счётным", "используем 两."]) {
    const result = actionSubtitlePresentation(text, layoutFor(choice));
    assert.equal(result.text, text);
    assert.equal(result.pinyin, "");
  }
});

test("Mandarin and its authored pinyin share the same subtitle, Russian meaning follows its own spoken cue", () => {
  const phrase = pilot.scenes[1].beats[0];
  const layout = layoutFor(phrase);
  assert.deepEqual(actionSubtitlePresentation("两杯茶", layout), {text: "两杯茶", pinyin: "liǎng bēi chá", focus: "杯", examples: []});
  assert.equal(actionSubtitlePresentation("杯", layout).pinyin, "bēi");
  assert.equal(actionSubtitlePresentation("茶", layout).pinyin, "chá");
  assert.deepEqual(actionSubtitlePresentation("две чашки", layout), {text: "две чашки", pinyin: "", focus: "", examples: []});
  assert.equal(actionSubtitlePresentation("三杯茶", layout).pinyin, "");
});

test("comparison examples and focus stay inside the one active subtitle presentation", () => {
  const beat = pilot.scenes.at(-1).beats.at(-1);
  const result = actionSubtitlePresentation("идёт после", layoutFor(beat));
  assert.equal(result.text, "идёт после");
  assert.deepEqual(result.examples, [{text: "两杯茶", focus: "杯"}, {text: "二十", focus: "十"}]);
  assert.equal(result.pinyin, "");
  assert.equal(actionSubtitlePresentation("二十.", layoutFor(beat)).pinyin, "èrshí");
  assert.deepEqual(actionSubtitlePresentation("二十.", layoutFor(beat)).examples, []);
});

test("cue and scene boundaries select the current model; CTA and legacy captions stay untouched", () => {
  const beats = pilot.scenes[0].beats.slice(0,2).map((beat,index) => ({...beat, localFrame: index * 30}));
  const scenes = [{from: 10, durationFrames: 90, beats}];
  assert.equal(actionTextAtFrame(scenes, 9), null);
  assert.equal(actionTextAtFrame(scenes, 39).kind, "choice");
  assert.equal(actionTextAtFrame(scenes, 40).kind, "quantity");
  assert.equal(actionTextAtFrame(scenes, 100), null);
  assert.deepEqual(actionSubtitlePresentation("AI. Зайди", null), {text: "AI. Зайди", pinyin: "", focus: "", examples: []});
});
