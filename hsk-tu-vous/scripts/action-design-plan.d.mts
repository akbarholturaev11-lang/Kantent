export type ActionModel = {kind?:string;title:string;hanzi:string;pinyin:string;meaning:string;object?:string;count?:number;grouped?:boolean;focus?:string;parts?:string[];value?:number;choices?:string[];selected?:string;models?:ActionModel[]};
export const ACTION_KINDS:string[];
export const ACTION_OBJECTS:string[];
export function validateActionVisual(beat:{id:string;kind:string;explains?:string;visual?:ActionModel}):void;
export function validateActionLesson(episode:{scenes:{id:string;kind:string;motionBeats?:{id:string;kind:string;cueText:string;cueOccurrence?:number;explains?:string;visual?:ActionModel}[]}[]}):{sceneCount:number;actionCount:number;note:string};
