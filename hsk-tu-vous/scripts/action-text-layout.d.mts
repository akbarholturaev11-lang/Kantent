import type { ActionModel } from "./action-design-plan.mjs";
import type { ResolvedMotionBeat } from "./motion-design-plan.mjs";
export type ActionTextLayout = {model: ActionModel; models: ActionModel[]; kind: string};
export type ActionCaptionScene = {from: number; durationFrames: number; beats: ResolvedMotionBeat[]};
export function actionTextAtFrame(scenes: ActionCaptionScene[], frame: number): ActionTextLayout | null;
export function buildActionCaptionScenes(episode: {motionDesignStyle?: string;scenes: {id:string;durationFrames?:number;durationSec?:number}[]}, cueTimeline: {scenes: {sceneId:string;motionBeats:ResolvedMotionBeat[]}[]} | null | undefined, fps?: number): ActionCaptionScene[];
export function actionSubtitlePresentation(text: string, layout: ActionTextLayout | null): {text: string; pinyin: string; focus: string; examples: {text: string; focus: string}[]};
export function validateActionSubtitlePages(pages: {text:string;startMs:number;endMs:number}[], actionCaptionScenes: ActionCaptionScene[], fps?: number): {pageCount:number;checkedFrames:string};
