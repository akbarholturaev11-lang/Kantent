/**
 * Safe-zone layout for illustrated lesson frames (owner feedback 2026-11-09:
 * text placed at the very top is covered by the Instagram/YouTube interface).
 *
 * All text sits inside the vertical safe band of a 1080x1920 Reel/Short
 * (below the top header area, above the bottom caption/buttons area). The
 * subtitle line is not fixed: for every beat it takes the first slot that
 * does not cover a subject's head under that beat's camera, a card or the
 * formula. Pure and deterministic, shared by the renderer and the tests.
 */
export const ILLUSTRATED_LAYOUT = {
  width: 1080, height: 1920,
  safeTopPx: 250, safeBottomPx: 1520,
  brandTopPx: 262, headlineTopPx: 348, chipTopPx: 560, chipBottomPx: 780,
  subtitleSlotsPx: [720, 1090, 1200, 1430], subtitleHeightPx: 80,
  pairTopPx: 820, pairHeightPx: 580, boardTopPx: 960, boardHeightPx: 260,
  // A 9:16 illustration cover-fitted to the frame (768x1376 source).
  sceneImageHeightPx: 1935, sceneImageTopPx: -7.5,
};

export function cameraFor(ill) {
  const box = ill?.focus && ill.anchors?.[ill.focus];
  if (ill?.layout === "scene" && box) return { scale: 1.28, cx: box.x + box.w / 2, cy: box.y + box.h * 0.42 };
  return { scale: 1, cx: 0.5, cy: 0.6 };
}

/**
 * Screen-space boxes text must not cover for this beat: each subject's head
 * (the upper part of its anchor box), the pair cards or the formula.
 */
export function blockedBoxes(ill) {
  const L = ILLUSTRATED_LAYOUT;
  if (!ill) return [];
  if (ill.layout === "pair") return [{ x0: 0, x1: L.width, y0: L.pairTopPx - 20, y1: L.pairTopPx + L.pairHeightPx + 30 }];
  if (ill.layout === "board") return [{ x0: 0, x1: L.width, y0: L.boardTopPx - 40, y1: L.boardTopPx + L.boardHeightPx }];
  const camera = cameraFor(ill);
  const h = L.sceneImageHeightPx, w = L.width;
  const sy = (v) => L.sceneImageTopPx + camera.cy * h + (v - camera.cy) * h * camera.scale;
  const sx = (u) => camera.cx * w + (u - camera.cx) * w * camera.scale;
  return Object.values(ill.anchors ?? {}).map((box) => {
    const top = sy(box.y);
    return { x0: sx(box.x) - 20, x1: sx(box.x + box.w) + 20, y0: top - 20,
      // The head is the upper part of the subject: at most a square as tall
      // as the subject is wide and never more than 35% of its height (a wide
      // crane box must not block the whole lower frame).
      y1: Math.min(sy(box.y + box.h * 0.35), top + box.w * w * camera.scale) + 10 };
  });
}

/** Back-compatible vertical view of the blocked boxes. */
export function blockedBands(ill) {
  return blockedBoxes(ill).map((box) => [box.y0, box.y1]);
}

const SLOT_WIDTH = { center: [80, 1000], left: [50, 510], right: [570, 1030] };
// Owner rule 2026-11-09: subtitles prefer the BOTTOM of the safe band and
// move up or sideways only when the bottom would cover a face, card or formula.
const SLOTS = [
  ["center", 1430], ["left", 1430], ["right", 1430],
  ["center", 1320], ["left", 1320], ["right", 1320],
  ["center", 1200], ["left", 1200], ["right", 1200],
  ["center", 1090], ["left", 1090], ["right", 1090], ["center", 720],
];

/** The subtitle box for a beat: the first slot that covers no blocked box. */
export function subtitleSlotFor(ill) {
  const L = ILLUSTRATED_LAYOUT;
  const boxes = blockedBoxes(ill);
  const candidates = SLOTS.map(([align, top]) => {
    const [left, right] = SLOT_WIDTH[align];
    const height = align === "center" ? L.subtitleHeightPx : L.subtitleHeightPx * 1.6;
    return { align, top, left, right, height };
  }).filter((slot) => slot.top >= L.chipBottomPx && slot.top + slot.height <= L.safeBottomPx + 40);
  const overlap = (slot) => boxes.reduce((sum, box) => sum +
    Math.max(0, Math.min(box.x1, slot.right) - Math.max(box.x0, slot.left)) *
    Math.max(0, Math.min(box.y1, slot.top + slot.height) - Math.max(box.y0, slot.top)), 0);
  return candidates.find((slot) => overlap(slot) === 0) ??
    candidates.reduce((best, slot) => (overlap(slot) < overlap(best) ? slot : best), candidates[0]);
}

export function subtitleTopFor(ill) {
  return subtitleSlotFor(ill).top;
}
