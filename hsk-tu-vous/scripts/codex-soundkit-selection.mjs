/**
 * SOUNDKIT P2 — pure, non-generative, TEST ONLY suggestion and validation.
 * No audio renderer consumes these decisions. No AI API: Codex is the author.
 */
export const SOUNDKIT_TEST_MODE="TEST_ONLY";
export const SOUNDKIT_SILENCE="SILENCE";
const SHA=/^[a-f0-9]{64}$/;
const safeId=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requiresRealInteraction(visual){
  const proof=visual?.interactionEvidence;
  return visual?.type==="product-capture" &&
    visual?.provenance==="genuine-product-capture" &&
    typeof visual?.screenImage==="string" &&
    proof?.verified===true &&
    proof?.source==="verified-screen-recording" &&
    typeof proof?.sourceSha256==="string" &&
    SHA.test(proof.sourceSha256) &&
    proof.visibleAction==="tap";
}
function requiresRealSuccess(visual){
  const proof=visual?.stateEvidence;
  return visual?.type==="product-capture" &&
    visual?.provenance==="genuine-product-capture" &&
    proof?.verified===true &&
    proof?.source==="verified-screen-recording" &&
    proof.visibleAction==="success-transition" &&
    typeof proof.sourceSha256==="string" && SHA.test(proof.sourceSha256);
}
export function authoredSoundEvents(scene,contentType) {
  if(!scene || !safeId.test(scene.id??""))throw Error("SoundKit requires a safe authored scene ID");
  const events=[];
  if(contentType==="advertisement") {
    const v=scene.visual;
    if(v&&typeof v.action==="string"&&v.action.trim().length>2 &&
       typeof v.cueText==="string"&&v.cueText.trim().length>1 &&
       ["illustration","product-capture"].includes(v.type)) {
      events.push({
        eventId:scene.id+"-visual",
        visualEvidence:v.action,
        cueText:v.cueText,
        visualType:v.type,
        realProductCapture:v.type==="product-capture"&&
          v.provenance==="genuine-product-capture"&&
          typeof v.screenImage==="string",
        provenTap:requiresRealInteraction(v),
        provenSuccess:requiresRealSuccess(v),
        timingStatus:"AUTHOR_INTENT_ONLY",
      });
    }
  } else {
    for(const beat of scene.motionBeats??[]) {
      const evidence=beat?.visual?.explains??beat?.visual?.title??beat?.explains??beat?.cueText;
      if(!safeId.test(beat?.id??"") || typeof evidence!=="string"||!evidence.trim()
        ||typeof beat.cueText!=="string"||!beat.cueText.trim())continue;
      // Actual authored visual payload, not generic prose about a scene.
      const v=beat.visual;
      if(!v?.graphic && !v?.illustration)continue;
      events.push({
        eventId:beat.id,visualEvidence:evidence,cueText:beat.cueText,
        visualType:"authored-lesson-art",realProductCapture:false,
        provenTap:false,provenSuccess:false,timingStatus:"AUTHOR_INTENT_ONLY",
      });
    }
  }
  if(new Set(events.map(x=>x.eventId)).size!==events.length)
    throw Error("SoundKit duplicate authored visual event");
  return events;
}
export function soundCandidatesForScene(scene,contentType,policy,library,sceneIndex=0) {
  if(!policy||policy.schemaVersion!==1||policy.status!=="P2_TEST_ONLY"||
     policy.productionEffectsEnabled!==false||
     policy.newModelApiConnected!==false||
     policy.silenceChoiceId!==SOUNDKIT_SILENCE)
    throw Error("SoundKit requires canonical disabled TEST policy");
  if(!library||library.schemaVersion!==1||library.exactFileCount!==151||
     library.automaticallyUsedInProduction!==false||library.aiApiConnected!==false ||
     !Array.isArray(library.assets))
    throw Error("SoundKit requires the pinned disabled raw audio catalog");
  if(!policy.allowedContentTypes.includes(contentType))
    throw Error("Unknown video content type");
  const events=authoredSoundEvents(scene,contentType);
  const silent={id:SOUNDKIT_SILENCE,category:"silence",role:"intentional-silence",
    reason:"Voice clarity and no unnecessary effect",file:null,sha256:null,
    testReferenceOnly:true,productionReady:false};
  if(sceneIndex===0 || scene.kind==="hook" || scene.kind==="cta" ||
     scene.id==="cta" || !events.length)
    return {events,candidates:[silent],firstSceneProtected:sceneIndex===0,
      rules:"No sound for first scene/hook/CTA/unsupported visuals"};
  const roles=new Set();
  if(events.some(x=>x.visualType==="authored-lesson-art" ||
                      x.visualType==="illustration"))
    roles.add("gentle-illustration-reveal");
  if(events.some(x=>x.realProductCapture))
    roles.add("verified-product-screen-reveal");
  // P2 cannot authenticate a screen recording asset at the media level.
  // Self-declared "verified" metadata MUST NOT unlock fake click/success sounds.
  // P3+ may add a separate file-provenance gate before explicitly enabling it.
  if(policy.enableVerifiedInteractionSoundsInP2!==false)
    throw Error("SoundKit P2 requires real UI click/success roles to stay disabled");
  const index=new Map(library.assets.map(x=>[x.id,x]));
  const candidates=[silent];
  for(const role of roles) {
    for(const id of policy.auditionOnlyIds[role]??[]) {
      const audio=index.get(id);
      if(!audio ||audio.license!=="CC0-1.0"||!SHA.test(audio.sha256??"") ||
         audio.eligibleForAutomaticUse!==false ||
         !Number.isFinite(audio.durationSeconds) ||audio.durationSeconds<=0)
        throw Error("SoundKit catalog no longer matches test-only vetted candidate "+id);
      if(!audio.file.startsWith("assets/sound-library/"))
        throw Error("SoundKit asset path must stay isolated from public renderer");
      candidates.push({
        id:audio.id,category:audio.category,role,
        sha256:audio.sha256,file:audio.file,license:audio.license,
        durationSeconds:audio.durationSeconds,sourceCommit:audio.sourceCommit,
        gainPreset:policy.gainPresetForTest,
        intent:"SFX editorial possibility only, actual timing and listening review not completed",
        testReferenceOnly:true,productionReady:false,
      });
    }
  }
  if(new Set(candidates.map(x=>x.id)).size!==candidates.length)
    throw Error("SoundKit duplicate shortlist IDs");
  return {events,candidates,firstSceneProtected:false,rules:"Only source-evidenced visuals, quiet optional effect; no real timing yet"};
}
export function validateCodexSoundKitDecision(decision,brief) {
  if(!brief || brief.schemaVersion!==1 || brief.mode!==SOUNDKIT_TEST_MODE ||
     brief.productionEffectsEnabled!==false ||
     brief.externalSelectionApi!==null ||
     !SHA.test(brief.sourceSha256??"")||!SHA.test(brief.librarySha256??"")||
     !SHA.test(brief.policySha256??"") ||
     !Array.isArray(brief.scenes)||!["ru","tg"].includes(brief.language))
    throw Error("SoundKit requires a valid TEST-only brief");
  if(!decision||decision.schemaVersion!==1||decision.mode!==SOUNDKIT_TEST_MODE||
     decision.chosenBy!=="Codex"||
     decision.episodeId!==brief.episodeId||
     decision.contentType!==brief.contentType||
     decision.language!==brief.language||
     decision.languageCode!==brief.languageCode||
     decision.sourceSha256!==brief.sourceSha256||
     decision.librarySha256!==brief.librarySha256||
     decision.policySha256!==brief.policySha256||
     decision.productionEffectsEnabled!==false||
     !Array.isArray(decision.scenes)||decision.scenes.length!==brief.scenes.length)
    throw Error("SoundKit decision stale, wrong language, or not Codex-authored TEST ONLY");
  const seen=new Set();
  for(let i=0;i<brief.scenes.length;i++){
    const scene=brief.scenes[i],choice=decision.scenes[i];
    if(!choice||choice.sceneId!==scene.sceneId||seen.has(choice.sceneId))
      throw Error("SoundKit scene order or identity differs from actual source");
    seen.add(choice.sceneId);
    const candidate=scene.candidates.find(x=>x.id===choice.soundId);
    if(!candidate)throw Error("SoundKit sound not in exact licensed, context-limited shortlist: "+choice.soundId);
    if(typeof choice.reason!=="string"||choice.reason.trim().length<24)
      throw Error("SoundKit Codex rationale required even for deliberate silence");
    if(choice.soundId===SOUNDKIT_SILENCE){
      if(choice.eventId!==null||choice.visualEvidence!==null||
         choice.narrationEvidence!==null||choice.assetSha256!==null||
         choice.gainPreset!=="none")
        throw Error("SoundKit deliberate silence must have no fake audio, visual or timing evidence");
      continue;
    }
    if(scene.firstSceneProtected || scene.sceneKind==="cta"||
       candidate.testReferenceOnly!==true||candidate.productionReady!==false||
       candidate.license!=="CC0-1.0"||
       choice.assetSha256!==candidate.sha256 ||
       choice.gainPreset!==candidate.gainPreset)
      throw Error("SoundKit unapproved source, license, gain or protected scene");
    const event=scene.visualEvents.find(x=>x.eventId===choice.eventId);
    if(!event ||choice.visualEvidence!==event.visualEvidence)
      throw Error("SoundKit cited visual event must exactly match authored source evidence");
    if(candidate.role==="real-ui-press"&&!event.provenTap||
       candidate.role==="verified-success-state"&&!event.provenSuccess||
       candidate.role==="verified-product-screen-reveal"&&!event.realProductCapture||
       candidate.role==="gentle-illustration-reveal"&&
          !["illustration","authored-lesson-art"].includes(event.visualType))
      throw Error("SoundKit sound role is not supported by proven visible action");
    if(typeof choice.narrationEvidence!=="string" ||
       choice.narrationEvidence.trim().length<2 ||
       !scene.narration.includes(choice.narrationEvidence))
      throw Error("SoundKit narration evidence absent from actual localized script");
  }
  return true;
}
