import test from "node:test";
import assert from "node:assert/strict";
import { ILLUSTRATED_LAYOUT as L, blockedBoxes, subtitleSlotFor, subtitleTopFor } from "./illustrated-layout.mjs";

const anchors = { a: { x: 0.11, y: 0.385, w: 0.36, h: 0.6 }, b: { x: 0.55, y: 0.645, w: 0.36, h: 0.295 } };
const free = (ill) => {
  const slot = subtitleSlotFor(ill);
  return blockedBoxes(ill).every((box) => slot.right <= box.x0 || slot.left >= box.x1 ||
    slot.top + slot.height <= box.y0 || slot.top >= box.y1);
};

test("all text stays inside the Reels/Shorts safe band", () => {
  assert.ok(L.brandTopPx >= L.safeTopPx && L.headlineTopPx >= L.safeTopPx);
  for (const ill of [{ layout: "scene", anchors }, { layout: "scene", anchors, focus: "a" }, { layout: "scene", anchors, focus: "b" },
    { layout: "pair" }, { layout: "board" }]) {
    const top = subtitleTopFor(ill);
    assert.ok(top >= L.chipBottomPx && top + subtitleSlotFor(ill).height <= L.safeBottomPx + 40, JSON.stringify(ill));
  }
});

test("the subtitle moves to a slot that covers no head, card or formula", () => {
  for (const ill of [{ layout: "scene", anchors }, { layout: "scene", anchors, focus: "b" }, { layout: "pair" }, { layout: "board" }])
    assert.ok(free(ill), JSON.stringify(ill));
  // Real Aobao frame: the man's head blocks the upper slots and Aobao's big
  // head the lower right, so the line moves to the left, below the head.
  assert.deepEqual([subtitleSlotFor({ layout: "scene", anchors }).align, subtitleTopFor({ layout: "scene", anchors })], ["left", 1430]);
  assert.equal(subtitleTopFor({ layout: "pair" }), 1430, "bottom first when nothing is covered");
  assert.equal(subtitleTopFor({ layout: "board" }), 1430);
});
