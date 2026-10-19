import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "content/semantic-shot-intents.json"), "utf8"));
const visual = JSON.parse(fs.readFileSync(path.join(root, "content/semantic-visual-system.json"), "utf8"));
const wordPattern = /[\p{L}\p{M}\p{N}]+/gu;
const tokenize = text => String(text ?? "").normalize("NFKC").toLocaleLowerCase("ru-RU").match(wordPattern) ?? [];
const normalized = text => String(text ?? "").normalize("NFKC").toLocaleLowerCase("ru-RU");
const contains = (body, term) => normalized(body).includes(normalized(term));
const allowed = new Set(visual.previewSupportedActions);
const negativeWords = new Set(["не","нет","ни","никогда","нельзя","невозможно","без"]);

function bestContext(episode, scene) {
  const sources = [
    ["narration", scene.narration ?? ""],
    ["headline", scene.headline ?? ""],
    ["screenCaption", scene.screenCaption ?? ""],
    ["editPlan", scene.editPlan ?? ""],
    ["topic", episode.topic ?? ""],
  ];
  for (const [sourceField, body] of sources) {
    for (const context of registry.contexts) {
      const found = context.terms.find(term => contains(body, term));
      if (found) return {environmentId:context.id,sourceField,evidenceTerm:found,confidence:sourceField==="narration"?"narration-evidence":"review-required"};
    }
  }
  return {environmentId:"neutral",sourceField:"none",evidenceTerm:null,confidence:"review-required"};
}

function suggestedActionCandidates(scene, context) {
  const words=tokenize(scene.narration);
  const output=[];
  const warnings=[];
  for (const rule of registry.actions) {
    if(!allowed.has(rule.id)) continue;
    if(rule.needsContext && rule.needsContext !== context.environmentId) continue;
    const matched=[];
    for(let i=0;i<words.length;i++) {
      if(!rule.cueForms.includes(words[i])) continue;
      const preceding=words.slice(Math.max(0,i-2),i);
      if(preceding.some(word=>negativeWords.has(word))){
        warnings.push("Negated motion token excluded: "+words[i]);
        continue;
      }
      matched.push({scriptToken:words[i],tokenIndex:i});
    }
    if(!matched.length) continue;
    for (const match of matched.slice(0,registry.policy.maxSuggestionsPerScene)) {
      const matchingBeats=(scene.visualBeats??[]).map((beat,index)=>({beat,index})).filter(({beat})=>{
        const hanzi=String(beat.hero ?? "");
        return rule.hanzi.some(term=>hanzi.includes(term)) && !registry.actions.some(other=>
          other.id!==rule.id && other.hanzi.some(term=>hanzi.includes(term)));
      });
      const linkedIndex=matchingBeats.length===1 ? matchingBeats[0].index : null;
      const needsAsset=rule.id==="show-blocked" && !contains(scene.narration,"бассейн")
        && !contains(scene.narration,"закрыт");
      output.push({
        proposedAction:rule.id,
        proposedCueText:match.scriptToken,
        sceneNarrationTokenIndex:match.tokenIndex,
        subjectId:rule.actor ? "traveler" : rule.objectId,
        suggestedBeatIndex:linkedIndex,
        cueOccurrenceNeedsReview:matched.length!==1,
        assetSupported:!needsAsset,
        sourceField:"narration",
        status:"proposal-only-unverified-by-transcript",
        reviewRequired:[
          "Verify Chinese teaching meaning and visual action",
          "Confirm exact spoken Gemini word cue and intended occurrence",
          ...(linkedIndex===null?["Select the correct visualBeat or author a new beat"]:[])
        ]
      });
    }
  }
  return {actionCandidates:output, warnings};
}

function selectShot(scene, context, index, previous) {
  let shotType=scene.kind==="hook"?"wide":
    /contrast|сравни|разниц|≠/iu.test([scene.id,scene.headline,scene.screenCaption,scene.narration].join(" "))?"split-contrast":
    scene.kind==="vocabulary"?"closeup":
    context.environmentId==="neutral"?"closeup":
    index%2 ? "medium":"object-focus";
  if(previous && previous.environmentId===context.environmentId && previous.shotType===shotType)
    shotType=shotType==="medium"?"closeup":"medium";
  return shotType;
}

/**
 * Evidence-linked, read-only P3 adviser. Suggestions are NOT executable
 * semantic metadata, TTS cues or reviewed Chinese teaching facts.
 */
export function suggestSemanticShots(episode, {eligibility="planned"}={}) {
  if(!episode || !Array.isArray(episode.scenes) || !episode.id)
    throw Error("Semantic adviser needs an identified episode with scenes");
  const source=JSON.stringify(episode);
  const protectedState=eligibility!=="planned" && eligibility!=="plan-ready";
  const published=["published","scheduled","owner-approved-for-zernio-publishing","zernio-published"];
  if(protectedState || published.includes(episode.publishingStatus)){
    return {episodeId:episode.id,schemaVersion:1,mode:"suggestions-only",eligible:false,
      reason:"Protected or nonplanned episode: never reauthor historical/reviewed content",
      scenes:[],requiresOwnerReview:true};
  }
  const proposals=[];
  let previous=null;
  for(const [index,scene] of episode.scenes.entries()){
    if(scene.kind==="cta") continue;
    const context=bestContext(episode,scene);
    const shotType=selectShot(scene,context,index,previous);
    const {actionCandidates,warnings}=suggestedActionCandidates(scene,context);
    const actorNeeded=actionCandidates.some(c=>c.subjectId==="traveler");
    const objectIds=[...new Set(actionCandidates.filter(c=>c.subjectId!=="traveler").map(c=>c.subjectId))];
    const shot={
      environmentId:context.environmentId,
      shotType,
      cameraStyle:actorNeeded?"follow":"static",
      actorIds:actorNeeded?["traveler"]:[],
      objectIds
    };
    if(!visual.environments.includes(shot.environmentId) ||
       !visual.shotTypes.includes(shot.shotType) ||
       !visual.cameraStyles.includes(shot.cameraStyle))
      throw Error("Semantic intent registry out of sync with rendered shot registry");
    const unsupportedConcepts=[];
    if(context.environmentId==="pool" && /плава(ть|ет|ю|ем|л|ла|ют)/iu.test(scene.narration??""))
      unsupportedConcepts.push("Swimming body motion is not implemented by the P2 illustrator");
    if(actionCandidates.length>registry.policy.maxSuggestionsPerScene)
      warnings.push("Too many motion suggestions; review the scenario manually");
    if(!actionCandidates.length && context.confidence!=="narration-evidence")
      warnings.push("No verified narration-level scene action; choose framing manually");
    proposals.push({
      sceneId:scene.id,
      kind:scene.kind,
      proposedShot:shot,
      contextEvidence:context,
      actionCandidates,
      unsupportedConcepts,
      warnings,
      requiresOwnerReview:true
    });
    previous=shot;
  }
  if(JSON.stringify(episode)!==source)
    throw Error("P3 adviser mutated source episode; refusing output");
  return {
    episodeId:episode.id,date:episode.date??null,schemaVersion:registry.schemaVersion,
    mode:registry.mode,eligible:true,productionEnabled:false,autoApplied:false,
    requiresOwnerReview:true,
    caveats:[
      "Shot/camera metadata are proposals, not approved production edits",
      "Exact cue word occurrence must be verified against imported Gemini captions",
      "Only supported P2 preview movements may be selected; no invented assets",
      "Do not change central CTA, narration, hooks or published snapshots"
    ],
    scenes:proposals
  };
}
