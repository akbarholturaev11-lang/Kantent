import type {TimedCaption,CaptionPage,CaptionGroupingStyle} from "./caption-utils.mjs";
export function groupExactActionCaptions(
  captions:TimedCaption[],
  style:CaptionGroupingStyle,
  sections:{startMs:number;endMs:number;styleId:string}[],
  actionScenes:{from:number;durationFrames:number}[],
  fps?:number
):CaptionPage[];
