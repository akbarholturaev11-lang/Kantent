import {graphicNodeState} from "./graphic-scene.mjs";
import {getMotionAsset} from "./motion-assets.mjs";
/**
 * Optional Motion Director v1: explicit, source-backed shot plan with exact
 * imported word-cue timing. No authoring guesses, no runtime network/media.
 * A missing plan leaves the legacy renderer entirely unchanged.
 */
const ID=/^[a-z][a-z0-9-]{0,63}$/;
const CAMERA_LIMIT={xPx:48,yPx:48,scaleMin:0.94,scaleMax:1.08};
const ROLES=new Set(["action","object","comparison","phrase"]);
const TRANSITIONS=new Set(["cut","crossfade"]);
const KEYS={
  plan:["schemaVersion","shots"],
  shot:["shotId","beatId","meaningCue","cueOccurrence","assetIds","persistentElementIds","camera","transition","focalRole","zIndex"],
  camera:["xPx","yPx","scale"],
  transition:["kind","frames"],
};
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const keys=(obj,allowed,label)=>{
  if(!isObject(obj)||Object.keys(obj).some(k=>!allowed.includes(k)))
    throw Error(label+": invalid or unknown fields");
};
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const identity=xs=>new Set(xs).size===xs.length;
const fail=(scene,message)=>{throw Error("Motion Director "+scene.id+": "+message)};
const zeros={xPx:0,yPx:0,scale:1};
const ease=x=>{const v=Math.min(1,Math.max(0,x));return v*v*(3-2*v)};

// A graphic root is one real drawable group. Only those roots can currently
// be persistent; arbitrary embedded text/cards are NOT fabricated as assets.
const graphicRoots=graphic=>(graphic?.nodes??[]).filter(n=>n.parentId===undefined);
const signature=(graphic,nodeId)=>{
  const node=graphic.nodes.find(n=>n.id===nodeId);
  if(!node)throw Error("Missing graphic root: "+nodeId);
  const children=(id,isRoot)=>graphic.nodes.filter(n=>n.parentId===id).map(n=>shape(n,false));
  const shape=(n,isRoot)=>({
    type:n.type,attrs:n.attrs,
    // Movement via root frame poses is allowed; children's authored geometry
    // must remain the same for a truthful persistent visual identity.
    ...(!isRoot?{x:n.x??0,y:n.y??0,scale:n.scale??1,rotate:n.rotate??0}:{}),
    children:children(n.id,isRoot),
  });
  return JSON.stringify(shape(node,true));
};
const assetDefinitions=beat=>{
  const model=beat.visual??{};
  const assets=new Map();
  if(beat.kind==="graphic"&&model.graphic) {
    for(const node of graphicRoots(model.graphic))
      assets.set("node:"+node.id,signature(model.graphic,node.id));
  }
  if(model.object)assets.set("object:"+model.object,"object:"+model.object");
  if(beat.kind==="asset" && model.assetId) {
    getMotionAsset(model.assetId);
    assets.set("asset:"+model.assetId,"asset:"+model.assetId);
  }
  // Other beat kinds can still animate the existing scene; their visual
  // geometry is not verified for shared-element persistence in v1.
  if(!assets.size)assets.set("beat:"+beat.id,"beat:"+beat.id);
  return assets;
};

export function compileMotionDirectorScene(scene,resolvedBeats) {
  if(scene.motionDirection===undefined)return null;
  const plan=scene.motionDirection;
  if(scene.kind==="cta")fail(scene,"CTA cannot own lesson direction");
  keys(plan,KEYS.plan,"Motion direction");
  if(plan.schemaVersion!==1||!Array.isArray(plan.shots)||
    plan.shots.length!==resolvedBeats.length||plan.shots.length===0)
    fail(scene,"v1 requires exactly one ordered shot per resolved action beat");
  if(!Array.isArray(scene.motionBeats)||scene.motionBeats.length!==resolvedBeats.length)
    fail(scene,"source/action beat mismatch");
  const shotIds=[],entries=[];
  for(let i=0;i<plan.shots.length;i++){
    const shot=plan.shots[i],beat=resolvedBeats[i],authored=scene.motionBeats[i];
    keys(shot,KEYS.shot,"Motion shot");
    if(!ID.test(shot.shotId??"")||shot.beatId!==beat.id||
      shot.meaningCue!==authored.cueText||
      (shot.cueOccurrence??null)!==(authored.cueOccurrence??null) ||
      beat.cueText!==shot.meaningCue)
      fail(scene,"shot must have an original beat ID and exact verified meaning cue, with matching occurrence");
    shotIds.push(shot.shotId);
    if(!Array.isArray(shot.assetIds)||shot.assetIds.length===0||
      shot.assetIds.some(a=>typeof a!=="string")||!identity(shot.assetIds))
      fail(scene,"shot requires distinct authored asset IDs");
    const known=assetDefinitions(beat);
    if(shot.assetIds.some(asset=>!known.has(asset)))
      fail(scene,shot.shotId+": unknown/unsupported actual drawable asset");
    const persistent=shot.persistentElementIds??[];
    if(!Array.isArray(persistent)||!identity(persistent)||
      persistent.some(a=>!shot.assetIds.includes(a)))
      fail(scene,"persistent IDs must be unique assets of their shot");
    keys(shot.camera,KEYS.camera,"Motion camera");
    const camera=shot.camera;
    if(!finite(camera.xPx)||Math.abs(camera.xPx)>CAMERA_LIMIT.xPx||
      !finite(camera.yPx)||Math.abs(camera.yPx)>CAMERA_LIMIT.yPx||
      !finite(camera.scale)||camera.scale<CAMERA_LIMIT.scaleMin||camera.scale>CAMERA_LIMIT.scaleMax)
      fail(scene,"camera outside bounded safe-stage limits");
    keys(shot.transition,KEYS.transition,"Motion transition");
    const {kind,frames}=shot.transition;
    if(!TRANSITIONS.has(kind)||!Number.isInteger(frames)||
      frames<0||frames>16||(kind==="cut"&&frames!==0)||
      (i===0&&(kind!=="cut"||frames!==0))||
      (i>0&&kind==="crossfade"&&frames<2)||
      (i>0&&frames>beat.localFrame-resolvedBeats[i-1].localFrame))
      fail(scene,"invalid duration/transition or overlapping neighboring cue");
    if(!ROLES.has(shot.focalRole)||!Number.isInteger(shot.zIndex)||
      shot.zIndex<0||shot.zIndex>5)
      fail(scene,"unsupported focal role/z-index");
    if(persistent.length){
      if(i===0)fail(scene,"first shot cannot carry previous persistent elements");
      const prev=entries[i-1];
      const from=assetDefinitions(resolvedBeats[i-1]);
      for(const a of persistent) {
        if(!prev.assetIds.includes(a)||!from.has(a)||
          from.get(a)!==known.get(a) || a.startsWith("beat:"))
          fail(scene,"persistent element must exist in both shots with identical drawable geometry: "+a);
      }
      // V1 can truly carry an authored SVG root group. Count-based stock
      // object glyphs cannot be detached yet: reject misleading persistence.
      for(const a of persistent) {
        if(!a.startsWith("node:")||beat.kind!=="graphic"||resolvedBeats[i-1].kind!=="graphic")
          fail(scene,"persistent v1 supports only same authored SVG root groups");
        const id=a.slice(5);
        const currentGraphic=beat.visual?.graphic,previousGraphic=resolvedBeats[i-1].visual?.graphic;
        if(currentGraphic.width!==previousGraphic.width||currentGraphic.height!==previousGraphic.height)
          fail(scene,"persistent SVG groups require matching canvas dimensions");
        const roots=[graphicRoots(currentGraphic).find(n=>n.id===id),graphicRoots(previousGraphic).find(n=>n.id===id)];
        if(roots.some(root=>!root||root.type!=="g"))
          fail(scene,"persistent element must be a drawable SVG root group");
        const descendant=(graphic,nodeId)=>{
          const ids=new Set([nodeId]);let changed=true;
          while(changed){changed=false;for(const n of graphic.nodes)if(n.parentId&&ids.has(n.parentId)&&!ids.has(n.id)){ids.add(n.id);changed=true}}
          ids.delete(nodeId);return ids;
        };
        for(const graphic of [currentGraphic,previousGraphic]) {
          const ids=descendant(graphic,id);
          if((graphic.tracks??[]).some(t=>ids.has(t.nodeId)))
            fail(scene,"persistent nested animation tracks require a dedicated pose adapter");
        }
      }
      if(kind==="cut")fail(scene,"persistent element cannot jump through cut");
    }
    entries.push({
      shotId:shot.shotId,beatId:beat.id,meaningCue:beat.cueText,
      cueOccurrence:beat.cueOccurrence??null,
      cueStartMs:beat.startMs,cueEndMs:beat.endMs,cueFrame:beat.localFrame,
      assetIds:[...shot.assetIds],persistentElementIds:[...persistent],
      camera:{...camera},transition:{kind,frames},
      focalRole:shot.focalRole,zIndex:shot.zIndex,
    });
  }
  if(!identity(shotIds))fail(scene,"duplicate shot IDs");
  return {schemaVersion:1,sceneId:scene.id,timingSource:"verified-word-cues",shots:entries};
}

/** Seek-safe camera interpolation; no autonomous movement and no audio trim. */
export function resolveDirectorCamera(timeline,frame) {
  if(!timeline)return {...zeros};
  if(!finite(frame))throw Error("Motion Director camera requires finite frame");
  const shots=timeline.shots;
  let index=0;
  for(let i=1;i<shots.length;i++){
    if(frame<shots[i].cueFrame)break;
    index=i;
  }
  const current=shots[index];
  if(index===0)return {...current.camera};
  const previous=shots[index-1];
  const dt=frame-current.cueFrame;
  const n=current.transition.kind==="cut"||current.transition.frames===0
    ?1:ease((dt+1)/current.transition.frames);
  return {
    xPx:previous.camera.xPx+(current.camera.xPx-previous.camera.xPx)*n,
    yPx:previous.camera.yPx+(current.camera.yPx-previous.camera.yPx)*n,
    scale:previous.camera.scale+(current.camera.scale-previous.camera.scale)*n,
  };
}

/** Render one visible SVG root, interpolating only its scene pose. Children
 * must have matching stable authored geometry; schema forbids nested tracks.
 */
export function resolvePersistentRootPose(previousGraphic,currentGraphic,rootId,fromFrame,toFrame,transitionFrames,fps=30){
  if(!ID.test(rootId)||!Number.isFinite(fromFrame)||!Number.isFinite(toFrame)||
    !Number.isInteger(transitionFrames)||transitionFrames<2||transitionFrames>16||
    !finite(fps)||fps<=0)throw Error("Invalid persistent SVG pose request");
  const fromRoot=graphicRoots(previousGraphic).find(n=>n.id===rootId);
  const toRoot=graphicRoots(currentGraphic).find(n=>n.id===rootId);
  if(!fromRoot||!toRoot||fromRoot.type!=="g"||toRoot.type!=="g"||
    signature(previousGraphic,rootId)!==signature(currentGraphic,rootId))
    throw Error("Persistent SVG root has no matching geometry");
  const left=graphicNodeState(previousGraphic,fromRoot,fromFrame*1000/fps);
  const right=graphicNodeState(currentGraphic,toRoot,toFrame*1000/fps);
  const progress=ease((toFrame+1)/transitionFrames);
  return Object.fromEntries(["x","y","scale","rotate","opacity"].map(
    key=>[key,left[key]+(right[key]-left[key])*progress]
  ));
}
