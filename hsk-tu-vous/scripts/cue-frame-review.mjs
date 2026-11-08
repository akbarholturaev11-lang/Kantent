/** Read-only review evidence: extract actual before/on/settled frames from an
 * EXISTING owner-review MP4. This never generates TTS, rewrites a video, or posts.
 *
 * Usage (from hsk-tu-vous):
 *   node scripts/cue-frame-review.mjs <episode-id> [ru|tg] [instagram|youtube|facebook]
 * It requires the committed cue contract to match the current review snapshot,
 * verifies the actual video hash against the recorded platform package, and
 * creates NEW, immutable-by-default review/<id>[/tg]/cue-frame-review-* files.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {assertCueTimelineMatches} from "./cue-timeline.mjs";
import {assertSharedLesson, sharedRenderRanges, platformPackagePaths} from "./platform-exports.mjs";
import {verifyPlatformVideo} from "./render-platform-videos.mjs";
import {compileSemanticVisualTimeline} from "./semantic-visual-plan.mjs";
import {extractCueFrameBatch} from "./cue-frame-batch.mjs";
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
  if(timeline.semanticTimeline){
    const current=compileSemanticVisualTimeline(episode);
    if(JSON.stringify(current)!==JSON.stringify(timeline.semanticTimeline))
      throw Error("Stale or modified semantic timeline: actions must bind to exact current speech and shot source.");
  }
  const samples=[];
  const staticShots=[];
  let offset=0;
  for(const [sceneIndex,scene] of episode.scenes.entries()){
    if(!boundedInteger(scene.durationFrames,1,100000))
      throw Error(`Scene ${scene.id} lacks real, positive durationFrames.`);
    const start=offset,end=offset+scene.durationFrames;
    const resolved=timeline.scenes[sceneIndex];
    const semantic=timeline.semanticTimeline?.scenes?.find(s=>s.sceneId===scene.id);
    if((resolved.motionBeats?.length||resolved.promoCue)&&semantic?.actions?.length)
      throw Error(`${scene.id}: mixed semantic and action timelines require separate, explicit review.`);
    const beats=resolved.motionBeats?.length
      ? resolved.motionBeats
      : resolved.promoCue?[resolved.promoCue]
      : (semantic?.actions??[]).map(action=>({
          id:`semantic-action-${action.beatIndex}`,
          kind:"semantic-action",cueText:action.cueText,
          startMs:action.startMs,endMs:action.endMs,
          startFrame:action.startFrame,
          localFrame:action.startFrame-Math.round(scene.startMs*FPS/1000),
          semanticSettleMs:action.endMs-action.startMs,
        }));
    if(semantic?.shot&&!beats.length) {
      // A static semantic shot has no spoken-action cue: review its actual
      // frames, but never mislabel these as narration-synced proof.
      staticShots.push({
        sceneId:scene.id,firstFrame:start,
        middleFrame:start+Math.floor((scene.durationFrames-1)/2),
        lastFrame:end-1,hasVerifiedSpokenAction:false,
      });
    }
    // Validate every cue on its own BEFORE checking neighboring intervals:
    // an invalid later cue must not masquerade as the preceding beat's error.
    ensureId(scene.id);
    if(!finiteNonnegative(scene.startMs))
      throw Error(`${scene.id}: real scene.startMs required for frame-accurate review.`);
    // Remotion sequences use accumulated durationFrames. Detect source drift:
    // scene.startMs and the visual sequence offset must identify the SAME frame.
    if(Math.round(scene.startMs*FPS/1000)!==start)
      throw Error(`${scene.id}: accumulated scene frames do not match audio-derived scene.startMs.`);
    for(const beat of beats) {
      ensureId(beat.id);
      if(!finiteNonnegative(beat.startMs)||
          !finiteNonnegative(beat.endMs)||beat.endMs<=beat.startMs||
          !boundedInteger(beat.startFrame,0,Number.MAX_SAFE_INTEGER)||
          !boundedInteger(beat.localFrame,0,scene.durationFrames-1))
        throw Error(`${scene.id}/${beat.id}: real cue localFrame/startMs/endMs missing or outside scene.`);
      const exactFrame=Math.ceil(beat.startMs*FPS/1000);
      const exactLocal=exactFrame-Math.round(scene.startMs*FPS/1000);
      if(beat.startFrame!==exactFrame||beat.localFrame!==exactLocal)
        throw Error(`${scene.id}/${beat.id}: compiled word cue frame differs from real audio timing.`);
    }
    for(const [beatIndex,beat] of beats.entries()){
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
      const settleMs=finiteNonnegative(beat.semanticSettleMs)?beat.semanticSettleMs
        :ends.length?Math.max(...ends):300;
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
  if(samples.length===0&&staticShots.length===0)
    throw Error("No compiled action/promo/semantic cue frames exist. Do not label semantic QA as passed.");
  // Production extends the final CTA when the actual audio is longer than the
  // sum of scene durations. Checking only the scene sum rejects a valid MP4.
  const ranges=sharedRenderRanges(episode);
  if(ranges.ctaStart!==offset-episode.scenes.at(-1).durationFrames)
    throw Error("CTA boundary mismatch against production render ranges.");
  return {schemaVersion:1,episodeId:episode.id,languageCode:episode.languageCode,
    fps:FPS,totalFrames:ranges.totalFrames,sceneFrames:offset,
    ctaBoundaryFrames:{
      beforeCta:ranges.ctaStart-1,firstCta:ranges.ctaStart,finalCta:ranges.totalFrames-1,
    },voiceTextHash:episode.voiceTextHash,
    audioSha256:episode.audioSha256??null,
    samples,staticShots,realVoiceAndTeachingMeaningReviewed:false,ownerPreviewApproved:false};
}

/** A single sorted frame index serves multiple labeled output files. */
export function frameReviewRequests(plan) {
  const requests=[];
  for(const sample of plan.samples) {
    for(const [name,frame] of [["before",sample.beforeFrame],["cue",sample.cueFrame],
      ["settled",sample.settledFrame]]) {
      if(frame!==null)
        requests.push({frame,stem:`${sample.sceneId}-${sample.beatId}-${name}`});
    }
  }
  for(const shot of plan.staticShots??[]) {
    for(const [name,key] of [["first","firstFrame"],["middle","middleFrame"],["last","lastFrame"]])
      requests.push({frame:shot[key],stem:`${shot.sceneId}-shot-${name}`});
  }
  for(const [key,name] of [["beforeCta","before"],["firstCta","start"],["finalCta","end"]])
    requests.push({frame:plan.ctaBoundaryFrames[key],stem:"cta-"+name});
  return requests;
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
  const shotCards=(plan.staticShots??[]).map((shot)=>`<section><h2>${escapeHtml(shot.sceneId)} — STATIC SHOT: NO SPOKEN ACTION ANCHOR</h2>
    <p>Source shot frames only; they do not establish narrated-motion alignment.</p>
    <div class="frames">${[["first","firstFrame"],["middle","middleFrame"],["last","lastFrame"]]
      .map(([label,key])=>`<figure><img src="${shot.sceneId}-shot-${label}-phone.png" alt="${label} ${shot[key]}">
      <figcaption>${label}: frame ${shot[key]} · <a href="${shot.sceneId}-shot-${label}-full.png">full resolution</a></figcaption></figure>`).join("")}</div></section>`).join("");
  const cta=[["beforeCta","before"],["firstCta","start"],["finalCta","end"]]
    .map(([key,name])=>`<figure><img src="cta-${name}-phone.png" alt="${key} frame ${plan.ctaBoundaryFrames[key]}">
      <figcaption>${key}: frame ${plan.ctaBoundaryFrames[key]} · <a href="cta-${name}-full.png">full resolution</a></figcaption></figure>`)
    .join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8">
  <title>UNAPPROVED cue-frame review — ${escapeHtml(plan.episodeId)}</title>
  <style>body{font:16px system-ui;background:#171717;color:#f7f7f7;max-width:1180px;margin:2rem auto;padding:0 1rem}
  section{border-top:1px solid #555;padding:1.2rem 0}.frames{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  figure{margin:0}img{max-width:100%;display:block;margin:auto}figcaption{padding:8px;text-align:center}
  .none{height:410px;border:1px dashed #777;display:grid;place-items:center;text-align:center}
  a{color:#93c5fd}p{color:#ccc}</style><body><h1>Frame evidence ONLY — NOT QA approval</h1>
  <p>${escapeHtml(plan.episodeId)} · ${escapeHtml(plan.languageCode)} · ${plan.samples.length} cues · actual MP4 decoded frames</p>
  <p>Human reviewer must verify meaning, object state, phone legibility, spoken Mandarin, subtitle placement and actual audio. This is NOT owner approval or publication authorization.</p>
  ${cards}${shotCards}<section><h2>Platform-specific CTA transition and last encoded frame</h2><div class="frames">${cta}</div></section></body></html>`;
}

export async function reviewExistingVideo({
  episodeFile,baseEpisodeFile=episodeFile,timelineFile,videoFile,statusFile,outputDir,
  platform="instagram",
}){
  if(!["instagram","youtube","facebook"].includes(platform))
    throw Error("Only shared-voice Instagram/YouTube/Facebook proof is supported; TikTok requires its own voice timeline.");
  const [episode,timeline,status]=await Promise.all([
    readJson(episodeFile),readJson(timelineFile),readJson(statusFile)]);
  const base=baseEpisodeFile===episodeFile?episode:await readJson(baseEpisodeFile);
  assertSharedLesson(base,episode);
  const plan=planCueFrameReview(episode,timeline);
  if(!["rendered-pending-owner-approval","owner-approved-for-zernio-publishing",
        "approved","published"].includes(status.stage))
    throw Error("No completed review package; do not present frames as production video.");
  const baseHash=episodeContentHash(base);
  const variantHash=episodeContentHash(episode);
  const packageRecord=status.platformPackages?.[platform];
  if(status.contentHash!==baseHash||
      !packageRecord||packageRecord.baseContentHash!==baseHash||
      packageRecord.contentHash!==variantHash)
    throw Error(`${platform} review episode/CTA does not match its recorded render package.`);
  const digest=createHash("sha256").update(await fs.readFile(videoFile)).digest("hex");
  if(!/^[a-f0-9]{64}$/.test(packageRecord.videoSha256??"")||
      packageRecord.videoSha256!==digest)
    throw Error(`${platform} real MP4 SHA-256 does not match the recorded platform package.`);
  // Reuse the production verifier: require encoded H264 picture AND AAC audio,
  // exact frames, BT.709 and matching durations. A silent forged MP4 is NOT
  // evidence of narration-synchronized teaching visuals.
  await verifyPlatformVideo(videoFile,plan.totalFrames);
  // Existing work is never overwritten. The batch decoder consumes all
  // exact encoded cue, semantic and per-platform CTA frame indices in just
  // TWO sequential FFmpeg passes, irrespective of episode cue count.
  await fs.mkdir(outputDir,{recursive:false});
  const extraction=await extractCueFrameBatch(videoFile,outputDir,frameReviewRequests(plan));
  const evidence={...plan,platform,extraction,videoSha256:digest,
    sourceEpisodeHash:baseHash,platformEpisodeHash:variantHash,
    generatedAt:new Date().toISOString(),videoFile:path.basename(videoFile),
    verdict:"FRAME_SAMPLES_GENERATED_NOT_VISUALLY_APPROVED"};
  await fs.writeFile(path.join(outputDir,"manifest.json"),JSON.stringify(evidence,null,2)+"\n");
  await fs.writeFile(path.join(outputDir,"index.html"),contactSheet(plan));
  return evidence;
}

if(process.argv[1] && path.resolve(process.argv[1])===scriptPath){
  const id=safeId(process.argv[2]);
  const lang=process.argv[3]??"ru";
  const platform=process.argv[4]??"instagram";
  if(!["ru","tg"].includes(lang)||
      !["instagram","youtube","facebook"].includes(platform))
    throw Error("Usage: node scripts/cue-frame-review.mjs <episode-id> [ru|tg] [instagram|youtube|facebook]");
  process.env.HSK_CONTENT_LANGUAGE=lang;
  const folder=reviewDir(id);
  const videoPackage=platformPackagePaths(id,platform);
  const out=path.join(videoPackage.folder,`cue-frame-review-${Date.now()}`);
  const data=await reviewExistingVideo({
    baseEpisodeFile:path.join(folder,"episode.json"),
    episodeFile:videoPackage.episode,
    timelineFile:path.join(folder,"cue-timeline.json"),
    videoFile:videoPackage.video,
    statusFile:path.join(folder,"status.json"),
    outputDir:out,platform,
  });
  console.log(JSON.stringify({output:out,reviewIndex:path.join(out,"index.html"),
    cues:data.samples.length,verdict:data.verdict},null,2));
}
