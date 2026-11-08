/** Read-only review evidence: extract actual before/on/settled frames from an
 * EXISTING owner-review MP4. This never generates TTS, rewrites a video, or posts.
 *
 * Usage (from hsk-tu-vous):
 *   node scripts/cue-frame-review.mjs <episode-id> [ru|tg]
 * It requires the committed cue contract to match the current review snapshot,
 * verifies the actual video hash against the recorded platform package, and
 * creates NEW, immutable-by-default review/<id>[/tg]/cue-frame-review-* files.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {assertCueTimelineMatches} from "./cue-timeline.mjs";
import {episodeContentHash, reviewDir, safeId} from "./lib.mjs";

const scriptPath=fileURLToPath(import.meta.url);
const FPS=30;

function finiteNonnegative(value) {
  return typeof value==="number" && Number.isFinite(value) && value>=0;
}
function boundedInteger(value,minimum,maximum) {
  return Number.isSafeInteger(value) && value>=minimum && value<=maximum;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
}
function ensureId(id) {
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id??""))throw Error("Unsafe scene/beat id.");
  return id;
}

/** A deterministic list of exact FRAME INDICES; never infer missing word timings. */
export function planCueFrameReview(episode,timeline,{maxBeats=72}={}) {
  if(!Number.isSafeInteger(maxBeats)||maxBeats<1||maxBeats>500)
    throw Error("Review maximum must be an integer between 1 and 500.");
  assertCueTimelineMatches(episode,timeline,FPS);
  const samples=[];
  let offset=0;
  for(const [sceneIndex,scene] of episode.scenes.entries()){
    if(!boundedInteger(scene.durationFrames,1,100000))
      throw Error(`Scene ${scene.id} lacks real, positive durationFrames.`);
    const start=offset,end=offset+scene.durationFrames;
    const resolved=timeline.scenes[sceneIndex];
    const beats=resolved.motionBeats?.length
      ? resolved.motionBeats
      : resolved.promoCue?[resolved.promoCue]:[];
    for(const [beatIndex,beat] of beats.entries()){
      ensureId(scene.id); ensureId(beat.id);
      if(!finiteNonnegative(beat.startMs)||!boundedInteger(beat.localFrame,0,scene.durationFrames-1))
        throw Error(`${scene.id}/${beat.id}: real cue localFrame/startMs missing or outside scene.`);
      // Same frame numbering as Remotion's local Sequence; not a guessed duration slice.
      const cueFrame=start+beat.localFrame;
      const next=beats[beatIndex+1];
      const deadline=next?(start+next.localFrame):end;
      if(!boundedInteger(deadline,cueFrame+1,end))
        throw Error(`${scene.id}/${beat.id}: next word cue is not after the current cue.`);
      const tracks=beat.visual?.graphic?.tracks??[];
      const ends=tracks.filter(t=>!t.loop&&Array.isArray(t.keyframes))
        .map(t=>t.keyframes.at(-1)?.atMs)
        .filter(finiteNonnegative);
      const settleMs=ends.length?Math.max(...ends):300;
      const settleFrames=Math.max(1,Math.ceil(settleMs*FPS/1000));
      const settledFrame=Math.min(deadline-1,cueFrame+settleFrames);
      samples.push({
        sceneId:scene.id,beatId:beat.id,cueText:beat.cueText,sceneIndex,
        spokenStartMs:beat.startMs,spokenEndMs:beat.endMs,
        beforeFrame:cueFrame>start?cueFrame-1:null,
        cueFrame,settledFrame,nextCueFrameExclusive:deadline,
        firstBeatWithoutPreCueFrame:cueFrame===start,
      });
      if(samples.length>maxBeats)
        throw Error(`Review requires ${samples.length}+ beats; raise maxBeats intentionally.`);
    }
    offset=end;
  }
  if(samples.length===0)
    throw Error("No compiled action/promo cue frames exist. Do not label semantic QA as passed.");
  return {schemaVersion:1,episodeId:episode.id,languageCode:episode.languageCode,
    fps:FPS,totalFrames:offset,voiceTextHash:episode.voiceTextHash,
    audioSha256:episode.audioSha256??null,
    samples,realVoiceAndTeachingMeaningReviewed:false,ownerPreviewApproved:false};
}

function run(command,args) {
  const processResult=spawnSync(command,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  if(processResult.error)throw processResult.error;
  if(processResult.status!==0)throw Error(`${command} failed: ${(processResult.stderr||processResult.stdout||"").slice(-1400)}`);
  return processResult.stdout;
}
function extractFrame(video,frame,destination,width,height) {
  // select=eq(n,FRAME) decodes the exact encoded video frame, not an
  // approximate -ss seek that can silently pick the wrong word cue.
  run("ffmpeg",["-hide_banner","-loglevel","error","-nostdin","-i",video,
    "-vf",`select=eq(n\\,${frame}),scale=${width}:${height}:flags=lanczos`,
    "-fps_mode","vfr","-frames:v","1","-update","1",destination]);
}
async function readJson(file) {
  return JSON.parse(await fs.readFile(file,"utf8"));
}
function contactSheet(plan) {
  const cards=plan.samples.map((s,index)=>{
    const frames=[["before",s.beforeFrame],["cue",s.cueFrame],["settled",s.settledFrame]];
    return `<section><h2>${index+1}. ${escapeHtml(s.sceneId)} / ${escapeHtml(s.beatId)}</h2>
      <p>${escapeHtml(s.cueText)} — spoken at ${s.spokenStartMs}ms</p>
      <div class="frames">${frames.map(([label,n])=>n===null
        ?`<figure><div class="none">No earlier frame in this scene</div><figcaption>${label}</figcaption></figure>`
        :`<figure><img src="${s.sceneId}-${s.beatId}-${label}-phone.png" alt="${label} frame ${n}"><figcaption>${label}: frame ${n} · <a href="${s.sceneId}-${s.beatId}-${label}-full.png">full resolution</a></figcaption></figure>`).join("")}</div></section>`;
  }).join("\n");
  return `<!doctype html><html lang="en"><meta charset="utf-8">
  <title>UNAPPROVED cue-frame review — ${escapeHtml(plan.episodeId)}</title>
  <style>body{font:16px system-ui;background:#171717;color:#f7f7f7;max-width:1180px;margin:2rem auto;padding:0 1rem}
  section{border-top:1px solid #555;padding:1.2rem 0}.frames{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  figure{margin:0}img{max-width:100%;display:block;margin:auto}figcaption{padding:8px;text-align:center}
  .none{height:410px;border:1px dashed #777;display:grid;place-items:center;text-align:center}
  a{color:#93c5fd}p{color:#ccc}</style><body><h1>Frame evidence ONLY — NOT QA approval</h1>
  <p>${escapeHtml(plan.episodeId)} · ${escapeHtml(plan.languageCode)} · ${plan.samples.length} cues · actual MP4 decoded frames</p>
  <p>Human reviewer must verify meaning, object state, phone legibility, spoken Mandarin, subtitle placement and actual audio. This is NOT owner approval or publication authorization.</p>
  ${cards}</body></html>`;
}

export async function reviewExistingVideo({episodeFile,timelineFile,videoFile,statusFile,outputDir}){
  const [episode,timeline,status]=await Promise.all([
    readJson(episodeFile),readJson(timelineFile),readJson(statusFile)]);
  const plan=planCueFrameReview(episode,timeline);
  if(!["rendered-pending-owner-approval","approved","published"].includes(status.stage))
    throw Error("No completed review package; do not present frames as production video.");
  if(status.contentHash!==episodeContentHash(episode))
    throw Error("Review episode has changed after the recorded render; stale video/episode pairing.");
  const digest=createHash("sha256").update(await fs.readFile(videoFile)).digest("hex");
  if(!/^[a-f0-9]{64}$/.test(status.platformPackages?.instagram?.videoSha256??"")||
      status.platformPackages.instagram.videoSha256!==digest)
    throw Error("Real MP4 SHA-256 does not match the review platform package.");
  const meta=JSON.parse(run("ffprobe",["-v","error","-select_streams","v:0",
    "-show_entries","stream=width,height,nb_frames,r_frame_rate",
    "-of","json",videoFile]));
  const stream=meta.streams?.[0];
  if(stream?.width!==1080||stream?.height!==1920||stream?.r_frame_rate!=="30/1"||
      Number(stream.nb_frames)!==plan.totalFrames)
    throw Error("The actual encoded MP4 dimensions, FPS or frame count differ from the cue plan.");
  // Existing work is never overwritten: each run needs a fresh path.
  await fs.mkdir(outputDir,{recursive:false});
  for(const sample of plan.samples){
    for(const [kind,index] of [["before",sample.beforeFrame],["cue",sample.cueFrame],["settled",sample.settledFrame]]){
      if(index===null)continue;
      const prefix=`${sample.sceneId}-${sample.beatId}-${kind}`;
      const full=path.join(outputDir,`${prefix}-full.png`);
      const phone=path.join(outputDir,`${prefix}-phone.png`);
      extractFrame(videoFile,index,full,1080,1920);
      extractFrame(videoFile,index,phone,270,480);
      // Some ffmpeg builds can return success but emit no frame when -select
      // has no match. Never accept an incomplete contact sheet as evidence.
      for(const file of [full,phone]){
        if((await fs.stat(file)).size===0)throw Error("Empty decoded proof frame: "+file);
      }
    }
  }
  const evidence={...plan,videoSha256:digest,sourceEpisodeHash:status.contentHash,
    generatedAt:new Date().toISOString(),videoFile:path.basename(videoFile),
    verdict:"FRAME_SAMPLES_GENERATED_NOT_VISUALLY_APPROVED"};
  await fs.writeFile(path.join(outputDir,"manifest.json"),JSON.stringify(evidence,null,2)+"\n");
  await fs.writeFile(path.join(outputDir,"index.html"),contactSheet(plan));
  return evidence;
}

if(process.argv[1] && path.resolve(process.argv[1])===scriptPath){
  const id=safeId(process.argv[2]);
  const lang=process.argv[3]??"ru";
  if(!["ru","tg"].includes(lang))throw Error("Usage: node scripts/cue-frame-review.mjs <episode-id> [ru|tg]");
  process.env.HSK_CONTENT_LANGUAGE=lang;
  const folder=reviewDir(id);
  const out=path.join(folder,`cue-frame-review-${Date.now()}`);
  const data=await reviewExistingVideo({
    episodeFile:path.join(folder,"episode.json"),
    timelineFile:path.join(folder,"cue-timeline.json"),
    videoFile:path.join(folder,"video.mp4"),
    statusFile:path.join(folder,"status.json"),
    outputDir:out,
  });
  console.log(JSON.stringify({output:out,reviewIndex:path.join(out,"index.html"),
    cues:data.samples.length,verdict:data.verdict},null,2));
}
