import test from "node:test";
import assert from "node:assert/strict";
import {
  GEMINI_SECRET_NAMES, geminiKeySlots, requireGeminiKeySlots,
  initialGeminiCredential, geminiRotationDecision,
  zernioRoute, credentialReadiness,
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

test("shared-project daily quota never enables automatic round-robin bypass", () => {
  assert.deepEqual(geminiRotationDecision({httpStatus:429}),
    {rotate:false,classification:"quota-exceeded"});
  assert.deepEqual(geminiRotationDecision({httpStatus:429,separateProjectsVerified:true}),
    {rotate:true,classification:"quota-exceeded"});
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
