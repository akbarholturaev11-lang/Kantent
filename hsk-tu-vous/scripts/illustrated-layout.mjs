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
  brandTopPx: 262, headlineTopPx: 348, chipTopPx: 560, chipBottomPx: 690,
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

/** Screen-space vertical bands that text must not cover for this beat. */
export function blockedBands(ill) {
  const L = ILLUSTRATED_LAYOUT;
  if (!ill) return [];
  if (ill.layout === "pair") return [[L.pairTopPx - 20, L.pairTopPx + L.pairHeightPx + 30]];
  if (ill.layout === "board") return [[L.boardTopPx - 40, L.boardTopPx + L.boardHeightPx]];
  const camera = cameraFor(ill);
  const h = L.sceneImageHeightPx;
  const screenY = (v) => L.sceneImageTopPx + camera.cy * h + (v - camera.cy) * h * camera.scale;
  // The head is the top part of each subject box.
  return Object.values(ill.anchors ?? {}).map((box) => [screenY(box.y) - 20, screenY(box.y + box.h * 0.3) + 10]);
}

export function subtitleTopFor(ill) {
  const L = ILLUSTRATED_LAYOUT;
  const bands = blockedBands(ill);
  const overlap = (top) => bands.reduce((sum, [a, b]) =>
    sum + Math.max(0, Math.min(b, top + L.subtitleHeightPx) - Math.max(a, top)), 0);
  const slots = L.subtitleSlotsPx.filter((top) => top >= L.chipBottomPx && top + L.subtitleHeightPx <= L.safeBottomPx);
  return slots.find((top) => overlap(top) === 0) ??
    slots.reduce((best, top) => (overlap(top) < overlap(best) ? top : best), slots[0]);
}
