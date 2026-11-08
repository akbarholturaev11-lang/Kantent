type Box = { x: number; y: number; w: number; h: number };
type Illustration = { layout: "scene" | "pair" | "board"; anchors?: Record<string, Box>; focus?: string } | unknown;
export declare const ILLUSTRATED_LAYOUT: {
  width: number; height: number; safeTopPx: number; safeBottomPx: number;
  brandTopPx: number; headlineTopPx: number; chipTopPx: number; chipBottomPx: number;
  subtitleSlotsPx: number[]; subtitleHeightPx: number;
  pairTopPx: number; pairHeightPx: number; boardTopPx: number; boardHeightPx: number;
  sceneImageHeightPx: number; sceneImageTopPx: number;
};
export declare function cameraFor(ill: Illustration | undefined): { scale: number; cx: number; cy: number };
export declare function blockedBands(ill: Illustration | undefined): [number, number][];
export declare function subtitleTopFor(ill: Illustration | undefined): number;
export declare function blockedBoxes(ill: Illustration | undefined): { x0: number; x1: number; y0: number; y1: number }[];
export declare function subtitleSlotFor(ill: Illustration | undefined): { align: "center" | "left" | "right"; top: number; left: number; right: number; height: number };
