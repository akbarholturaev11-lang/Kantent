import type {GraphicScene} from "./graphic-scene.mjs";
export type ActionModel = {kind?:string;title:string;hanzi:string;pinyin:string;meaning:string;object?:string;count?:number;grouped?:boolean;focus?:string;parts?:string[];value?:number;choices?:string[];selected?:string;models?:ActionModel[];graphic?:GraphicScene};
export const ACTION_KINDS:string[];
export const ACTION_OBJECTS:string[];
export function validateActionVisual(beat:{id:string;kind:string;explains?:string;visual?:ActionModel}):void;
export function validateActionLesson(episode:{scenes:{id:string;kind:string;motionBeats?:{id:string;kind:string;cueText:string;cueOccurrence?:number;explains?:string;visual?:ActionModel}[]}[]},options?:{requireVisibleChange?:boolean}):{sceneCount:number;actionCount:number;note:string};
export function visibleActionStates(scene:{motionBeats:{kind:string;visual:ActionModel}[]}):unknown[];
export function validateVisualHold(scene:{id:string;startMs:number;endMs:number;motionBeats:{kind:string;visual:ActionModel}[]},beats:{startMs:number}[],maximumSec:number):{longestHoldMs:number;intervals:{fromMs:number;toMs:number}[]};
