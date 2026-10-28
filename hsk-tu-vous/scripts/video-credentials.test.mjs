import test from "node:test";
import assert from "node:assert/strict";
import {
  GEMINI_SECRET_NAMES, geminiKeySlots, requireGeminiKeySlots,
  initialGeminiCredential, geminiRotationDecision,
  zernioRoute, credentialReadiness, withGeminiKeyFailover,
  enabledVideoPlatforms, zernioTargetAccount,
} from "./video-credentials.mjs";

test("four Gemini slots remain ordered and duplicates never masquerade as spare quota", () => {
  const env = {
    GEMINI_API_KEY: "primary-fake-secret",
    GEMINI_API_KEY_BACKUP_1: "spare-one-fake-secret",
    GEMINI_API_KEY_BACKUP_2: "primary-fake-secret",
    GEMINI_API_KEY_BACKUP_3: "spare-three-fake-secret",
  };
  const slots = geminiKeySlots(env);
  assert.deepEqual(slots.map(({name}) => name), [
    GEMINI_SECRET_NAMES[0], GEMINI_SECRET_NAMES[1], GEMINI_SECRET_NAMES[3],
  ]);
  assert.equal(initialGeminiCredential(env).name, "GEMINI_API_KEY");
  assert.equal(credentialReadiness(env).geminiBackupCount, 2);
  assert.doesNotMatch(JSON.stringify(credentialReadiness(env)), /fake-secret/);
  assert.equal(initialGeminiCredential({GEMINI_API_KEY_BACKUP_1: "spare"}).name, "GEMINI_API_KEY_BACKUP_1");
  assert.throws(() => requireGeminiKeySlots({}), /Gemini credential/);
});

test("Google API daily quota never enables account or project rotation", () => {
  assert.deepEqual(geminiRotationDecision({httpStatus:429}),
    {rotate:false,classification:"quota-exceeded"});
  assert.deepEqual(geminiRotationDecision({httpStatus:429,separateProjectsVerified:true}),
    {rotate:false,classification:"quota-exceeded"});
  assert.deepEqual(geminiRotationDecision({httpStatus:401}),
    {rotate:true,classification:"invalid-credential"});
  assert.deepEqual(geminiRotationDecision({httpStatus:403,reason:"API_KEY_REVOKED"}),
    {rotate:true,classification:"credential-rejected"});
  assert.equal(geminiRotationDecision({httpStatus:403,reason:"daily quota exceeded"}).rotate,false);
  assert.equal(geminiRotationDecision({httpStatus:503}).rotate,false);
  assert.equal(geminiRotationDecision({httpStatus:400}).rotate,false);
});

test("Russian and Tajik Zernio credentials never cross-map", () => {
  const env={ZERNIO_API_KEY:"ru-only-fake",ZERNIO_TG_API_KEY:"tg-only-fake"};
  assert.deepEqual(
    [zernioRoute("ru",env).secretName,zernioRoute("tg",env).secretName],
    ["ZERNIO_API_KEY","ZERNIO_TG_API_KEY"],
  );
  assert.equal(zernioRoute("ru",env).secret,"ru-only-fake");
  assert.equal(zernioRoute("tg",env).secret,"tg-only-fake");
  assert.throws(()=>zernioRoute("ru",{ZERNIO_TG_API_KEY:"tg"}),/Zernio ru/);
  assert.throws(()=>zernioRoute("tg",{ZERNIO_API_KEY:"ru"}),/Zernio tg/);
  assert.throws(()=>zernioRoute("en",env),/Unsupported/);
  assert.throws(()=>zernioRoute("ru",{ZERNIO_API_KEY:"a",ZERNIO_RU_API_KEY:"b"}),/conflicting/);
  assert.equal(zernioRoute("ru",{ZERNIO_API_KEY:"a",ZERNIO_RU_API_KEY:"a"}).secretName,"ZERNIO_RU_API_KEY");
  assert.doesNotMatch(JSON.stringify(credentialReadiness(env)),/only-fake/);
});

test("bounded Gemini fallback happens only on permitted failed standalone requests", async () => {
  const state={slots:[
    {name:"GEMINI_API_KEY",secret:"primary-private"},
    {name:"GEMINI_API_KEY_BACKUP_1",secret:"backup-private"},
    {name:"GEMINI_API_KEY_BACKUP_2",secret:"last-private"},
  ],index:0};
  const attempted=[];
  const oldWarn=console.warn;
  const logged=[];
  console.warn=(...args)=>logged.push(args.join(" "));
  try {
    const value=await withGeminiKeyFailover(state,async(key,name)=>{
      attempted.push(name);
      if(key==="primary-private")throw new Error("Gemini request failed (HTTP 401)");
      return "audio-bytes";
    });
    assert.equal(value,"audio-bytes");
    assert.deepEqual(attempted,["GEMINI_API_KEY","GEMINI_API_KEY_BACKUP_1"]);
    assert.equal(state.index,1);
    assert.doesNotMatch(logged.join(" "),/private/);
  }finally{console.warn=oldWarn;}

  const quota={slots:state.slots,index:0};
  let invoked=0;
  await assert.rejects(withGeminiKeyFailover(quota,async()=>{
    invoked++;throw new Error("Gemini request failed (HTTP 429): quota exhausted");
  }),/HTTP 429/);
  assert.equal(invoked,1);
  assert.equal(quota.index,0);
  // Even a mistaken old on-switch must not permit quota circumvention.
  assert.equal(geminiRotationDecision({httpStatus:429,separateProjectsVerified:true}).rotate,false);
  const bad={slots:state.slots,index:0};
  await assert.rejects(withGeminiKeyFailover(bad,async()=>{throw new Error("network failed");}),/network failed/);
  assert.equal(bad.index,0);
});

test("disabled Tajik YouTube is never inferred from Russian credentials or optional account IDs", () => {
  assert.deepEqual(enabledVideoPlatforms("ru"), ["instagram", "youtube"]);
  assert.deepEqual(enabledVideoPlatforms("tg"), ["instagram"]);
  assert.throws(() => enabledVideoPlatforms("zh"));
  const env = {
    ZERNIO_RU_INSTAGRAM_ACCOUNT_ID: "6a411e989d9472faae10a430",
    ZERNIO_RU_YOUTUBE_ACCOUNT_ID: "6ac96e053f8f4ffc10b0655f",
    ZERNIO_TG_INSTAGRAM_ACCOUNT_ID: "6ab31e989d9472faae10a4af",
  };
  assert.equal(zernioTargetAccount("ru", "youtube", env).accountId, env.ZERNIO_RU_YOUTUBE_ACCOUNT_ID);
  assert.equal(zernioTargetAccount("tg", "instagram", env).accountId, env.ZERNIO_TG_INSTAGRAM_ACCOUNT_ID);
  assert.throws(() => zernioTargetAccount("tg", "youtube", env), /not enabled/);
  assert.throws(() => zernioTargetAccount("tg", "youtube", {
    ...env,ZERNIO_TG_YOUTUBE_ACCOUNT_ID:"6ac96e053f8f4ffc10b0655f"
  }),/not enabled/);
  assert.throws(() => zernioTargetAccount("tg", "instagram",{
    ZERNIO_RU_INSTAGRAM_ACCOUNT_ID:env.ZERNIO_RU_INSTAGRAM_ACCOUNT_ID
  }),/Missing\/invalid ZERNIO_TG_INSTAGRAM_ACCOUNT_ID/);
  assert.throws(() => zernioTargetAccount("ru", "instagram", {}),/Missing\/invalid/);
});
