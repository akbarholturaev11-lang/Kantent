import test from "node:test";
import assert from "node:assert/strict";
import { validateIllustration } from "./action-design-plan.mjs";
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
