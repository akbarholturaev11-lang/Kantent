import { readStorytellingPolicy } from "./storytelling-plan.mjs";

const tokens = text => String(text ?? "").normalize("NFKC").toLocaleLowerCase("ru-RU")
  .replace(/ё/gu,"е").match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];

function timedCue(episode, sceneId, cueText) {
  const scene = episode.scenes.find(s=>s.id===sceneId && s.kind!=="cta");
  if (!scene || !Number.isFinite(scene.startMs) || !Number.isFinite(scene.endMs))
    throw Error("Adaptive timed cue needs an imported teaching scene: "+sceneId);
  const cue=tokens(cueText);
  if (!cue.length) throw Error(sceneId+": no cue tokens");
  const words=(episode.captions??[]).filter(c=>c.startMs>=scene.startMs && c.endMs<=scene.endMs)
    .map(c=>({parts:tokens(c.text),startMs:c.startMs,endMs:c.endMs}));
  if(words.some(w=>w.parts.length!==1 || !Number.isFinite(w.startMs) ||
      !Number.isFinite(w.endMs) || w.endMs<=w.startMs))
    throw Error(sceneId+": exact single-word timed captions required for storytelling");
  const matches=[];
  for(let i=0;i<=words.length-cue.length;i++){
    if(cue.every((word,j)=>words[i+j].parts[0]===word))
      matches.push({startMs:words[i].startMs,endMs:words[i+cue.length-1].endMs});
  }
  if(matches.length!==1) throw Error(sceneId+": narrative cue timing missing or ambiguous ("+matches.length+")");
  return {...matches[0],sceneId,cueText};
}

export function validateStorytellingWordTiming(episode, policy = readStorytellingPolicy()) {
  if (!episode.storytelling) return null;
  if(episode.captionSource!=="gemini-word-timestamps" || !episode.captions?.length)
    throw Error("Adaptive storytelling needs imported verified Gemini word timestamps before rendering");
  const teaching=episode.scenes.filter(s=>s.kind!=="cta");
  const start=teaching[0]?.startMs, end=teaching.at(-1)?.endMs;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)
    throw Error("Adaptive lesson teaching duration is not verified");
  const first=timedCue(episode,episode.storytelling.firstPayoff.sceneId,episode.storytelling.firstPayoff.cueText);
  if((first.endMs-start)/(end-start)>policy.firstPayoffLatestRatio)
    throw Error("Adaptive first payoff is too late in actual Gemini word timing");
  const reHooks=episode.storytelling.reHooks.map(x=>{
    const rehook=timedCue(episode,x.sceneId,x.cueText);
    const payoff=timedCue(episode,x.payoffSceneId,x.payoffCueText);
    if(rehook.startMs<=first.endMs || payoff.startMs<=rehook.endMs)
      throw Error("Adaptive Re-hook and answer overlap or appear before first payoff");
    return {rehook,payoff};
  });
  return {firstPayoff:first,reHooks,source:"gemini-word-timestamps",
    teachingDurationMs:end-start,provenance:"actual imported word cues"};
}
