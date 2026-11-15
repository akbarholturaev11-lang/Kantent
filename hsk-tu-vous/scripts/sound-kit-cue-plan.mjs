/**
 * SoundKit P3 — PURE, TEST ONLY speech/visual cue binder.
 * Does NOT modify any audio, Remotion props, published artifacts or cue source.
 * Requires actual imported narration bytes and an actual, source-matching
 * compiled cue timeline. Never guesses timestamps, scene/CTA timing or SFX.
 */
import {createHash} from "node:crypto";
import {assertCueTimelineMatches} from "./cue-timeline.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
import {resolvePromoCue} from "./promo-visual.mjs";
import {authoredSoundEvents,validateCodexSoundKitDecision,SOUNDKIT_SILENCE}
  from "./codex-soundkit-selection.mjs";

const SHA=/^[a-f0-9]{64}$/;
export const SOUNDKIT_CUE_PLAN_SCHEMA_VERSION=1;
const hashing=bytes=>createHash("sha256").update(bytes).digest("hex");
const frames=(ms,fps)=>Math.ceil(ms*fps/1000);
const frameFloor=(ms,fps)=>Math.floor(ms*fps/1000);

function assertRealImportedTimeline(episode,timeline,audioBytes) {
  if(!episode||!timeline||!Buffer.isBuffer(audioBytes)||!audioBytes.length)
    throw Error("SoundKit P3 requires imported nonempty source audio bytes; synthetic planning is not proof");
  if(episode.captionSource!=="gemini-word-timestamps" ||
     !SHA.test(episode.audioSha256??"")||
     !SHA.test(episode.voiceTextHash??""))
    throw Error("SoundKit P3 requires real Gemini word timestamps and voice/audio SHA-256");
  if(!Number.isInteger(timeline.fps)||timeline.fps!==30)
    throw Error("SoundKit P3 supports the canonical 30 fps timeline only");
  assertCueTimelineMatches(episode,timeline,timeline.fps);
  if(hashing(audioBytes)!==episode.audioSha256 ||
     timeline.audioSha256!==episode.audioSha256)
    throw Error("SoundKit P3 imported voice WAV/MP3 bytes do not match exact source audio SHA-256");
  if(!Number.isFinite(episode.audioDurationMs)||episode.audioDurationMs<=0)
    throw Error("SoundKit P3 needs verified imported audio duration");
  if(!Array.isArray(episode.captions)||!episode.captions.length)
    throw Error("SoundKit P3 requires nonempty real word cues");
  let lastStart=-1;
  for(const word of episode.captions) {
    if(!Number.isFinite(word.startMs)||!Number.isFinite(word.endMs)||
       word.startMs<0||word.startMs<lastStart||
       word.endMs<=word.startMs||word.endMs>episode.audioDurationMs+100 ||
       typeof word.text!=="string"||!word.text.trim())
      throw Error("SoundKit P3 imported word cues outside voice or not monotonically ordered");
    lastStart=word.startMs;
  }
  let lastEnd=-1;
  for(const scene of episode.scenes) {
    if(!Number.isFinite(scene.startMs)||!Number.isFinite(scene.endMs)||
       scene.startMs<0||scene.startMs<lastEnd||scene.endMs<=scene.startMs ||
       scene.endMs>episode.audioDurationMs+100)
      throw Error("SoundKit P3 has missing/overlapping/out-of-range real scene boundaries");
    lastEnd=scene.endMs;
  }
  if(episode.scenes.some(s=>s.kind==="cta")) {
    const ctaIndex=episode.scenes.findIndex(s=>s.kind==="cta");
    if(episode.scenes.slice(ctaIndex+1).some(s=>s.kind!=="cta"))
      throw Error("SoundKit P3 requires CTA after all teaching/promo scenes");
  }
}

/**
 * Every sound event is attached to one REAL speech cue that actually appears
 * in the imported episode. The P2 intent is never treated as a timestamp.
 */
export function compileSoundKitCuePlan(episode,timeline,{
  brief,decision,audioBytes,assetHashes,platform="shared",
}={}) {
  if(!["shared","tiktok"].includes(platform))
    throw Error("SoundKit P3 platform must be shared or tiktok");
  assertRealImportedTimeline(episode,timeline,audioBytes);
  validateCodexSoundKitDecision(decision,brief);
  if(brief.episodeId!==episode.id||brief.languageCode!==episode.languageCode||
     !["lesson","advertisement","series-part"].includes(brief.contentType)||
     brief.productionEffectsEnabled!==false||
     !assetHashes||typeof assetHashes!=="object")
    throw Error("SoundKit P3 brief/voice/locale/platform identity mismatch");
  const originalScenes=episode.scenes.filter(s=>s.kind!=="cta");
  if(originalScenes.length!==brief.scenes.length)
    throw Error("SoundKit P3 source scenes differ from source-bound Codex brief");
  const fps=timeline.fps,cta=episode.scenes.find(s=>s.kind==="cta");
  const ctaStart=cta?.startMs??episode.audioDurationMs;
  const selected=[];
  const report=[];
  const sceneIds=[];
  for(let i=0;i<originalScenes.length;i++){
    const scene=originalScenes[i],source=brief.scenes[i],choice=decision.scenes[i];
    if(scene.id!==source.sceneId||scene.narration!==source.narration ||
       choice.sceneId!==scene.id)
      throw Error("SoundKit P3 rendered narration/scene differs from exact source");
    const authored=authoredSoundEvents(
      brief.contentType==="advertisement"
        ?{...scene,visual:scene.promoVisual}
        :scene,
      brief.contentType,
    );
    if(JSON.stringify(authored)!==JSON.stringify(source.visualEvents))
      throw Error("SoundKit P3 actual visual events drifted from authored brief");
    const timed=timeline.scenes[i];
    if(!timed||timed.sceneId!==scene.id||
       timed.startMs!==scene.startMs||timed.endMs!==scene.endMs)
      throw Error("SoundKit P3 scene boundaries disagree with actual compiled timeline");
    sceneIds.push(scene.id);
    if(choice.soundId===SOUNDKIT_SILENCE){
      report.push({sceneId:scene.id,status:"SILENCE",reason:choice.reason});
      continue;
    }
    if(i===0||scene.kind==="hook"||scene.id==="cta")
      throw Error("SoundKit P3 first scene/hook/CTA must remain silent");
    const sound=source.candidates.find(c=>c.id===choice.soundId);
    const visual=source.visualEvents.find(v=>v.eventId===choice.eventId);
    if(!sound||!visual||!SHA.test(sound.sha256??"")||
       assetHashes[sound.id]!==sound.sha256)
      throw Error("SoundKit P3 chosen sound has missing/mismatched audited asset bytes");
    let resolved;
    if(brief.contentType==="advertisement"){
      if(!scene.promoVisual||scene.promoVisual.cueText!==visual.cueText)
        throw Error("SoundKit P3 promo cue text differs from actual approved product scene");
      const expected=resolvePromoCue(scene,timeline.wordCues,fps,episode.languageCode);
      const actual=timed.promoCue;
      if(!actual||expected.startMs!==actual.startMs||
         expected.startFrame!==actual.startFrame||
         expected.captionIndex!==actual.captionIndex||
         expected.localFrame!==actual.localFrame||
         expected.endMs!==actual.endMs)
        throw Error("SoundKit P3 fabricated or stale resolved promo cue");
      resolved=expected;
    }else{
      if(!scene.motionBeats?.length)
        throw Error("SoundKit P3 lesson sound needs actual authored motion beats");
      const expected=resolveMotionBeats(scene,timeline.wordCues,fps,episode.languageCode);
      const actual=timed.motionBeats;
      if(!Array.isArray(actual)||actual.length!==expected.length||
         expected.some((beat,j)=>beat.id!==actual[j]?.id||
           beat.startMs!==actual[j]?.startMs||beat.endMs!==actual[j]?.endMs||
           beat.startFrame!==actual[j]?.startFrame||
           beat.captionIndex!==actual[j]?.captionIndex||
           beat.localFrame!==actual[j]?.localFrame))
        throw Error("SoundKit P3 stale/forged lesson beat anchors");
      resolved=expected.find(b=>b.id===choice.eventId);
      if(!resolved||resolved.cueText!==visual.cueText)
        throw Error("SoundKit P3 scene event is not in the imported real word cues");
    }
    if(!Number.isFinite(resolved.startMs)||resolved.startMs<scene.startMs||
       resolved.startMs>=scene.endMs||resolved.endMs>scene.endMs ||
       !Number.isInteger(resolved.captionIndex)||
       timeline.wordCues[resolved.captionIndex]?.startMs!==resolved.startMs)
      throw Error("SoundKit P3 selected anchor is outside verified scene/word limits");
    const startFrame=frames(resolved.startMs,fps);
    if(startFrame!==resolved.startFrame)
      throw Error("SoundKit P3 start frame is not the real word cue frame");
    const allSpokenAnchors=brief.contentType==="advertisement"
      ?[resolved]:timed.motionBeats;
    const nextAnchor=allSpokenAnchors
      .filter(b=>b.startMs>resolved.startMs)
      .map(b=>b.startMs).sort((a,b)=>a-b)[0]??scene.endMs;
    const safeEnd=Math.min(scene.endMs,nextAnchor,ctaStart,episode.audioDurationMs);
    const hardDeadlineFrame=frameFloor(safeEnd,fps);
    const fullFrames=Math.ceil(sound.durationSeconds*fps);
    const maxFrames=hardDeadlineFrame-startFrame;
    if(!Number.isFinite(sound.durationSeconds)||fullFrames<1||maxFrames<2)
      throw Error("SoundKit P3 sound does not fit before next cue, scene, CTA or voice end");
    const clipFrames=Math.min(fullFrames,maxFrames);
    const startMs=resolved.startMs;
    if(clipFrames<fullFrames && clipFrames<3)
      throw Error("SoundKit P3 unsafe truncated effect; select SILENCE");
    selected.push({
      sceneId:scene.id,eventId:choice.eventId,soundId:sound.id,
      role:sound.role,file:sound.file,assetSha256:sound.sha256,
      gainPreset:choice.gainPreset,reason:choice.reason,
      narrationEvidence:choice.narrationEvidence,
      visualEvidence:choice.visualEvidence,
      captionIndex:resolved.captionIndex,startMs,
      endCueMs:resolved.endMs,startFrame,
      localFrame:resolved.localFrame,clipFrames,
      endFrame:startFrame+clipFrames,hardDeadlineFrame,
      truncatedForNextCue:clipFrames<fullFrames,
      timingSource:"verified-imported-gemini-word-cue",
      audioOutputProduced:false,
    });
    report.push({sceneId:scene.id,status:"TIMED_INTENT_ONLY",
      soundId:sound.id,anchorMs:startMs});
  }
  return {
    schemaVersion:SOUNDKIT_CUE_PLAN_SCHEMA_VERSION,mode:"TEST_ONLY",
    phase:"P3_EXACT_CUE_BINDING",renderEnabled:false,audioMixProduced:false,
    episodeId:episode.id,contentType:brief.contentType,
    language:brief.language,languageCode:episode.languageCode,platform,
    fps,voiceTextHash:episode.voiceTextHash,
    audioSha256:episode.audioSha256,audioDurationMs:episode.audioDurationMs,
    sourceSha256:brief.sourceSha256,librarySha256:brief.librarySha256,
    policySha256:brief.policySha256,
    cueTimelineSha256:hashing(Buffer.from(JSON.stringify(timeline))),
    selectedBy:"Codex",sceneIds,
    excludedCta:true,voiceSourceUnmodified:true,
    selected,report,
  };
}
