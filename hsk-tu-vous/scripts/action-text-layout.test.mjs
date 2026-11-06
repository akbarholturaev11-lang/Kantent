import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {actionTextAtFrame, actionSubtitlePresentation, buildActionCaptionScenes, validateActionSubtitlePages} from "./action-text-layout.mjs";
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

test("verified Hanzi spans provide pinyin for complete lexical spans", () => {
  const swim = layoutFor({id:"swim",kind:"phrase",visual:{
    title:"游泳",hanzi:"我会游泳。",pinyin:"Wǒ huì yóuyǒng.",meaning:"уметь плавать",
    pinyinSegments:[{hanzi:"我",pinyin:"Wǒ"},{hanzi:"会",pinyin:"huì"},{hanzi:"游泳",pinyin:"yóuyǒng"}],
  }});
  assert.equal(actionSubtitlePresentation("我会游泳。", swim).pinyin, "Wǒ huì yóuyǒng.");
  assert.equal(actionSubtitlePresentation("游泳", swim).pinyin, "yóuyǒng");

  const some = layoutFor({id:"some",kind:"phrase",visual:{
    title:"有点儿贵",hanzi:"我觉得有点儿贵",pinyin:"Wǒ juéde yǒudiǎnr guì",meaning:"чуть дороговато",
    pinyinSegments:[{hanzi:"我",pinyin:"Wǒ"},{hanzi:"觉",pinyin:"jué"},{hanzi:"得",pinyin:"de"},
      {hanzi:"有",pinyin:"yǒu"},{hanzi:"点儿",pinyin:"diǎnr"},{hanzi:"贵",pinyin:"guì"}],
  }});
  assert.equal(actionSubtitlePresentation("有点儿", some).pinyin, "yǒu diǎnr");

  const bargain = layoutFor({id:"bargain",kind:"phrase",visual:{
    title:"便宜一点儿",hanzi:"便宜一点儿",pinyin:"piányi yìdiǎnr",meaning:"чуть дешевле",
    pinyinSegments:[{hanzi:"便宜",pinyin:"piányi"},{hanzi:"一",pinyin:"yì"},{hanzi:"点儿",pinyin:"diǎnr"}],
  }});
  assert.equal(actionSubtitlePresentation("便宜一点儿", bargain).pinyin, "piányi yìdiǎnr");
  assert.equal(actionSubtitlePresentation("一点儿", bargain).pinyin, "yì diǎnr");

  const boundary=layoutFor({id:"boundary",kind:"phrase",visual:{
    title:"你好世界",hanzi:"你好世界",pinyin:"nǐ hǎo shìjiè",meaning:"мир",
    pinyinSegments:[{hanzi:"你好",pinyin:"nǐ hǎo"},{hanzi:"世界",pinyin:"shìjiè"}],
  }});
  assert.throws(()=>actionSubtitlePresentation("好世",boundary),/PINYIN_SPAN_UNMAPPED/);
});

test("missing span mapping is an explicit render QA error and is caught before rendering", () => {
  const beat = {id:"swim",kind:"phrase",localFrame:0,visual:{
    title:"游泳",hanzi:"我会游泳",pinyin:"Wǒ huì yóuyǒng",meaning:"уметь плавать",
  }};
  const layout = layoutFor(beat);
  assert.throws(() => actionSubtitlePresentation("游泳", layout), /PINYIN_MAPPING_REQUIRED/);
  const episode = {motionDesignStyle:"explain-actions-v1",scenes:[{id:"lesson",durationFrames:90}]};
  const timeline = {scenes:[{sceneId:"lesson",motionBeats:[beat]}]};
  const scenes = buildActionCaptionScenes(episode, timeline, 30);
  assert.throws(() => validateActionSubtitlePages([
    {text:"游泳",startMs:500,endMs:1100,styleId:"pill"},
  ],scenes,30), /0\.500s.*PINYIN_MAPPING_REQUIRED/);
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
