import type {ActionModel} from "./action-design-plan.mjs";
export type MotionBeat = {id:string;kind:string;cueText:string;cueOccurrence?:number;explains?:string;visual?:ActionModel};
export type MotionCue = {text:string;startMs:number;endMs:number};
export type MotionScene = {id:string;kind?:string;startMs?:number;endMs?:number;motionBeats?:MotionBeat[]};
export type ResolvedMotionBeat = MotionBeat & {startMs:number;endMs:number;startFrame:number;localFrame:number;captionIndex:number};
export const MOTION_KINDS: string[];
export function resolveMotionBeats(scene:MotionScene,captions:MotionCue[],fps?:number,locale?:string):ResolvedMotionBeat[];
export function compileMotionDesignTimeline(episode:{id:string;date?:string;languageCode?:string;motionDesign?:boolean;motionDesignStyle?:string;captionSource?:string;captions?:MotionCue[];scenes:MotionScene[]},policy?:{visibleStateValidationFromDate:string;maximumVisualHoldSec:number}):null|{schemaVersion:number;episodeId:string;style:string;timingSource:string;scenes:{sceneId:string;beats:ResolvedMotionBeat[]}[]};
