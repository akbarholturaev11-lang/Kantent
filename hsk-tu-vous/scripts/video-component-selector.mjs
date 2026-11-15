/**
 * Deterministic, advisory-only visual motion selector for Kantent.
 *
 * Selection does NOT authorize rendering/publishing; real video changes must
 * be bound to verified word cues and pass the project review/approval gates.
 */
export const MOTION_COMPONENTS = Object.freeze([
  {id:"art-dissolve",source:"transitions.dev",formats:["lesson"],sceneKinds:["hook","context","example","vocabulary","story"],purpose:"Subtle incoming existing lesson art dissolve; never add extra lesson text/cards"},
  {id:"art-drift",source:"boardui",formats:["lesson"],sceneKinds:["hook","context","example","vocabulary","story"],purpose:"Slow focus movement on the existing meaningful lesson artwork without changing content"},
  {id:"type-reveal",source:"transitions.dev",formats:["lesson","advertisement","series-part"],sceneKinds:["hook","context","example","vocabulary","story","promo"],purpose:"Introduce one actual spoken concept using a short eased text reveal"},
  {id:"card-reveal",source:"boardui",formats:["advertisement","series-part","lesson"],sceneKinds:["hook","context","example","story","promo"],purpose:"Reveal one verified product or lesson card, not an invented screenshot"},
  {id:"glass-info",source:"beautifului.dev",formats:["lesson","advertisement","series-part"],sceneKinds:["vocabulary","example","context","story","promo"],purpose:"A restrained glass context card; for illustrated lessons keep their one stable teaching card"},
  {id:"state-transition",source:"transitions.dev",formats:["advertisement","series-part"],sceneKinds:["context","story","promo","example"],purpose:"Illustrate a verified change of state without fabricating an app workflow"},
  {id:"progress-trace",source:"boardui",formats:["advertisement","series-part"],sceneKinds:["context","story","promo"],purpose:"Show an explicitly supported multi-step progression; never fabricate completion metrics"},
]);
const CONTENT_TYPES=new Set(["lesson","advertisement","series-part"]);
const SCENE_KINDS=new Set(["hook","context","example","vocabulary","story","promo"]);
export const MOTION_SELECTOR_VERSION=1;
const hashString=(str)=>{let h=2166136261;for(const ch of str){h=Math.imul(h^ch.charCodeAt(0),16777619)}return h>>>0};
const assertId=(value,name)=>{if(typeof value!=="string"||!/^[\w-]{1,110}$/.test(value))throw Error(name+" needs an ordinary nonempty identifier");};
const normalizeHistory=(history)=>history.slice(-5).filter(Array.isArray).map(row=>row.join("|"));
export function selectVideoComponents(episode,{contentType,recentSequences=[]}={}) {
  if(!episode||typeof episode!=="object")throw Error("An episode object is required");
  assertId(episode.id,"episode.id");
  if(!CONTENT_TYPES.has(contentType))throw Error("Choose an explicit canonical content type");
  if(!Array.isArray(episode.scenes)||!episode.scenes.length)throw Error("An episode requires actual authored scenes");
  if(!Array.isArray(recentSequences))throw Error("recentSequences must be an array");
  const ids=new Set();
  const editableScenes=episode.scenes.filter(scene=>{
    assertId(scene?.id,"scene.id");
    if(ids.has(scene.id))throw Error("Duplicate scene ID: "+scene.id);
    ids.add(scene.id);
    if(scene.kind==="cta")return false; // Never modify central CTA.
    if(typeof scene.narration!=="string"||!scene.narration.trim())throw Error("Missing authored narration: "+scene.id);
    return SCENE_KINDS.has(scene.kind);
  });
  const recent=normalizeHistory(recentSequences);
  // Compute a small stable, seed-based set of alternatives, then avoid
  // recent exact sequences when the compatible component pool allows it.
  const candidates=[];
  for(let offset=0;offset<16;offset++){
    const seq=editableScenes.map((scene,index)=>{
      let pool=MOTION_COMPONENTS.filter(c=>c.formats.includes(contentType)&&c.sceneKinds.includes(scene.kind));
      // The current illustrated-glass format permits no additional animated
      // teaching cards or HUD layers. It permits only artwork movement.
      if(contentType==="lesson")pool=pool.filter(c=>c.id==="art-dissolve"||c.id==="art-drift");
      if(!pool.length)throw Error("No compatible motion component: "+scene.id+"/"+scene.kind);
      const n=hashString(episode.id+"|"+scene.id+"|"+contentType);
      const c=pool[(n+offset+index)%pool.length];
      return {sceneId:scene.id,sceneKind:scene.kind,componentId:c.id,source:c.source,
        reason:c.purpose,verifiedCueRequired:true};
    });
    candidates.push(seq);
  }
  const distinct=candidates.filter((c,i,a)=>a.findIndex(x=>x.map(y=>y.componentId).join("|")===c.map(y=>y.componentId).join("|"))===i);
  const chosen=distinct.find(seq=>!recent.includes(seq.map(c=>c.componentId).join("|")))??distinct[0]??[];
  return {
    schemaVersion:MOTION_SELECTOR_VERSION,
    episodeId:episode.id,contentType,
    status:"advisory-preview-only",
    productionReady:false,
    cueSource:"not-bound", // No inferred timestamps or arbitrary cue timings
    sequence:chosen.map(c=>c.componentId),
    scenes:chosen,
    skippedCtaScenes:episode.scenes.filter(s=>s.kind==="cta").map(s=>s.id),
    needsBeforeProduction:["verified Gemini word-cue binding","per-scene semantic visual review","Remotion MP4 + 270x480 phone QA","exact owner preview approval"],
  };
}
