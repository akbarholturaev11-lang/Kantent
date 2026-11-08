import test from "node:test";
import assert from "node:assert/strict";
import { HSK_CHARACTER_IDS, HSK_CHARACTER_MOODS, validateDistinctTextRoles, validateIllustration } from "./action-design-plan.mjs";
import { validateArtManifest } from "./generate-lesson-art.mjs";
import { readFileSync } from "node:fs";

const box = { x: .2, y: .35, w: .3, h: .6 };
test("illustrated beats name real art, a valid subject and a known overlay", () => {
  validateIllustration("ok", { layout: "scene", images: ["two-people"], anchors: { a: box, b: box }, focus: "a", overlay: "link" });
  validateIllustration("pair", { layout: "pair", images: ["yesterday-warm", "today-cold"], icons: ["icon-warm", null], focus: "right" });
  validateIllustration("board", { layout: "board", images: ["notebook-desk"], parts: ["A", "比", "B"] });
  assert.throws(() => validateIllustration("x", { layout: "scene", images: ["two-people"], overlay: "link" }), /anchors a and b/);
  assert.throws(() => validateIllustration("x", { layout: "pair", images: ["one"] }), /2 lesson-art/);
  assert.throws(() => validateIllustration("x", { layout: "scene", images: ["two-people"], focus: "c", anchors: { a: box } }), /focus/);
  assert.throws(() => validateIllustration("x", { layout: "scene", images: ["../secret"] }), /image name/);
  assert.throws(() => validateIllustration("x", { layout: "scene", images: ["two-people"], overlay: "sparkle" }), /unsupported overlay/);
  assert.throws(() => validateIllustration("x", { layout: "board", images: ["notebook-desk"], parts: [] }), /1–6/);
});

test("the lesson-art manifest is valid and its images contain no text by prompt", () => {
  const manifest = JSON.parse(readFileSync(new URL("../content/lesson-art/bi-comparison-height-20261104.json", import.meta.url), "utf8"));
  validateArtManifest(manifest);
  assert.match(manifest.style, /no text/i);
  assert.throws(() => validateArtManifest({ ...manifest, assets: [{ ...manifest.assets[1], references: ["missing"] }] }), /earlier asset/);
});

test("headline, chip and subtitle each keep their own job", () => {
  const ill = { layout: "board", images: ["notebook-desk"], parts: ["A"] };
  const beat = (title, cueText = "Формула одна", meaning = "A 比 B") => ({ id: "b", cueText, visual: { title, meaning, illustration: ill } });
  validateDistinctTextRoles(beat("Схема"));
  assert.throws(() => validateDistinctTextRoles(beat("Формула")), /spoken word "формула"/);
  assert.throws(() => validateDistinctTextRoles(beat("比?")), /Hanzi/);
  assert.throws(() => validateDistinctTextRoles(beat("Он выше меня", "他比我高", "Он выше меня.")), /chip meaning/);
});

test("only the HSK AI cast can appear, drawn from the app's exact registry", () => {
  const registry = JSON.parse(readFileSync(new URL("../content/characters/hsk-ai-characters.json", import.meta.url), "utf8"));
  assert.deepEqual(registry.characters.map((c) => c.id), HSK_CHARACTER_IDS);
  assert.deepEqual(registry.moods, HSK_CHARACTER_MOODS);
  for (const c of registry.characters) for (const mood of registry.moods) assert.match(c.svg[mood], /^<svg [^>]*viewBox=/);
  const scene = (cast) => ({ layout: "scene", images: ["hutong-street"], cast });
  validateIllustration("ok", scene([{ id: "crane", mood: "talk", x: .36, y: .93, h: .46 }, { id: "panda", x: .74, y: .93, h: .24 }]));
  assert.throws(() => validateIllustration("x", scene([{ id: "human", x: .5, y: .9, h: .5 }])), /only use HSK AI characters/);
  assert.throws(() => validateIllustration("x", scene([{ id: "panda", mood: "angry", x: .5, y: .9, h: .5 }])), /mood/);
});
