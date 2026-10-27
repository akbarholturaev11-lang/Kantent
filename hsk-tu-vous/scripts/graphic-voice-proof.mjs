import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {validateActionLesson,validateVisualHold} from "./action-design-plan.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
import {PROJECT_ROOT,reviewDir,readJson,narrationHash,requireApprovedVoiceProfile,writeJson,FPS} from "./lib.mjs";

/** Diagnostic copy only: retain actual speech/cues and a complete last word. */
export function prepareGraphicVoiceProof(episode,sceneId,motionBeats,policy) {
  if (episode.captionSource!=="gemini-word-timestamps" || !episode.captions?.length ||
      !episode.audioSrc || episode.voiceTextHash!==narrationHash(episode))
    throw Error("A matching imported Gemini voice and exact word timestamps are required.");
  const source=episode.scenes.find(scene=>scene.id===sceneId);
  if(!source || source.kind==="cta") throw Error("Select an existing teaching scene, not a CTA.");
  const scene={...source,motionBeats};
  validateActionLesson({scenes:[scene]},{requireVisibleChange:true});
  const resolved=resolveMotionBeats(scene,episode.captions,FPS,episode.languageCode);
  const visualHold=validateVisualHold(scene,resolved,policy.maximumVisualHoldSec);
  const words=episode.captions.filter(word=>word.startMs>=scene.startMs && word.startMs<scene.endMs);
  const lastEndMs=Math.max(...words.map(word=>word.endMs));
  const next=episode.captions.find(word=>word.startMs>=scene.endMs);
  const sourceFromFrame=Math.floor(scene.startMs*FPS/1000);
  const beats=resolved.map(beat=>({...beat,localFrame:beat.startFrame-sourceFromFrame}));
  const tailMs=Math.min(Math.max(scene.endMs,lastEndMs)+200,
    next?.startMs??Infinity,episode.audioDurationMs??Infinity);
  const sourceToFrame=Math.floor(tailMs*FPS/1000);
  if(sourceToFrame/FPS*1000<lastEndMs || sourceToFrame<=sourceFromFrame)
    throw Error("The last spoken word overlaps the next scene or exceeds the saved audio; cannot make a safe proof clip.");
  const offsetMs=sourceFromFrame/FPS*1000;
  return {audioSrc:episode.audioSrc,sourceFromFrame,sourceToFrame,
    durationFrames:sourceToFrame-sourceFromFrame,beats,visualHold,
    captions:words.map(word=>({...word,startMs:word.startMs-offsetMs,endMs:word.endMs-offsetMs,
      ...(Number.isFinite(word.timestampMs)?{timestampMs:word.timestampMs-offsetMs}:{})}))};
}

async function cli() {
  const [id,sceneId,planFile,...extra]=process.argv.slice(2);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id??"") || !sceneId || !planFile || extra.length)
    throw Error("Usage: node scripts/graphic-voice-proof.mjs <episode-id> <scene-id> <drawing-plan.json>");
  const episode=await readJson(path.join(reviewDir(id),"episode.json"));
  const profile=await requireApprovedVoiceProfile(id);
  if(episode.voiceProfileId!==profile.profileId || episode.languageCode!==profile.locale)
    throw Error("Proof voice does not match the selected language's approved profile.");
  const plan=await readJson(path.resolve(planFile));
  if(plan.episodeId && plan.episodeId!==id || plan.sceneId && plan.sceneId!==sceneId)
    throw Error("Drawing proof plan refers to another episode/scene.");
  const visual=await readJson(path.join(PROJECT_ROOT,"content/visual-system.json"));
  const props=prepareGraphicVoiceProof(episode,sceneId,plan.motionBeats,visual.lessonPresentation);
  const audioPath=path.resolve(PROJECT_ROOT,"public",props.audioSrc);
  if(!audioPath.startsWith(path.join(PROJECT_ROOT,"public")+path.sep)) throw Error("Unsafe audio asset path.");
  const audioSha256=createHash("sha256").update(await fs.readFile(audioPath)).digest("hex");
  const folder=path.join(reviewDir(id),"graphic-proofs",new Date().toISOString().replace(/[:.]/g,"-"));
  await fs.mkdir(folder,{recursive:true});
  await writeJson(path.join(folder,"props.json"),props);
  const relative=(file)=>JSON.stringify(path.relative(folder,path.join(PROJECT_ROOT,file)).split(path.sep).join("/"));
  const entry=`import {registerRoot,Composition,AbsoluteFill,Audio,staticFile,useCurrentFrame} from 'remotion';
import {NarratedActionScene} from ${relative("src/NarratedActionScene")};
import {CaptionOverlay} from ${relative("src/CaptionOverlay")};
import type {ResolvedMotionBeat} from ${relative("scripts/motion-design-plan.mjs")};
import data from './props.json';
const beats=data.beats as unknown as ResolvedMotionBeat[];
const Demo=()=>{const frame=useCurrentFrame();return <AbsoluteFill style={{fontFamily:'Arial'}}>
<Audio src={staticFile(data.audioSrc)} trimBefore={data.sourceFromFrame} trimAfter={data.sourceToFrame}/>
<NarratedActionScene frame={frame} beats={beats}/>
<CaptionOverlay captions={data.captions} sceneSections={[{startMs:0,endMs:data.durationFrames/30*1000,styleId:'highlight'}]}
motionDesign plainMotionDesign actionCaptionScenes={[{from:0,durationFrames:data.durationFrames,beats}]}/>
</AbsoluteFill>};
registerRoot(()=> <Composition id='GraphicVoiceProof' component={Demo} width={1080} height={1920} fps={30} durationInFrames={data.durationFrames}/>);
`;
  const entryFile=path.join(folder,"entry.tsx"), video=path.join(folder,"video.mp4");
  await fs.writeFile(entryFile,entry);
  const result=spawnSync(path.join(PROJECT_ROOT,"node_modules/.bin/remotion"),[
    "render",entryFile,"GraphicVoiceProof",video,"--scale=0.5","--codec=h264",
    "--pixel-format=yuv420p","--color-space=bt709","--concurrency=2","--log=error",
  ],{cwd:PROJECT_ROOT,stdio:"inherit"});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error("Graphic voice proof render failed.");
  const report={type:"technical-voice-proof-not-a-publication-package",episodeId:id,sceneId,
    voiceRegenerated:false,syntheticTiming:false,sourceNarrationHash:episode.voiceTextHash,audioSha256,
    sourceFromFrame:props.sourceFromFrame,sourceToFrame:props.sourceToFrame,durationFrames:props.durationFrames,
    cues:props.beats.map(beat=>({id:beat.id,cueText:beat.cueText,sourceStartMs:beat.startMs,localFrame:beat.localFrame})),
    visualHold:props.visualHold,video,publicationAuthorized:false};
  await writeJson(path.join(folder,"verification.json"),report);
  console.log(JSON.stringify(report,null,2));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  cli().catch(error=>{console.error(error.message);process.exitCode=1;});
