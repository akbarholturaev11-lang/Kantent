/** P4, browser-safe REMOTION AUDIO ONLY TEST plan gate. NO implicit audio or API. */
import {assertCueTimelineMatches} from "./cue-timeline.mjs";
export const SOUNDKIT_P4_MODE="TEST_ONLY";
const SHA=/^[a-f0-9]{64}$/;
const FILE=/^soundkit-p4-preview-[a-z0-9-]+\/[a-f0-9]{64}\.wav$/;
const soundId=/^kenney-(?:ui-audio|interface-sounds)\/[a-z0-9._-]+\.wav$/;

function assertBoundEffect(episode,timeline,selected){
  const sceneIndex=episode.scenes.findIndex(s=>s.id===selected.sceneId);
  if(sceneIndex<=0||sceneIndex>=episode.scenes.length)throw Error("SoundKit P4 invalid or protected first scene");
  const scene=episode.scenes[sceneIndex];
  if(scene.kind==="hook"||scene.kind==="cta")throw Error("SoundKit P4 cannot play in hook or CTA");
  const match=timeline.scenes[sceneIndex];
  if(match?.sceneId!==selected.sceneId)throw Error("SoundKit P4 scene differs from cue timeline");
  if(!soundId.test(selected.soundId)||
     !SHA.test(selected.assetSha256??"")||
     !FILE.test(selected.staticSrc??"")||
     !selected.staticSrc.endsWith("/"+selected.assetSha256+".wav"))
    throw Error("SoundKit P4 sound source is not an isolated SHA-named staged WAV");
  if(!Number.isInteger(selected.startFrame)||!Number.isInteger(selected.clipFrames)||
     !Number.isInteger(selected.endFrame)||!Number.isInteger(selected.hardDeadlineFrame)||
     selected.clipFrames<2 ||selected.clipFrames>180 ||
     selected.endFrame!==selected.startFrame+selected.clipFrames ||
     selected.endFrame>selected.hardDeadlineFrame ||
     selected.startFrame!==Math.ceil(selected.startMs*timeline.fps/1000))
    throw Error("SoundKit P4 effect frames invalid or outside verified clip limits");
  if(!Number.isInteger(selected.captionIndex)||selected.captionIndex<0||
     timeline.wordCues[selected.captionIndex]?.startMs!==selected.startMs ||
     !Number.isFinite(selected.endCueMs)||selected.endCueMs<=selected.startMs||
     selected.startMs<scene.startMs||selected.startMs>=scene.endMs||
     selected.endFrame>Math.floor(scene.endMs*timeline.fps/1000))
    throw Error("SoundKit P4 word anchor is not the imported scene cue");
  const resolved=(match.motionBeats??[]).find(b=>b.id===selected.eventId)
    ??(selected.eventId===selected.sceneId+"-visual"?match.promoCue:null);
  if(!resolved||resolved.startFrame!==selected.startFrame||
     resolved.startMs!==selected.startMs||
     resolved.captionIndex!==selected.captionIndex||
     resolved.endMs!==selected.endCueMs)
    throw Error("SoundKit P4 chosen visual cue does not equal an imported word event");
  if(!Number.isFinite(selected.volume)||selected.volume<=0||selected.volume>0.09)
    throw Error("SoundKit P4 requires voice-subordinate test gain");
  return true;
}
export function assertSoundKitRenderPlanMatches(episode,timeline,plan){
  if(!episode||!timeline||!plan||
     plan.schemaVersion!==1||plan.mode!==SOUNDKIT_P4_MODE||
     plan.phase!=="P4_ISOLATED_MIX_REVIEW"||
     plan.productionEffectsEnabled!==false||
     plan.audioMixTestOnly!==true||
     plan.ownerApprovalGranted!==false||
     plan.removesLegacySoundCues!==true||
     plan.episodeId!==episode.id||plan.languageCode!==episode.languageCode||
     plan.voiceTextHash!==episode.voiceTextHash||
     !SHA.test(episode.audioSha256??"")||
     plan.audioSha256!==episode.audioSha256 ||
     plan.fps!==30||timeline.fps!==30||
     plan.timelineVoiceTextHash!==timeline.voiceTextHash||
     plan.timelineAudioSha256!==timeline.audioSha256 ||
     !Array.isArray(plan.selected)||plan.selected.length>episode.scenes.length-1)
    throw Error("SoundKit P4 TEST-only plan does not match actual imported voice, timeline or approvals");
  assertCueTimelineMatches(episode,timeline,30);
  const ids=new Set(),frames=new Set();
  let prev=-1;
  for(const selected of plan.selected){
    assertBoundEffect(episode,timeline,selected);
    const key=selected.sceneId+"/"+selected.eventId;
    if(ids.has(key)||frames.has(selected.startFrame)||selected.startFrame<=prev)
      throw Error("SoundKit P4 overlapping/repeated or unordered effect at spoken cue");
    prev=selected.startFrame;
    ids.add(key);frames.add(selected.startFrame);
    if(plan.selected.some(other=>other!==selected&&
       selected.startFrame<other.endFrame&&other.startFrame<selected.endFrame))
      throw Error("SoundKit P4 overlapping effects may mask voice");
  }
  return true;
}
export function makeSoundKitRenderPlan(episode,timeline,p3,staticAssets,visualSound){
  if(!p3||p3.mode!=="TEST_ONLY"||p3.phase!=="P3_EXACT_CUE_BINDING"||
     p3.audioMixProduced!==false||p3.renderEnabled!==false||
     p3.audioSha256!==episode?.audioSha256||
     p3.voiceTextHash!==episode?.voiceTextHash||
     p3.languageCode!==episode?.languageCode||
     p3.fps!==30||!Array.isArray(p3.selected)||
     !staticAssets||typeof staticAssets!=="object")
    throw Error("SoundKit P4 requires exact already-verified non-rendered P3 sound intent");
  const baseVolume=Math.min(visualSound?.sceneCueVolume,visualSound?.beatCueVolume);
  if(!Number.isFinite(baseVolume)||baseVolume<=0||baseVolume>0.15)
    throw Error("SoundKit P4 requires canonical safe SFX volume tokens");
  const volume=Math.min(0.045,baseVolume*0.5); // deliberate half-strength opt-in audition
  const selected=p3.selected.map(x=>{
    const staticSrc=staticAssets[x.soundId];
    if(typeof staticSrc!=="string")throw Error("SoundKit P4 staging missing selected WAV");
    if(x.truncatedForNextCue&&x.clipFrames<3)
      throw Error("SoundKit P4 cannot do an unsafe abrupt truncation");
    return {...x,staticSrc,volume};
  });
  const plan={
    schemaVersion:1,mode:SOUNDKIT_P4_MODE,phase:"P4_ISOLATED_MIX_REVIEW",
    productionEffectsEnabled:false,audioMixTestOnly:true,
    ownerApprovalGranted:false,removesLegacySoundCues:true,
    episodeId:episode.id,languageCode:episode.languageCode,
    voiceTextHash:episode.voiceTextHash,audioSha256:episode.audioSha256,
    timelineVoiceTextHash:timeline.voiceTextHash,
    timelineAudioSha256:timeline.audioSha256,fps:30,
    sourceCueTimelineSha256:p3.cueTimelineSha256,
    p3SourceSha256:p3.sourceSha256,p3LibrarySha256:p3.librarySha256,
    p3PolicySha256:p3.policySha256,
    selected,
  };
  assertSoundKitRenderPlanMatches(episode,timeline,plan);
  return plan;
}
