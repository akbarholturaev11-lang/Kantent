import test from "node:test";
import assert from "node:assert/strict";
import {
 validateApprovedIntent,selectApprovedArtifact,publicationBody,
 deterministicPostKey,safeSignedUploadUrl,parseZernioPostReply,artifactAbsolutePath,
} from "./zernio-publication-core.mjs";

const env={
 ZERNIO_RU_INSTAGRAM_ACCOUNT_ID:"6a411e989d9472faae10a430",
 ZERNIO_RU_YOUTUBE_ACCOUNT_ID:"6ac96e053f8f4ffc10b0655f",
 ZERNIO_TG_INSTAGRAM_ACCOUNT_ID:"6ae0f16205fd6f5357f8503d",
};
const video="a".repeat(64),post="b".repeat(64),source="d".repeat(40),contentHash="c".repeat(64);
const fields={
 runId:"40552075736",language:"ru",platform:"instagram",accountId:env.ZERNIO_RU_INSTAGRAM_ACCOUNT_ID,
 mode:"draft",videoSha256:video,postSha256:post,confirmation:"SAVE_EXACT_VIDEO_AS_DRAFT",
 content:"Проверьте этот урок: 二 или 两? #HSKAI",shareToFeed:"true",scheduledFor:"",
};
const manifest={schemaVersion:1,episodeId:"er-vs-liang-cafe-20261026",sourceCommit:source,
 state:"rendered-pending-owner-approval",published:false,publicationAuthorized:false,
 languages:{
  ru:{
   instagram:{video:"ru/instagram/video.mp4",sha256:video,postSha256:post,contentHash,ctaExperimentId:"cta-ru-ig"},
   youtube:{video:"ru/youtube/video.mp4",sha256:video,postSha256:post,contentHash,ctaExperimentId:"cta-ru-yt"},
  },
  tg:{instagram:{video:"tg/instagram/video.mp4",sha256:video,postSha256:post,contentHash,ctaExperimentId:"cta-tg-ig"}},
 }};
test("exact owner draft approval creates an unpublished Zernio draft payload",()=>{
 const a=validateApprovedIntent(fields,env);
 assert.deepEqual(a.target,{language:"ru",platform:"instagram",accountId:env.ZERNIO_RU_INSTAGRAM_ACCOUNT_ID,variable:"ZERNIO_RU_INSTAGRAM_ACCOUNT_ID",expectedUsername:"@hskai.app",credentialGroup:"ru-primary"});
 const target=selectApprovedArtifact(manifest,a);
 assert.equal(target.videoRel,"ru/instagram/video.mp4");
 assert.equal(target.postRel,"ru/instagram/post.md");
 const body=publicationBody(a,"https://media.zernio.com/temp/safe.mp4");
 assert.equal(body.isDraft,true);assert.equal(body.publishNow,undefined);
 assert.deepEqual(body.platforms,[{platform:"instagram",accountId:env.ZERNIO_RU_INSTAGRAM_ACCOUNT_ID,platformSpecificData:{shareToFeed:true}}]);
 assert.match(deterministicPostKey(manifest,a),/^hsk-[a-f0-9]{56}$/);
 assert.equal(deterministicPostKey(manifest,a),deterministicPostKey(manifest,a));
});
test("owner confirmation, hashes, post copy and account ID cannot be bypassed",()=>{
 const variations=[
  {confirmation:"APPROVE_EXACT_VIDEO_AND_PUBLISH_NOW"},
  {videoSha256:"0".repeat(64)},{postSha256:"0".repeat(64)},
  {accountId:env.ZERNIO_TG_INSTAGRAM_ACCOUNT_ID},
  {content:"пакет готов к ручной проверке"},
  {content:" "},{content:"text "},{content:"x".repeat(2201)},
  {mode:"now"},{mode:"scheduled"},
  {scheduledFor:"2027-01-01T12:00:00+08:00"},
 ];
 for(const override of variations){
  const patched={...fields,...override};
  if("videoSha256" in override||"postSha256" in override){
   const a=validateApprovedIntent(patched,env);
   assert.throws(()=>selectApprovedArtifact(manifest,a));
  }else assert.throws(()=>validateApprovedIntent(patched,env),
   JSON.stringify(override));
 }
 assert.throws(()=>validateApprovedIntent({...fields,language:"tg",platform:"youtube"},env),/exactly match/);
 assert.throws(()=>validateApprovedIntent({...fields,language:"tg",accountId:env.ZERNIO_RU_INSTAGRAM_ACCOUNT_ID},{}),/exactly match/);
});
test("Tajik destination can only receive an approved Tajik Instagram video",()=>{
 const a=validateApprovedIntent({...fields,language:"tg",accountId:env.ZERNIO_TG_INSTAGRAM_ACCOUNT_ID,content:"Ду пиёла чой",shareToFeed:"false"},env);
 assert.equal(a.target.accountId,env.ZERNIO_TG_INSTAGRAM_ACCOUNT_ID);
 assert.equal(selectApprovedArtifact(manifest,a).videoRel,"tg/instagram/video.mp4");
 assert.deepEqual(publicationBody(a,"https://media.zernio.com/temp/tg.mp4").platforms[0].platformSpecificData,{shareToFeed:false});
});
test("YouTube settings must be explicitly selected and match YouTube route",()=>{
 const yt={...fields,platform:"youtube",accountId:env.ZERNIO_RU_YOUTUBE_ACCOUNT_ID,
 content:"Урок HSK #Shorts",title:"二 и 两 — два по-китайски",
 visibility:"unlisted",madeForKids:"false",containsSyntheticMedia:"true"};
 const a=validateApprovedIntent(yt,env);
 assert.equal(selectApprovedArtifact(manifest,a).videoRel,"ru/youtube/video.mp4");
 const body=publicationBody(a,"https://media.zernio.com/temp/yt.mp4");
 assert.equal(body.platforms[0].platformSpecificData.title,yt.title);
 assert.equal(body.platforms[0].platformSpecificData.containsSyntheticMedia,true);
 for(const override of [{title:""},{title:"x".repeat(101)},{madeForKids:""},{visibility:"maybe"},{containsSyntheticMedia:""}]){
  assert.throws(()=>validateApprovedIntent({...yt,...override},env));
 }
});
test("scheduled mode requires explicit future Shanghai timestamp and schedules only after approval",()=>{
 const future=new Date("2027-01-01T03:00:00Z");
 const scheduled="2027-01-02T13:30:00+08:00";
 const a=validateApprovedIntent({...fields,mode:"scheduled",confirmation:"APPROVE_EXACT_VIDEO_AND_SCHEDULE",scheduledFor:scheduled},env,future.valueOf());
 const body=publicationBody(a,"https://media.zernio.com/temp/s.mp4");
 assert.equal(body.scheduledFor,scheduled);
 assert.equal(body.timezone,"Asia/Shanghai");
 assert.equal(body.publishNow,undefined);assert.equal(body.isDraft,undefined);
 for(const bad of ["2026-01-02T13:30:00+08:00","2027-01-02T13:30:00Z","2027-01-02T13:30:00+07:00","2027-01-01T03:01:00+08:00"]){
  assert.throws(()=>validateApprovedIntent({...fields,mode:"scheduled",confirmation:"APPROVE_EXACT_VIDEO_AND_SCHEDULE",scheduledFor:bad},env,future.valueOf()));
 }
 const now=validateApprovedIntent({...fields,mode:"now",confirmation:"APPROVE_EXACT_VIDEO_AND_PUBLISH_NOW"},env);
 assert.equal(publicationBody(now,"https://media.zernio.com/temp/s.mp4").publishNow,true);
});
test("response must prove matching account and actual status, never infer from 2xx",()=>{
 const a=validateApprovedIntent(fields,env);
 const good={post:{_id:"6ab31e989d9472faae10a4af",status:"draft",
 platforms:[{platform:"instagram",accountId:env.ZERNIO_RU_INSTAGRAM_ACCOUNT_ID}]}};
 assert.equal(parseZernioPostReply(good,a).status,"draft");
 assert.throws(()=>parseZernioPostReply({post:{...good.post,status:"published"}},a),/draft-only/);
 assert.throws(()=>parseZernioPostReply({post:{...good.post,platforms:[{platform:"instagram",accountId:env.ZERNIO_TG_INSTAGRAM_ACCOUNT_ID}]}},a),/exact target/);
 assert.throws(()=>parseZernioPostReply({post:{status:"draft"}},a),/real post ID/);
});
test("refuse untrusted upload destinations, non-videos, cross-target artifact paths",()=>{
 assert.match(safeSignedUploadUrl("https://a.r2.cloudflarestorage.com/temp/object.mp4?X-Amz=abc"),/r2.cloudflarestorage.com/);
 for(const url of ["http://a.r2.cloudflarestorage.com/x","https://evil.com/x","https://x.r2.cloudflarestorage.com.evil.com/x"]){
  assert.throws(()=>safeSignedUploadUrl(url));
 }
 assert.throws(()=>artifactAbsolutePath("/tmp/download","../../etc/passwd"));
 assert.equal(artifactAbsolutePath("/tmp/download","tg/facebook/video.mp4"),"/tmp/download/tg/facebook/video.mp4");
 assert.throws(()=>artifactAbsolutePath("/tmp/download","tg/telegram/video.mp4"),/Unexpected artifact path/);
 assert.throws(()=>publicationBody(validateApprovedIntent(fields,env),"https://evil.com/test.mp4"));
 assert.throws(()=>selectApprovedArtifact({...manifest,published:true},validateApprovedIntent(fields,env)));
});
