import test from "node:test";
import assert from "node:assert/strict";
import {
  GEMINI_SECRET_NAMES, geminiKeySlots, requireGeminiKeySlots,
  initialGeminiCredential, geminiRotationDecision,
  zernioRoute, credentialReadiness, withGeminiKeyFailover,
  enabledVideoPlatforms, zernioTargetAccount, assertZernioPublishingAuthorized, telegramNewsRoute,
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
  assert.throws(()=>zernioRoute("ru",{ZERNIO_TG_API_KEY:"tg"}),/No Zernio API key for ru-primary/);
  assert.throws(()=>zernioRoute("tg",{ZERNIO_API_KEY:"ru"}),/No Zernio API key for tg-primary/);
  assert.throws(()=>zernioRoute("en",env),/not an owner-authorized/);
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

test("owner-authorized social destinations stay mapped to the correct language and account", () => {
  assert.deepEqual(enabledVideoPlatforms("ru"), ["instagram", "youtube", "tiktok", "facebook"]);
  assert.deepEqual(enabledVideoPlatforms("tg"), ["instagram", "youtube", "tiktok", "facebook"]);
  assert.throws(() => enabledVideoPlatforms("zh"));
  const env = {
    ZERNIO_RU_INSTAGRAM_ACCOUNT_ID: "6a411e989d9472faae10a430",
    ZERNIO_RU_YOUTUBE_ACCOUNT_ID: "6ac96e053f8f4ffc10b0655f",
    ZERNIO_TG_INSTAGRAM_ACCOUNT_ID: "6ae0f16205fd6f5357f8503d",
    ZERNIO_TG_YOUTUBE_ACCOUNT_ID: "6ae160123787e4c71b522d64",
    ZERNIO_RU_FACEBOOK_ACCOUNT_ID: "6ae161de384955d3b3ff194b",
    ZERNIO_TG_FACEBOOK_ACCOUNT_ID: "6ae161de384955d3b3ff194b",
  };
  assert.equal(zernioTargetAccount("ru", "youtube", env).accountId, env.ZERNIO_RU_YOUTUBE_ACCOUNT_ID);
  assert.equal(zernioTargetAccount("ru", "youtube", env).expectedUsername, "@hskai_app");
  assert.equal(zernioTargetAccount("tg", "instagram", env).accountId, env.ZERNIO_TG_INSTAGRAM_ACCOUNT_ID);
  assert.equal(zernioTargetAccount("tg", "instagram", env).expectedUsername, "@hskai.apptj");
  const mapped = zernioTargetAccount("tg", "youtube", env);
  assert.equal(mapped.expectedUsername, "@hskaiapp-tj");
  assert.equal(zernioTargetAccount("ru", "facebook", env).expectedUsername, "Akbarholturaev");
  assert.throws(() => assertZernioPublishingAuthorized("ru", "facebook"), /publishing is disabled/);
  assert.doesNotThrow(() => assertZernioPublishingAuthorized("tg", "facebook"));
  assert.equal(zernioTargetAccount("tg", "facebook", env).accountId, env.ZERNIO_TG_FACEBOOK_ACCOUNT_ID);
  assert.throws(()=>zernioTargetAccount("ru", "tiktok", {
    ZERNIO_RU_TIKTOK_ACCOUNT_ID:"6ac96e053f8f4ffc10b0655f"
  }),/conflicts/);
  assert.throws(()=>zernioTargetAccount("tg", "tiktok", {
    ZERNIO_TG_TIKTOK_ACCOUNT_ID:"6ac96e053f8f4ffc10b0655f"
  }),/conflicts/);
  assert.throws(() => zernioTargetAccount("tg", "telegram", {
    ZERNIO_TG_TELEGRAM_ACCOUNT_ID:"6ae1661bf80a20df8f31158e"
  }), /not an owner-authorized video destination/);
  assert.equal(zernioTargetAccount("tg", "instagram",{
    ZERNIO_RU_INSTAGRAM_ACCOUNT_ID:env.ZERNIO_RU_INSTAGRAM_ACCOUNT_ID
  }).accountId,"6ae0f16205fd6f5357f8503d");
  assert.equal(zernioTargetAccount("ru", "instagram", {}).accountId,"6a411e989d9472faae10a430");
});

test("connection groups bind all 8 exact RU/TJ video targets without username-derived routing",()=>{
 const env={
  ZERNIO_API_KEY:"ru-ig-youtube",ZERNIO_TG_API_KEY:"tj-ig-youtube",
  ZERNIO_TIKTOK_TELEGRAM_API_KEY:"ru-tiktok",ZERNIO_TIKTOK_FACEBOOK_API_KEY:"tj-tiktok-facebook",
 };
 for(const [lang,platform,id,group,secret] of [
   ["ru","instagram","6a411e989d9472faae10a430","ru-primary","ru-ig-youtube"],
   ["ru","youtube","6ac96e053f8f4ffc10b0655f","ru-primary","ru-ig-youtube"],
   ["ru","tiktok","6ae16327a2845fbdb07e5ccb","tiktok-telegram","ru-tiktok"],
   ["ru","facebook","6ae161de384955d3b3ff194b","tiktok-facebook","tj-tiktok-facebook"],
   ["tg","instagram","6ae0f16205fd6f5357f8503d","tg-primary","tj-ig-youtube"],
   ["tg","youtube","6ae160123787e4c71b522d64","tg-primary","tj-ig-youtube"],
   ["tg","tiktok","6ae16064ecf91092adba7d68","tiktok-facebook","tj-tiktok-facebook"],
   ["tg","facebook","6ae161de384955d3b3ff194b","tiktok-facebook","tj-tiktok-facebook"],
 ]) { const target=zernioTargetAccount(lang,platform,env);
   assert.equal(target.accountId,id); assert.equal(target.credentialGroup,group);
   assert.equal(zernioRoute(lang,env,platform).secret,secret);
 }
 assert.equal(zernioTargetAccount("tg","tiktok",env).expectedUsername,"@hskai.ru");
 assert.equal(telegramNewsRoute(env).accountId,"6ae1661bf80a20df8f31158e");
 assert.equal(telegramNewsRoute(env).secret,"ru-tiktok");
 assert.throws(()=>zernioRoute("ru",{ZERNIO_API_KEY:"only-ru"},"tiktok"),/No Zernio API key for tiktok-telegram/);
 assert.throws(()=>zernioRoute("tg",{ZERNIO_TG_API_KEY:"only-tg"},"tiktok"),/No Zernio API key for tiktok-facebook/);
 assert.throws(()=>zernioTargetAccount("tg","tiktok",{ZERNIO_TG_TIKTOK_ACCOUNT_ID:"6ae16327a2845fbdb07e5ccb"}),/conflicts/);
});
