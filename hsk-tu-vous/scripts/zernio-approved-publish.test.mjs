/** No network/credentials: mock the complete approved Zernio API flow. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {createHash} from "node:crypto";
import {executeApprovedPublication} from "./zernio-approved-publish.mjs";

const ROOT="akbarholturaev11-lang/Kantent";
const ID="6a411e989d9472faae10a430";
const POST_ID="6ab31e989d9472faae10a4af";
const SOURCE="a".repeat(40);

function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});}

test("owner-approved draft runs presign -> auth-free PUT -> one post -> status readback",async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"hsk-zernio-mock-"));
  const oldFetch=globalThis.fetch;
  try{
    const dir=path.join(temp,"source");
    const itemDir=path.join(dir,"ru","instagram");
    await fs.mkdir(itemDir,{recursive:true});
    const fakeVideo=Buffer.alloc(12000,7),postText="Reviewed proposed post\n";
    const videoHash=createHash("sha256").update(fakeVideo).digest("hex");
    const postHash=createHash("sha256").update(postText).digest("hex");
    await fs.writeFile(path.join(itemDir,"video.mp4"),fakeVideo);
    await fs.writeFile(path.join(itemDir,"post.md"),postText);
    await fs.writeFile(path.join(dir,"manifest.json"),JSON.stringify({
      schemaVersion:1,episodeId:"er-vs-liang-cafe-20261026",sourceCommit:SOURCE,
      state:"rendered-pending-owner-approval",published:false,publicationAuthorized:false,
      languages:{ru:{instagram:{
        video:"ru/instagram/video.mp4",sha256:videoHash,postSha256:postHash,
        contentHash:"b".repeat(64),ctaExperimentId:"approved-cta-1"
      }}}
    }));
    const calls=[];
    globalThis.fetch=async(url,options={})=>{
      const pathname=new URL(url).pathname, method=options.method??"GET";
      calls.push({pathname,method,auth:options.headers?.Authorization??null,
        ...(method==="POST"&&pathname==="/api/v1/posts"?{body:JSON.parse(options.body),idempotency:options.headers?.["Idempotency-Key"]}: {})});
      if(pathname==="/repos/akbarholturaev11-lang/Kantent/actions/runs/40552075736")
        return response({repository:{full_name:ROOT},path:".github/workflows/video-review.yml",
          head_branch:"main",event:"workflow_dispatch",conclusion:"success",
          head_sha:SOURCE,html_url:"https://github.com/akbarholturaev11-lang/Kantent/actions/runs/40552075736"});
      if(pathname==="/api/v1/accounts")
        return response({accounts:[{_id:ID,platform:"instagram",username:"hskai.app",isActive:true}]});
      if(pathname==="/api/v1/media/presign")
        return response({uploadUrl:"https://example.r2.cloudflarestorage.com/temp/lesson.mp4?X-Amz-Signature=mock",
          publicUrl:"https://media.zernio.com/temp/lesson.mp4"});
      if(pathname==="/temp/lesson.mp4"&&method==="PUT")return new Response("",{status:200});
      const post={_id:POST_ID,status:"draft",platforms:[{platform:"instagram",accountId:ID}]};
      if(pathname==="/api/v1/posts"&&method==="POST")return response({post},201);
      if(pathname==="/api/v1/posts/"+POST_ID)return response({post});
      throw Error("unexpected fetch "+method+" "+url);
    };
    const env={
      GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REPOSITORY:ROOT,
      GITHUB_REF:"refs/heads/main",GITHUB_ACTOR:"akbarholturaev11-lang",
      GITHUB_TOKEN:"mock-gh-token", ZERNIO_API_KEY:"mock-zernio-key",
      ZERNIO_RU_INSTAGRAM_ACCOUNT_ID:ID,
      APPROVED_RUN_ID:"40552075736",APPROVED_LANGUAGE:"ru",APPROVED_PLATFORM:"instagram",
      APPROVED_MODE:"draft",APPROVED_ACCOUNT_ID:ID,
      APPROVED_VIDEO_SHA256:videoHash,APPROVED_POST_SHA256:postHash,
      APPROVED_POST_JSON:'{"content":"二 vs 两 — учебный ролик #HSKAI","shareToFeed":true}',
      APPROVAL_CONFIRMATION:"SAVE_EXACT_VIDEO_AS_DRAFT",
      PUBLICATION_RECEIPT_DIR:path.join(temp,"receipt"),
    };
    const result=await executeApprovedPublication(dir,env);
    assert.equal(result.state,"draft");assert.equal(result.postId,POST_ID);
    assert.deepEqual(calls.map(c=>c.method+" "+c.pathname),[
      "GET /repos/akbarholturaev11-lang/Kantent/actions/runs/40552075736",
      "GET /api/v1/accounts","POST /api/v1/media/presign",
      "PUT /temp/lesson.mp4","POST /api/v1/posts","GET /api/v1/posts/"+POST_ID,
    ]);
    assert.equal(calls[3].auth,null,"R2 PUT must not receive Zernio auth header");
    assert.equal(calls[4].body.isDraft,true);
    assert.equal(calls[4].body.publishNow,undefined);
    assert.equal(calls[4].body.platforms[0].accountId,ID);
    assert.match(calls[4].idempotency,/^hsk-[0-9a-f]{56}$/);
    assert.equal((await fs.readFile(path.join(temp,"receipt","receipt.json"),"utf8")).includes("mock-zernio-key"),false);
    // A wrong owner hash is blocked before any network request, upload, or draft.
    calls.length=0;
    await assert.rejects(executeApprovedPublication(dir,{...env,APPROVED_VIDEO_SHA256:"0".repeat(64)}),/hashes do not match/);
    assert.equal(calls.length,0);
    // A wrong social account cannot use RU credentials to upload to TG.
    await assert.rejects(executeApprovedPublication(dir,{...env,APPROVED_ACCOUNT_ID:"6ae0f16205fd6f5357f8503d"}),/exactly match/);
    assert.equal(calls.length,0);
    await assert.rejects(executeApprovedPublication(dir,{...env,GITHUB_ACTOR:"unauthorized-user"}),/owner/);
    assert.equal(calls.length,0);
  }finally{
    globalThis.fetch=oldFetch;
    await fs.rm(temp,{recursive:true,force:true});
  }
});
