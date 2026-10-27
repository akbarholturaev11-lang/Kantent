/**
 * ONLY runs from owner-confirmed GitHub workflow_dispatch, never from render CI.
 * Presign + PUT + POST + readback. No unapproved social action.
 * Usage: node scripts/zernio-approved-publish.mjs /path/to/approved-review-artifact
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { zernioRoute } from "./video-credentials.mjs";
import {
  validateApprovedIntent,selectApprovedArtifact,publicationBody,
  deterministicPostKey,safeSignedUploadUrl,parseZernioPostReply,artifactAbsolutePath,
} from "./zernio-publication-core.mjs";

const API_ROOT = "https://zernio.com/api/v1";
const self = fileURLToPath(import.meta.url);
const RECEIPT = process.env.PUBLICATION_RECEIPT_DIR || "/tmp/hsk-zernio-receipt";

function requestEnv(env) {
  let details;
  try { details = JSON.parse(env.APPROVED_POST_JSON ?? ""); }
  catch { throw Error("Invalid approved_post_json: it must be valid JSON."); }
  if (!details || typeof details !== "object" || Array.isArray(details))
    throw Error("approved_post_json must be one JSON object.");
  if (Object.keys(details).some(key => !["content","title","visibility","madeForKids",
    "containsSyntheticMedia","shareToFeed","scheduledFor"].includes(key)))
    throw Error("approved_post_json has unsupported fields.");
  return {
    runId: env.APPROVED_RUN_ID, language: env.APPROVED_LANGUAGE,
    platform: env.APPROVED_PLATFORM, mode: env.APPROVED_MODE,
    videoSha256: env.APPROVED_VIDEO_SHA256, postSha256: env.APPROVED_POST_SHA256,
    confirmation: env.APPROVAL_CONFIRMATION, content: details.content,
    title: details.title, visibility: details.visibility,
    madeForKids: details.madeForKids,
    containsSyntheticMedia: details.containsSyntheticMedia,
    shareToFeed: details.shareToFeed,
    scheduledFor: details.scheduledFor ?? "", accountId: env.APPROVED_ACCOUNT_ID,
  };
}

async function jsonRequest(url, {method = "GET",token,body,headers = {}} = {}) {
  const response=await fetch(url,{method,
    headers:{Accept:"application/json", ...(body ? {"Content-Type":"application/json"}:{}),
      ...(token ? {Authorization:"Bearer "+token}:{}),...headers},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(120000)});
  let data;
  try{data=await response.json();}catch{throw Error("API returned non-JSON response (HTTP "+response.status+").");}
  if(!response.ok) throw Error("API request failed (HTTP "+response.status+"). Check provider logs; do not retry posting blindly.");
  return {status:response.status,data};
}

async function verifyReviewOrigin(runId, expectedCommit, token) {
  if(!token)throw Error("GitHub read-only workflow token missing.");
  const url="https://api.github.com/repos/akbarholturaev11-lang/Kantent/actions/runs/"+runId;
  const {data}=await jsonRequest(url,{token,headers:{"X-GitHub-Api-Version":"2022-11-28"}});
  if(data?.repository?.full_name!=="akbarholturaev11-lang/Kantent" ||
      data?.path!==".github/workflows/video-review.yml" ||
      data?.head_branch!=="main" || data?.event!=="workflow_dispatch" ||
      data?.conclusion!=="success" || data?.head_sha!==expectedCommit) {
    throw Error("Review media not produced by successful manual video-review workflow on trusted main; refuse post.");
  }
  return {sourceRunId:Number(runId),sourceCommit:data.head_sha,sourceUrl:data.html_url};
}

async function verifyAccount(token,target) {
  const {data}=await jsonRequest(API_ROOT+"/accounts?platform="+encodeURIComponent(target.platform),{token});
  const accounts=data?.accounts;
  if(!Array.isArray(accounts))throw Error("Zernio did not return a valid social account list.");
  const entry=accounts.find(a=>(a._id??a.id)===target.accountId && a.platform===target.platform);
  if(!entry || entry.isActive===false ||
      ["disconnected","needs_reconnection","error"].includes(entry.status??entry.platformStatus)) {
    throw Error("Zernio credential does not have an active connection to the exact approved language/platform account.");
  }
  return {accountId:target.accountId,username:entry.username??null};
}

async function uploadExactVideo(token,video,episodeId,language,platform) {
  const bytes=await fs.readFile(video);
  if(bytes.length<8000 || bytes.length>350*1024*1024)
    throw Error("MP4 must be 8 KB to 350 MB for protected GitHub runner upload.");
  const filename=[episodeId,language,platform,"approved"].join("-")+".mp4";
  const {data}=await jsonRequest(API_ROOT+"/media/presign",{
    method:"POST",token,body:{filename,contentType:"video/mp4",size:bytes.length}});
  const uploadUrl=safeSignedUploadUrl(data?.uploadUrl);
  if(!/^https:\/\/media\.zernio\.com\//.test(data?.publicUrl??""))
    throw Error("Zernio did not return an expected HTTPS media URL.");
  const result=await fetch(uploadUrl,{method:"PUT",headers:{"Content-Type":"video/mp4"},
    body:bytes,signal:AbortSignal.timeout(10*60*1000)});
  if(!result.ok)throw Error("Presigned Zernio media PUT failed (HTTP "+result.status+"). No post was created.");
  return data.publicUrl;
}

async function writeReceipt(value) {
  await fs.mkdir(RECEIPT,{recursive:true});
  await fs.writeFile(path.join(RECEIPT,"receipt.json"),JSON.stringify(value,null,2)+"\n");
}

export async function executeApprovedPublication(root,env=process.env) {
  if(env.GITHUB_EVENT_NAME!=="workflow_dispatch" || env.GITHUB_REPOSITORY!=="akbarholturaev11-lang/Kantent" ||
     env.GITHUB_REF!=="refs/heads/main" || env.GITHUB_ACTOR!=="akbarholturaev11-lang") {
    throw Error("Only explicitly dispatched owner action on trusted default branch may publish.");
  }
  const approval=validateApprovedIntent(requestEnv(env),env);
  const manifest=JSON.parse(await fs.readFile(path.join(root,"manifest.json"),"utf8"));
  const chosen=selectApprovedArtifact(manifest,approval);
  const expectedVideo=artifactAbsolutePath(root,chosen.videoRel);
  const expectedPost=artifactAbsolutePath(root,chosen.postRel);
  const [videoBytes,postBytes]=await Promise.all([fs.readFile(expectedVideo),fs.readFile(expectedPost)]);
  const videoHash=createHash("sha256").update(videoBytes).digest("hex");
  const postHash=createHash("sha256").update(postBytes).digest("hex");
  if(videoHash!==approval.videoSha256 || postHash!==approval.postSha256)
    throw Error("Owner hash mismatch after downloading GitHub artifact; stop before network or uploading.");
  if(videoBytes.length<8000)throw Error("Missing real MP4.");
  const origin=await verifyReviewOrigin(approval.runId,manifest.sourceCommit,env.GITHUB_TOKEN);
  const zernio=zernioRoute(approval.language,env);
  const account=await verifyAccount(zernio.secret,{...approval.target,platform:approval.platform});
  const idempotencyKey=deterministicPostKey(manifest,approval);
  const safeReceipt={
    episodeId:manifest.episodeId, sourceRunId:origin.sourceRunId,
    sourceCommit:manifest.sourceCommit,sourceUrl:origin.sourceUrl,
    language:approval.language,platform:approval.platform,accountId:approval.target.accountId,
    connectedUsername:account.username,videoSha256:approval.videoSha256,
    postPreviewSha256:approval.postSha256,
    approvedCaptionSha256:createHash("sha256").update(approval.content).digest("hex"),
    approvedMode:approval.mode,approvedSchedule:approval.scheduledFor||null,
    approvalConfirmed:approval.ownerExplicitlyConfirmed,
    idempotencyKey,
    state:"validated-owner-approval-awaiting-upload",
  };
  await writeReceipt(safeReceipt);
  const publicUrl=await uploadExactVideo(zernio.secret,expectedVideo,manifest.episodeId,approval.language,approval.platform);
  await writeReceipt({...safeReceipt,state:"media-uploaded-post-not-created"});
  // This is the only social POST. Owner has supplied exact video and text hashes,
  // target, platform policy and mode, and typed a mode-specific confirmation.
  const payload=publicationBody(approval,publicUrl);
  const created=await jsonRequest(API_ROOT+"/posts",{
    method:"POST",token:zernio.secret,
    headers:{"Idempotency-Key":idempotencyKey},
    body:payload,
  });
  const rawId=created.data?.post?._id??created.data?.post?.id??null;
  await writeReceipt({...safeReceipt,state:"post-created-awaiting-verification",
    postId:rawId,reportedStatus:created.data?.post?.status??null});
  const result=parseZernioPostReply(created.data,approval);
  // Do not infer actual publication from HTTP 201 alone: require GET readback.
  const readback=await jsonRequest(API_ROOT+"/posts/"+encodeURIComponent(result.postId),{token:zernio.secret});
  const fromGet=readback.data?.post??readback.data;
  const validated=parseZernioPostReply({post:fromGet},approval);
  const receipt={...safeReceipt,state:validated.status,postId:validated.postId,
    platformPostId:validated.platformPostId,platformPostUrl:validated.platformPostUrl,
    resultVerifiedBy:"Zernio GET /v1/posts/{id}",updatedAt:new Date().toISOString()};
  await writeReceipt(receipt);
  console.log("Zernio readback verified: "+receipt.language+"/"+receipt.platform+
    " status="+receipt.state+" postId="+receipt.postId);
  return receipt;
}

if(process.argv[1] && path.resolve(process.argv[1])===self){
  const root=process.argv[2];
  if(!root || !path.isAbsolute(root))throw Error("Usage: node scripts/zernio-approved-publish.mjs /absolute/review-artifact-directory");
  executeApprovedPublication(root).catch(e=>{
    console.error("ZERNIO_APPROVAL_PIPELINE_BLOCKED: "+String(e.message||"error").slice(0,450));
    process.exitCode=1;
  });
}
