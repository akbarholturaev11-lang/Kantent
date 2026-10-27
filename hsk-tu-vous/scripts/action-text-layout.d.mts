import type { ActionModel } from "./action-design-plan.mjs";
import type { ResolvedMotionBeat } from "./motion-design-plan.mjs";
export type ActionTextLayout = {model: ActionModel; models: ActionModel[]; kind: string};
export type ActionCaptionScene = {from: number; durationFrames: number; beats: ResolvedMotionBeat[]};
export function actionTextAtFrame(scenes: ActionCaptionScene[], frame: number): ActionTextLayout | null;
export function actionSubtitlePresentation(text: string, layout: ActionTextLayout | null): {text: string; pinyin: string; focus: string; examples: {text: string; focus: string}[]};
