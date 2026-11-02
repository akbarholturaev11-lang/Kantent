import {groupTimedCaptions} from "./caption-utils.mjs";

/**
 * M6 technical caption gate: avoid announcing a future spoken word on screen
 * in the high-precision action lesson. Every action word page starts at its
 * own imported word timestamp. CTA and other styles retain legacy grouping.
 * No change to voice, timings, subtitles' actual text, or total duration.
 */
export function groupExactActionCaptions(captions,style,sections,actionScenes,fps=30){
  if(!Number.isFinite(fps)||fps<=0)throw Error("Caption sync requires valid fps");
  const scoped=sections.map(section=>{
    const start=(section.startMs/1000)*fps;
    const end=(section.endMs/1000)*fps;
    const isAction=actionScenes.some(scene=>
      Number.isFinite(scene.from)&&Number.isFinite(scene.durationFrames)&&
      Math.max(start,scene.from)<Math.min(end,scene.from+scene.durationFrames)-0.001
    );
    return {...section,...(isAction?{maxWordsPerPage:1}:{})};
  });
  return groupTimedCaptions(captions,{...style,sections:scoped});
}
