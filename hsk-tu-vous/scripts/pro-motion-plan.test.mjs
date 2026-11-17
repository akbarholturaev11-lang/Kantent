import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cameraFor } from "./illustrated-layout.mjs";
import {
  PRO_SFX, cameraAt, cardTokens, diffGraphicNodes, distinctCardBeats, formulaChips, lerpGraphicAttrs, lessonFocus,
  planProSfx, planSceneTransitions, planShots, planSlideThemes, planVisualModes, proMotionActive, slideFrameRanges, springProgress,
} from "./pro-motion-plan.mjs";

const visual = JSON.parse(fs.readFileSync(new URL("../content/visual-system.json", import.meta.url)));
const config = visual.proMotion;
const anchors = { a: { x: 0.14, y: 0.29, w: 0.34, h: 0.64 }, b: { x: 0.55, y: 0.19, w: 0.34, h: 0.75 } };
const cast = (mood) => [{ id: "panda", mood, x: 0.78, y: 0.88, h: 0.3 }];
const beat = (id, localFrame, illustration, hanzi = "比", extra = {}) =>
  ({ id, localFrame, visual: { hanzi, pinyin: "bǐ", illustration: { images: ["shop"], anchors, ...illustration } }, ...extra });
const scene = (focus, mood = "talk") => ({ layout: "scene", focus, cast: cast(mood), label: "比" });

test("pro motion starts on its effective date for illustrated explain-actions lessons only", () => {
  const episode = { date: config.effectiveFromDate, motionDesignStyle: "explain-actions-v1",
    scenes: [{ motionBeats: [beat("x", 0, scene("a"))] }] };
  assert.equal(proMotionActive(episode, config), true);
  assert.equal(proMotionActive({ ...episode, date: "2026-11-14" }, config), false, "earlier lessons keep their look");
  assert.equal(proMotionActive({ ...episode, motionDesignStyle: "le-context-v1" }, config), false);
  assert.equal(proMotionActive(episode, { ...config, enabled: false }), false);
});

test("the spring settles on its target with only a small overshoot", () => {
  const values = Array.from({ length: 40 }, (_, frame) => springProgress(frame, 30, config.camera));
  assert.equal(values[0], 0);
  assert.ok(Math.max(...values) < 1.06, "overshoot stays small");
  assert.ok(Math.abs(values.at(-1) - 1) < 0.01, "settled after ~1.3 s");
});

test("shots: subject changes whip, same subject punches, wide-to-close glides, other art cross-zooms", () => {
  const beats = [beat("w", 0, { layout: "scene" }), beat("a", 30, scene("a")), beat("b", 60, scene("b")),
    beat("b2", 90, scene("b")), beat("board", 120, { layout: "board", images: ["board"] })];
  assert.deepEqual(planShots(beats, config).map((shot) => shot.transition), ["enter", "glide", "whip", "punch", "cross-zoom"]);
  const holds = planShots(beats, config).map((shot) => shot.hold);
  for (let i = 1; i < 4; i++) if (beats[i].visual.illustration.focus) assert.notEqual(holds[i], holds[i - 1]);
});

test("the camera is continuous at every cue and settles on the subtitle-safe pose", () => {
  const beats = [beat("a", 0, scene("a")), beat("b", 40, scene("b")), beat("a2", 90, scene("a"))];
  let previous = cameraAt({ beats, frame: 0, config });
  for (let frame = 1; frame < 150; frame++) {
    const now = cameraAt({ beats, frame, config });
    assert.ok(Math.abs(now.cx - previous.cx) < 0.12 && Math.abs(now.scale - previous.scale) < 0.03,
      "no jump at frame " + frame);
    assert.ok(now.blurX <= config.camera.motionBlurMaxPx);
    previous = now;
  }
  const settled = cameraAt({ beats, frame: 89, config }), target = cameraFor(beats[1].visual.illustration);
  assert.ok(Math.abs(settled.cx - target.cx) < 0.002 && Math.abs(settled.cy - target.cy) < 0.002);
  assert.ok(settled.scale >= target.scale && settled.scale <= target.scale * (1 + config.camera.holdMaxPush) + 1e-9);
  assert.ok(Math.abs(settled.tx) <= config.camera.holdDrift * 1080 + 1e-9);
  assert.ok(cameraAt({ beats, frame: 49, config }).blurX > 0, "mid-whip has motion blur");
  assert.equal(cameraAt({ beats, frame: 80, config }).blurX, 0, "a settled shot is sharp");
});

test("scene transitions vary, never repeat back to back, and the CTA always gets the light leak", () => {
  const ill = (layout) => ({ layout, images: [layout] });
  const scenes = [["scene", "scene"], ["scene", "scene"], ["board", "board"], ["pair", "pair"], ["board", "board"], [null, null]]
    .map(([first, last], index) => ({ kind: index === 5 ? "cta" : "example", firstIll: first && ill(first), lastIll: last && ill(last) }));
  const types = planSceneTransitions(scenes, config);
  assert.deepEqual(types, [null, "zoom-through", "wipe", "whip-up", "zoom-through", "light-leak"]);
  for (let i = 2; i < types.length - 1; i++) assert.notEqual(types[i], types[i - 1]);
});

test("the kinetic card marks the lesson focus only inside multi-character forms", () => {
  const beats = [beat("one", 0, scene("a"), "比"), beat("two", 30, scene("b"), "他比我高。")];
  beats[1].visual.pinyin = "Tā bǐ wǒ gāo.";
  const focus = lessonFocus(beats);
  assert.deepEqual(focus, { hanzi: "比", pinyin: "bǐ" });
  assert.deepEqual(cardTokens(beats[0].visual, focus).chars.map((c) => c.focus), [false]);
  const tokens = cardTokens(beats[1].visual, focus);
  assert.deepEqual(tokens.chars.filter((c) => c.focus).map((c) => c.ch), ["比"]);
  assert.deepEqual(tokens.words.filter((w) => w.focus).map((w) => w.word), ["bǐ"]);
  assert.deepEqual(distinctCardBeats([...beats, beat("dup", 60, scene("a"), "他比我高")], 2).map((b) => b.id), ["one", "two"]);
});

test("graphics keep identical nodes, morph moved ones, draw new ones and retire removed ones", () => {
  const previous = { width: 600, height: 400, tracks: [], nodes: [
    { id: "g", type: "g", attrs: {} },
    { id: "head", parentId: "g", type: "circle", attrs: { cx: 100, cy: 100, r: 20, fill: "teal" } },
    { id: "arrow", parentId: "g", type: "path", attrs: { d: "M 0 0 L 10 10", stroke: "gold", strokeWidth: 4 } },
    { id: "old", parentId: "g", type: "rect", attrs: { x: 0, y: 0, width: 5, height: 5, fill: "red" } }] };
  const current = { ...previous, nodes: [previous.nodes[0], previous.nodes[1],
    { ...previous.nodes[2], attrs: { ...previous.nodes[2].attrs, d: "M 0 0 L 30 50" } },
    { id: "new", parentId: "g", type: "line", attrs: { x1: 0, y1: 0, x2: 9, y2: 9, stroke: "red", strokeWidth: 3 } }] };
  const diff = diffGraphicNodes(previous, current);
  assert.deepEqual(Object.fromEntries(diff.status), { g: "same", head: "same", arrow: "morph", new: "enter" });
  assert.deepEqual(diff.exiting, ["old"]);
  assert.equal(lerpGraphicAttrs(previous.nodes[2].attrs, current.nodes[2].attrs, 0.5).d, "M 0 0 L 20 30");
  const reshaped = { ...previous, nodes: [{ ...previous.nodes[2], attrs: { d: "M 0 0 C 1 1 2 2 3 3", stroke: "gold" } }] };
  assert.equal(diffGraphicNodes(previous, reshaped).status.get("arrow"), "enter", "different path structure is redrawn");
});

test("sound design: cue-bound, spaced, no opening cue and every file exists", () => {
  const scenes = [
    { id: "hook", kind: "hook", from: 0, beats: [beat("h1", 0, scene("a")), beat("h2", 60, scene("b", "correct"), "他比我高")] },
    { id: "rule", kind: "context", from: 200, beats: [beat("r1", 0, { layout: "board", images: ["b"], overlay: "compare" }),
      beat("r2", 50, { layout: "board", images: ["b"], overlay: "stamp" }, "很")] },
    { id: "cta", kind: "cta", from: 400, beats: [] },
  ];
  const events = planProSfx({ scenes, config });
  assert.ok(events.every((event) => event.frame > 0), "nothing on the very first beat");
  assert.ok(events.some((event) => event.id === "chime" && event.frame === 60), "positive reaction gets the chime");
  assert.ok(events.some((event) => event.id === "impact" && event.reason === "r2:stamp"));
  assert.ok(events.some((event) => event.id === "shimmer" && event.frame === 400), "CTA light leak");
  for (let i = 1; i < events.length; i++)
    assert.ok(events[i].frame - events[i - 1].frame >= config.sound.minGapFrames, "events keep their gap");
  for (const sound of Object.values(PRO_SFX))
    assert.ok(fs.existsSync(new URL("../public/" + sound.file, import.meta.url)), sound.file);
  assert.deepEqual(planProSfx({ scenes, config: { ...config, sound: { ...config.sound, enabled: false } } }), []);
});

test("formula chips pair each pinyin word with its characters, or fall back to single characters", () => {
  assert.deepEqual(formulaChips({ hanzi: "今天比昨天冷。", pinyin: "Jīntiān bǐ zuótiān lěng." }),
    [{ hanzi: "今天", pinyin: "Jīntiān" }, { hanzi: "比", pinyin: "bǐ" }, { hanzi: "昨天", pinyin: "zuótiān" }, { hanzi: "冷", pinyin: "lěng" }]);
  assert.deepEqual(formulaChips({ hanzi: "他比我高", pinyin: "tā bǐ" }).map((chip) => chip.pinyin), [null, null, null, null],
    "a pinyin line that does not cover every character is not guessed");
});

test("visual modes: art establishes, a sentence becomes a formula that lights its spoken words, contrast and wrong forms get slides", () => {
  const plain = (id, at, hanzi, pinyin, overlay) => {
    const b = beat(id, at, scene("a"), hanzi);
    b.visual.pinyin = pinyin;
    if (overlay) b.visual.illustration.overlay = overlay;
    return b;
  };
  const beats = [plain("open", 0, "高", "gāo"), plain("rule", 30, "他比我高。", "Tā bǐ wǒ gāo."),
    plain("him", 60, "他", "tā"), plain("bi", 90, "比", "bǐ"), plain("bad", 120, "他比我很高", "tā bǐ wǒ hěn gāo", "stamp"),
    plain("pair", 150, "今天 · 昨天", "jīntiān · zuótiān")];
  const focus = lessonFocus(beats);
  const modes = planVisualModes(beats, focus);
  assert.equal(modes[0].mode, "art", "the first beat establishes the art");
  assert.deepEqual([modes[1].template, modes[1].highlight], ["formula", null]);
  assert.deepEqual(modes.slice(2, 4).map((mode) => [mode.mode, mode.template, mode.formulaBeat, mode.highlight]),
    [["slide", "formula", 1, "他"], ["slide", "formula", 1, "比"]], "named words light up on the same formula");
  assert.equal(modes[2].content, modes[1].content, "the same formula slide stays on screen");
  assert.equal(modes[4].wrong, true);
  assert.equal(modes[4].mode, "slide");
  assert.deepEqual([modes[5].mode, modes[5].template], ["slide", "contrast"]);
  const board = planVisualModes([beat("b", 0, { layout: "board", images: ["board"] }, "比")], focus);
  assert.equal(board[0].mode, "slide", "a board scene is told in slides from its first beat");
});

test("slide themes vary by scene, a wrong-form scene turns ember, and slide frames are reported for the subtitle", () => {
  const wrongBeat = beat("w", 0, { ...scene("a"), overlay: "stamp" });
  const scenes = [{ beats: [beat("a", 0, scene("a"))] }, { beats: [beat("b", 0, scene("a"))] }, { beats: [wrongBeat] },
    { beats: [beat("c", 0, scene("a"))] }, { beats: [beat("d", 0, scene("a"))] }];
  const themes = planSlideThemes(scenes, config);
  assert.equal(themes[2], config.slide.wrongTheme);
  for (let i = 1; i < themes.length; i++) assert.notEqual(themes[i], themes[i - 1]);
  const lesson = [beat("h1", 0, scene("a"), "高"), beat("h2", 40, scene("b"), "比"), beat("h3", 80, scene("b"), "比较")];
  const ranges = slideFrameRanges([{ kind: "hook", from: 100, durationFrames: 120, beats: lesson },
    { kind: "cta", from: 220, durationFrames: 60, beats: lesson }], lessonFocus(lesson));
  assert.deepEqual(ranges, [{ from: 140, to: 220 }], "back-to-back slides merge up to the scene end; the CTA never has slides");
});
