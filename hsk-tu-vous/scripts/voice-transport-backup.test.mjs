import test from "node:test";
import assert from "node:assert/strict";
import {
  fallbackHttpStatus, isOpenRouterBackupEligible, openRouterBackupKey,
  withOpenRouterBackup,
} from "./voice-transport-backup.mjs";

test("paid transport is never enabled implicitly", () => {
  assert.equal(openRouterBackupKey({}, "gemini-direct"), null);
  assert.equal(openRouterBackupKey({
    HSK_AI_OPENROUTER_FALLBACK_ENABLED: "true", OPENROUTER_API_KEY: "secret",
  }, "openrouter"), null);
  assert.throws(() => openRouterBackupKey({
    HSK_AI_OPENROUTER_FALLBACK_ENABLED: "true",
  }, "gemini-direct"), /OPENROUTER_API_KEY/);
  assert.equal(openRouterBackupKey({
    HSK_AI_OPENROUTER_FALLBACK_ENABLED: "true", OPENROUTER_API_KEY: "  test-key  ",
  }, "gemini-direct"), "test-key");
});

test("only availability failures qualify; credentials and bad input do not", () => {
  for (const status of [429, 500, 502, 503, 504]) {
    assert.equal(isOpenRouterBackupEligible(new Error("request failed (HTTP " + status + ")")), true);
    assert.equal(fallbackHttpStatus({httpStatus:status}), status);
  }
  for (const status of [400, 401, 403, 404, 413, 422]) {
    assert.equal(isOpenRouterBackupEligible(new Error("failed (HTTP " + status + ")")), false);
  }
  assert.equal(isOpenRouterBackupEligible(new Error("bad word timestamps")), false);
});

test("successful direct speech never invokes OpenRouter", async () => {
  let backups = 0;
  const wav = Buffer.from("RIFF_test");
  const actual = await withOpenRouterBackup({
    stage:"tts", enabled:true, primary:async()=>wav,
    backup:async()=>{backups++;return Buffer.from("other");},
  });
  assert.equal(actual, wav);
  assert.equal(backups, 0);
});

test("one availability failure invokes backup once and records transport after success", async () => {
  let calls=0;
  const events=[];
  const wav=Buffer.from("RIFF_backup");
  const actual=await withOpenRouterBackup({
    stage:"tts", enabled:true,
    primary:async()=>{throw new Error("quota (HTTP 429)");},
    backup:async()=>{calls++;return wav;},
    onFallback:e=>events.push(e),
  });
  assert.equal(actual,wav);assert.equal(calls,1);
  assert.deepEqual(events,[{stage:"tts",from:"gemini-direct",to:"openrouter",httpStatus:429}]);
});

test("no retry after failed backup, no credential bypass and no hidden transport change", async () => {
  let changes=0;
  const backup = async () => {throw new Error("OpenRouter also unavailable");};
  await assert.rejects(withOpenRouterBackup({
    stage:"tts",enabled:true,
    primary:async()=>{throw new Error("Gemini (HTTP 503)");},
    backup,onFallback:()=>changes++,
  }),/OpenRouter also unavailable/);
  assert.equal(changes,0);
  let invoked=0;
  await assert.rejects(withOpenRouterBackup({
    stage:"tts",enabled:true,
    primary:async()=>{throw new Error("invalid key (HTTP 401)");},
    backup:async()=>{invoked++;return Buffer.from("unexpected");},
  }),/HTTP 401/);
  assert.equal(invoked,0);
  await assert.rejects(withOpenRouterBackup({
    stage:"tts",enabled:true,allowFallback:false,
    primary:async()=>{throw new Error("quota (HTTP 429)");},
    backup:async()=>{invoked++;return Buffer.from("unexpected");},
  }),/HTTP 429/);
  assert.equal(invoked,0);
});
