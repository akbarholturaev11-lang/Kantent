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

test("Google's region refusal (HTTP 400) is a Direct availability failure; other 400s are not", async () => {
  const region = new Error("Gemini speech generation failed (HTTP 400): User location is not supported for the API use.");
  assert.equal(isOpenRouterBackupEligible(region), true);
  assert.equal(isOpenRouterBackupEligible(new Error("Gemini speech generation failed (HTTP 400): Invalid voice name.")), false);
  assert.equal(isOpenRouterBackupEligible(new Error("failed (HTTP 403): User location is not supported for the API use.")), false);
  const events = [];
  const wav = Buffer.from("RIFF_backup");
  assert.equal(await withOpenRouterBackup({
    stage: "tts", enabled: true, primary: async () => { throw region; },
    backup: async () => wav, onFallback: (e) => events.push(e),
  }), wav);
  assert.deepEqual(events, [{ stage: "tts", from: "gemini-direct", to: "openrouter", httpStatus: 400, reason: "provider-region-unsupported" }]);
  await assert.rejects(withOpenRouterBackup({
    stage: "tts", enabled: false, primary: async () => { throw region; }, backup: async () => wav,
  }), /User location/, "without the owner's opt-in the error still stops the run");
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

test("never-connected failures are retried/backed up; failures after sending are not", async () => {
  const { isPreConnectFailure } = await import("./voice-transport-backup.mjs");
  // Real 2026-11-08 TG run: fetch failed, cause UND_ERR_CONNECT_TIMEOUT to Google.
  const connectTimeout = Object.assign(new TypeError("fetch failed"),
    { cause: Object.assign(new Error("Connect Timeout Error"), { code: "UND_ERR_CONNECT_TIMEOUT" }) });
  const dns = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("getaddrinfo"), { code: "ENOTFOUND" }) });
  const happyEyeballs = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new AggregateError([
    Object.assign(new Error("a"), { code: "ECONNREFUSED" }), Object.assign(new Error("b"), { code: "ENETUNREACH" }),
  ]), {}) });
  // Real 2026-11-08 probe: reset during the TLS handshake (nothing was sent).
  const tlsHandshake = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(
    new Error("Client network socket disconnected before secure TLS connection was established"), { code: "ECONNRESET" }) });
  for (const error of [connectTimeout, dns, happyEyeballs, tlsHandshake]) {
    assert.equal(isPreConnectFailure(error), true);
    assert.equal(isOpenRouterBackupEligible(error), true);
  }
  const reset = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }) });
  const bodyTimeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  const resetAfterSend = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) });
  for (const error of [reset, resetAfterSend, bodyTimeout, new Error("bad word timestamps")]) {
    assert.equal(isPreConnectFailure(error), false);
    assert.equal(isOpenRouterBackupEligible(error), false);
  }
  const events = [];
  await withOpenRouterBackup({ stage: "tts", enabled: true, primary: async () => { throw connectTimeout; },
    backup: async () => Buffer.from("RIFF"), onFallback: (event) => events.push(event) });
  assert.equal(events[0].reason, "provider-unreachable");
});
