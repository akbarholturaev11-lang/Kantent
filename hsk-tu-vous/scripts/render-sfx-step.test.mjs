import test from "node:test";
import assert from "node:assert/strict";
import {runSfxPreparation} from "./render-sfx-step.mjs";

test("successful SFX preparation never writes a failure status",async()=>{
  const calls=[];
  const value={status:0,stdout:"ok"};
  const result=await runSfxPreparation({
    execute:()=>value,onFailure:async(err)=>calls.push(err.message),
  });
  assert.equal(result,value);
  assert.deepEqual(calls,[]);
});

test("SFX exit code failure records render-failed with concrete stderr before throwing",async()=>{
  const status=[];
  await assert.rejects(runSfxPreparation({
    execute:()=>({status:19,stderr:"ffmpeg decoder missing"}),
    onFailure:async(err)=>status.push({stage:"render-failed",error:err.message}),
  }),/ffmpeg decoder missing/);
  assert.deepEqual(status,[{
    stage:"render-failed",
    error:"Не удалось подготовить звуковые эффекты: ffmpeg decoder missing",
  }]);
});

test("SFX spawn errors and synchronous throws each mark failure once without retry",async()=>{
  for(const mode of ["spawn","throw"]) {
    let started=0,failed=0;
    const error=new Error("ENOENT: ffmpeg");
    await assert.rejects(runSfxPreparation({
      execute:()=>{started++; if(mode==="throw")throw error; return {error,status:null};},
      onFailure:async(received)=>{failed++; assert.equal(received,error);},
    }),/ENOENT/);
    assert.equal(started,1);
    assert.equal(failed,1);
  }
});

test("missing subprocess status is not accidentally counted as success",async()=>{
  let failed=0;
  await assert.rejects(runSfxPreparation({
    execute:()=>({stdout:"partial output",status:null}),
    onFailure:async()=>{failed++;},
  }),/partial output/);
  assert.equal(failed,1);
});
