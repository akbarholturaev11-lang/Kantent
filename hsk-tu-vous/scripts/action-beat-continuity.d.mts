import type {ResolvedMotionBeat} from "./motion-design-plan.mjs";

export type ActionBeatLayer = {
  beat: ResolvedMotionBeat;
  localFrame: number;
  opacity: number;
};
export function resolveActionBeatLayers(
  beats: ResolvedMotionBeat[],
  frame: number,
  transitionFrames?: number,
): {
  active: ResolvedMotionBeat;
  incoming: ActionBeatLayer;
  outgoing: ActionBeatLayer | null;
};
