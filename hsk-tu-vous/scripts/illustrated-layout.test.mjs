import test from "node:test";
import assert from "node:assert/strict";
import { ILLUSTRATED_LAYOUT as L, blockedBands, subtitleTopFor } from "./illustrated-layout.mjs";

const anchors = { a: { x: 0.11, y: 0.385, w: 0.36, h: 0.6 }, b: { x: 0.55, y: 0.645, w: 0.36, h: 0.295 } };
const free = (ill) => {
  const top = subtitleTopFor(ill);
  return blockedBands(ill).every(([a, b]) => top + L.subtitleHeightPx <= a || top >= b);
};

test("all text stays inside the Reels/Shorts safe band", () => {
  assert.ok(L.brandTopPx >= L.safeTopPx && L.headlineTopPx >= L.safeTopPx);
  for (const ill of [{ layout: "scene", anchors }, { layout: "scene", anchors, focus: "a" }, { layout: "scene", anchors, focus: "b" },
    { layout: "pair" }, { layout: "board" }]) {
    const top = subtitleTopFor(ill);
    assert.ok(top >= L.chipBottomPx && top + L.subtitleHeightPx <= L.safeBottomPx, JSON.stringify(ill));
  }
});

test("the subtitle moves to a slot that covers no head, card or formula", () => {
  for (const ill of [{ layout: "scene", anchors }, { layout: "scene", anchors, focus: "b" }, { layout: "pair" }, { layout: "board" }])
    assert.ok(free(ill), JSON.stringify(ill));
  // The real Aobao frame: the man's head occupies the top slot, so it moves down.
  assert.notEqual(subtitleTopFor({ layout: "scene", anchors }), L.subtitleSlotsPx[0]);
  assert.equal(subtitleTopFor({ layout: "pair" }), L.subtitleSlotsPx[0]);
});
