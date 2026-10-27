import type {TimedCaption} from './caption-utils.mjs';
export function resolvePromoCue(scene:{id:string;startMs?:number;endMs?:number;promoVisual?:{cueText:string}},captions:TimedCaption[],fps?:number,locale?:string):{localFrame:number;startMs:number;endMs:number;startFrame:number};
