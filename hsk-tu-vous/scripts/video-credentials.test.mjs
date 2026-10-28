import test from "node:test";
import assert from "node:assert/strict";
import {
  GEMINI_SECRET_NAMES, geminiKeySlots, requireGeminiKeySlots,
  initialGeminiCredential, geminiRotationDecision,
  zernioRoute, credentialReadiness, withGeminiKeyFailover,
  enabledVideoPlatforms, zernioTargetAccount, telegramNewsRoute,
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

test("all six verified video accounts have exact canonical IDs and language isolation", () => {
  const expected = {
    ru: {
      instagram: ["6a411e989d9472faae10a430","@hskai.app","ru-primary"],
      youtube: ["6ac96e053f8f4ffc10b0655f","@hskai_app","ru-primary"],
      tiktok: ["6ae16327a2845fbdb07e5ccb","@hskai.app","tiktok-telegram"],
    },
    tg: {
      instagram: ["6ae0f16205fd6f5357f8503d","@hskai.apptj","tg-primary"],
      youtube: ["6ae160123787e4c71b522d64","@hskaiapp-tj","tg-primary"],
      tiktok: ["6ae16064ecf91092adba7d68","@hskai.ru","tiktok-facebook"],
    },
  };
  for (const [language,platforms] of Object.entries(expected)) {
    for (const [platform,[id,name,group]] of Object.entries(platforms)) {
      const target=zernioTargetAccount(language,platform,{});
      assert.equal(target.accountId,id);
      assert.equal(target.expectedUsername,name);
      assert.equal(target.credentialGroup,group);
      const variable=target.variable;
      assert.equal(zernioTargetAccount(language,platform,{[variable]:id}).accountId,id);
      assert.throws(()=>zernioTargetAccount(language,platform,{
        [variable]:language==="ru"?"6ae0f16205fd6f5357f8503d":"6a411e989d9472faae10a430",
      }),/conflicts with the verified owner account map/);
    }
  }
  assert.throws(()=>zernioTargetAccount("ru","telegram",{}),/not an owner-authorized/);
  assert.throws(()=>zernioTargetAccount("tg","facebook",{}),/not an owner-authorized/);
  assert.throws(()=>zernioTargetAccount("en","instagram",{}),/not an owner-authorized/);
});

test("each connected Zernio token group is selected by account not language label", () => {
  const env={
    ZERNIO_API_KEY:"russian-instagram-youtube",
    ZERNIO_TG_API_KEY:"tajik-instagram-youtube",
    ZERNIO_TIKTOK_TELEGRAM_API_KEY:"russian-tiktok-and-tajik-telegram",
    ZERNIO_TIKTOK_FACEBOOK_API_KEY:"tajik-tiktok-and-unauthorized-facebook",
  };
  assert.equal(zernioRoute("ru",env,"instagram").secret,env.ZERNIO_API_KEY);
  assert.equal(zernioRoute("ru",env,"youtube").secret,env.ZERNIO_API_KEY);
  assert.equal(zernioRoute("tg",env,"instagram").secret,env.ZERNIO_TG_API_KEY);
  assert.equal(zernioRoute("tg",env,"youtube").secret,env.ZERNIO_TG_API_KEY);
  assert.equal(zernioRoute("ru",env,"tiktok").secret,env.ZERNIO_TIKTOK_TELEGRAM_API_KEY);
  assert.equal(zernioRoute("tg",env,"tiktok").secret,env.ZERNIO_TIKTOK_FACEBOOK_API_KEY);
  assert.equal(telegramNewsRoute(env).secret,env.ZERNIO_TIKTOK_TELEGRAM_API_KEY);
  assert.equal(telegramNewsRoute(env).accountId,"6ae1661bf80a20df8f31158e");
  assert.throws(()=>zernioRoute("ru",{ZERNIO_API_KEY:"ru"},"tiktok"),/No Zernio API key for tiktok-telegram/);
  assert.throws(()=>zernioRoute("tg",{ZERNIO_TG_API_KEY:"tg"},"tiktok"),/No Zernio API key for tiktok-facebook/);
  assert.throws(()=>telegramNewsRoute({ZERNIO_TG_API_KEY:"tg"}),/Missing TikTok\/Telegram/);
  assert.throws(()=>telegramNewsRoute({...env,ZERNIO_TG_TELEGRAM_ACCOUNT_ID:"6a411e989d9472faae10a430"}),/conflicts/);
});
