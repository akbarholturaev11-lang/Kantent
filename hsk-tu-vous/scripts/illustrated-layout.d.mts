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
