export type DirectedTransition={
  kind:"cut"|"crossfade"|"slide-match"|"masked-reveal"|"focus-reveal";
  frames:number;direction?:"left"|"right";
};
export type MotionTransitionStyle={
  opacity:number;transform:string;clipPath:string;filter:string;
};
export function validateMotionTransition(value:DirectedTransition):DirectedTransition;
export function resolveMotionTransition(
  value:DirectedTransition,frame:number,
  options?:{slideDistancePx?:number;focusBlurPx?:number}
):{progress:number;incoming:MotionTransitionStyle;outgoing:MotionTransitionStyle};
