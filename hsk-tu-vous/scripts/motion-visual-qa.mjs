/**
 * M6 review evidence, not subjective/cinematic approval.
 * Pure preflight: every director shot must map to authored original speech
 * and real drawable art. The timing source is *declared* by the episode;
 * final authenticity still needs matching Gemini audio and owner review.
 */
import {resolveMotionBeats} from "./motion-design-plan.mjs";
import {compileMotionDirectorScene} from "./motion-director-plan.mjs";
import {groupExactActionCaptions} from "./action-caption-grouping.mjs";
import visual from "../content/visual-system.json" with {type:"json"};

const finite=n=>typeof n==="number"&&Number.isFinite(n);
const fail=(message)=>{throw Error("Motion QA: "+message)};
export function createMotionQaPlan(episode,{fps=30,captionStyle=visual.captions}={}){
  if(!Number.isInteger(fps)||fps<1||fps>120)fail("invalid FPS");
  if(!episode||!Array.isArray(episode.scenes)||!Array.isArray(episode.captions))
    fail("episode and imported captions are required");
  if(episode.motionDesignStyle!=="explain-actions-v1"||
     episode.captionSource!=="gemini-word-timestamps")fail("only explicit word-cued action episodes supported");
  const captions=episode.captions;
  for(let i=0;i<captions.length;i++){
    const c=captions[i];
    if(!finite(c.startMs)||!finite(c.endMs)||c.endMs<=c.startMs||
       (i>0&&c.startMs<captions[i-1].startMs))
      fail("unsorted or invalid real-word timestamps");
  }
  const actionScenes=episode.scenes.filter(s=>s.motionBeats?.length);
  if(!actionScenes.length)fail("no narrated action scenes");
  const evidence=[];
  for(const scene of actionScenes){
    if(!scene.motionDirection)fail(scene.id+": needs explicit directed shot plan for review");
    if(!finite(scene.startMs)||!finite(scene.endMs)||scene.endMs<=scene.startMs)
      fail(scene.id+": invalid scene timing");
    const beatPlan=resolveMotionBeats(scene,captions,fps,episode.languageCode??"ru-RU");
    const compiled=compileMotionDirectorScene(scene,beatPlan);
    const beginning=Math.round(scene.startMs*fps/1000);
    const end=Math.ceil(scene.endMs*fps/1000);
    for(let i=0;i<compiled.shots.length;i++){
      const shot=compiled.shots[i],beat=beatPlan[i];
      if(shot.cueFrame!==beat.localFrame||shot.cueStartMs!==beat.startMs)
        fail(scene.id+": compiled shot timestamp mismatch");
      if(!beat.explains?.trim()||!beat.visual)
        fail(scene.id+"/"+shot.shotId+": no evidence of visual meaning");
      const cueGlobal=beginning+shot.cueFrame;
      if(cueGlobal<beginning||cueGlobal>=end)
        fail(scene.id+"/"+shot.shotId+": cue outside scene bounds");
      const transition=shot.transition.frames;
      if(i>0 && transition===0 && shot.transition.kind!=="cut")
        fail("unexpected zero transition");
      const next=compiled.shots[i+1];
      if(next && shot.cueFrame+Math.max(0,transition)>next.cueFrame)
        fail(scene.id+"/"+shot.shotId+": transition exceeds next word");
      const expectedAsset=beat.kind==="asset"?"asset:"+beat.visual.assetId:null;
      if(expectedAsset && !shot.assetIds.includes(expectedAsset))
        fail("asset in shot differs from authored meaning");
      evidence.push({
        sceneId:scene.id,shotId:shot.shotId,beatId:shot.beatId,
        subject:beat.visual.assetId??beat.visual.object??beat.kind,
        intendedMeaning:beat.explains,
        cueText:shot.meaningCue,cueOccurrence:shot.cueOccurrence,
        sourceCaptionIndex:beat.captionIndex,
        cueStartMs:shot.cueStartMs,cueEndMs:shot.cueEndMs,
        globalCueFrame:cueGlobal,
        transition:shot.transition,
        assetIds:shot.assetIds,
        camera:shot.camera,
        reviewFrames:{
          ...(cueGlobal>beginning?{before:cueGlobal-1}:{}),
          cue:cueGlobal,
          midpoint:Math.min(end-1,cueGlobal+Math.floor(Math.max(transition-1,0)/2)),
          settled:Math.min(end-1,cueGlobal+Math.max(transition-1,0)),
        },
        meaningVerifiedByHuman:false,
      });
    }
  }
  const scopedScenes=actionScenes.map(s=>({
    from:Math.round(s.startMs*fps/1000),durationFrames:Math.ceil((s.endMs-s.startMs)*fps/1000)
  }));
  // Section policy must stay consistent with the actual renderer's per-scene caption windows.
  const sections=episode.scenes.map(s=>({
    startMs:s.startMs,endMs:s.endMs,styleId:s.kind==="cta"?"ctaFooter":(s.captionStyleId??"highlight")
  })).filter(s=>finite(s.startMs)&&finite(s.endMs));
  const grouped=groupExactActionCaptions(captions,captionStyle,sections,scopedScenes,fps);
  for(const page of grouped){
    if(!page.text.trim()||!finite(page.startMs)||!finite(page.endMs)||page.endMs<=page.startMs)
      fail("invalid timed subtitle page");
  }
  for(const shot of evidence){
    const startWord=captions[shot.sourceCaptionIndex];
    if(!startWord||shot.cueStartMs!==startWord.startMs)
      fail("shot did not start on the exact imported caption cue");
  }
  return {
    schemaVersion:1,episodeId:episode.id,locale:episode.languageCode??null,
    fps,timingSourceDeclared:episode.captionSource,
    audioAuthenticity:"not-verified-by-this-check",
    productionApproved:false,fullHumanVisualApproval:false,
    sceneCount:actionScenes.length,shotCount:evidence.length,
    shots:evidence,
    rules:{
      exactWordCue:true,
      unknownAssetMustFail:true,
      audioAndCtaNotRetimed:true,
      onlyStructuralEvidence:true,
    },
  };
}
