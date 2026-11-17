import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyPublicationMappings, validatePublicationMapping } from "./content-attribution.mjs";
import { creativeRecord, mergeLedger, reconcileProviderReadbacks, syncPublicationLedger } from "./publication-ledger.mjs";

const identity = { id: "les-20261118", type: "lesson", language: "ru", sourceHash: "a".repeat(64) };
const episode = { experiment: { id: "lesson-opening-v1", arm: "A" }, hookExperiment: { id: "h-v2", formatId: "question" },
  storytelling: { pattern: "direct" }, motionDesignStyle: "explain-actions-v1",
  scenes: [{ id: "hook", kind: "hook", narration: "Попробуйте ответить." }, { id: "recap", kind: "example", narration: "Проверьте себя." }] };
const receipt = (over = {}) => ({ platform: "instagram", accountId: "acc1", accountName: "@hskai.app", zernioPostId: "6afbc4294a8ecfab59d2fdd2",
  platformPostId: null, status: "scheduled", approvalConfirmed: true, approvedAt: "2026-11-17T03:02:59.573Z", verifiedAt: "2026-11-17T03:04:11.249Z",
  contentIdentity: identity, videoSha256: "b".repeat(64), ctaExperimentId: "cta-v2", resultVerifiedBy: "Zernio GET /v1/posts/{id}", ...over });

function sandbox(platforms) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-"));
  const dir = path.join(root, "review", identity.id);
  fs.mkdirSync(path.join(root, "content", "feedback"), { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(root, "content", "experiments.json"), JSON.stringify({ experiments: [{ id: "lesson-opening-v1", arms: [{ id: "A", scriptBrief: "brief A" }] }] }));
  fs.writeFileSync(path.join(dir, "episode.json"), JSON.stringify(episode));
  fs.writeFileSync(path.join(dir, "publications.json"), JSON.stringify({ schemaVersion: 1, records: [{ platforms }] }));
  return root;
}

test("a verified receipt becomes a durable record with what was published and why", () => {
  const root = sandbox([receipt(), receipt({ platform: "tiktok", zernioPostId: "6afbc506660b23b40d686be9" }),
    receipt({ platform: "youtube", zernioPostId: "6afbc4ae86f07caca87ae669", approvalConfirmed: undefined })]);
  try {
    const result = syncPublicationLedger({ root, write: true });
    assert.equal(result.added.length, 2);
    assert.match(result.skipped[0].reason, /approval/u, "no recorded approval → skipped, never assumed");
    const [record] = JSON.parse(fs.readFileSync(path.join(root, "content/feedback/publications.json"), "utf8")).records;
    assert.equal(record.accountUsername, "hskai.app");
    assert.equal(record.platformPostId, null, "the native ID stays null until the provider returns it");
    assert.deepEqual([record.creative.experimentId, record.creative.arm, record.creative.hookText], ["lesson-opening-v1", "A", "Попробуйте ответить."]);
    assert.equal(record.creative.promptSha256.length, 64);
    assert.equal(syncPublicationLedger({ root, write: true }).written, false, "a second run changes nothing");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a post ID is never re-assigned; only its status and native ID are updated", () => {
  const mapping = { content: identity, platform: "instagram", accountId: "acc1", accountUsername: "hskai.app", zernioPostId: "6afbc4294a8ecfab59d2fdd2",
    platformPostId: null, status: "scheduled", videoSha256: "b".repeat(64), approvedVideoSha256: "b".repeat(64),
    approvedAt: "2026-11-17T03:00:00Z", verifiedAt: "2026-11-17T03:04:00Z", source: { provider: "Zernio", endpoint: "GET" } };
  assert.deepEqual(validatePublicationMapping(mapping), []);
  const { registry } = mergeLedger({ records: [] }, [mapping]);
  const updated = mergeLedger(registry, [{ ...mapping, status: "published", platformPostId: "18161263309505221" }]);
  assert.deepEqual([updated.registry.records[0].status, updated.registry.records[0].platformPostId], ["published", "18161263309505221"]);
  assert.throws(() => mergeLedger(registry, [{ ...mapping, videoSha256: "c".repeat(64), approvedVideoSha256: "c".repeat(64) }]), /different content or media/u);
  // An observation is joined by the Zernio post ID, never by date or title.
  const observation = { platform: "instagram", accountUsername: "hskai.app", platformPostId: "18161263309505221", zernioPostId: mapping.zernioPostId };
  assert.deepEqual(applyPublicationMappings([observation], registry.records)[0].content, identity);
  assert.equal(applyPublicationMappings([{ ...observation, zernioPostId: "other0000000" , platformPostId: "x123456" }], registry.records)[0].content, undefined);
});

test("the creative record leaves unknown fields null", () => {
  assert.deepEqual(creativeRecord({ scenes: [] }), { experimentId: null, arm: null, promptSha256: null, hookId: null, hookFormat: null,
    hookText: null, storytellingPattern: null, visualStyle: null, scriptSha256: null });
});

test("provider readback promotes only verified matching posts and replay is idempotent", () => {
  const mapping = { content: identity, platform: "instagram", accountId: "acc1", accountUsername: "hskai.app",
    zernioPostId: "6afbc4294a8ecfab59d2fdd2", platformPostId: null, status: "scheduled",
    videoSha256: "b".repeat(64), approvedVideoSha256: "b".repeat(64),
    approvedAt: "2026-11-17T03:00:00Z", verifiedAt: "2026-11-17T03:04:00Z",
    source: { provider: "Zernio", endpoint: "GET" } };
  const baseline = { schemaVersion: 1, records: [mapping] };
  const readback = { zernioPostId: mapping.zernioPostId, accountId: "acc1", platform: "instagram", status: "published",
    publishedAt: "2026-11-17T13:00:00Z", checkedAt: "2026-11-17T14:00:00Z",
    platformPostId: "18161263309505221", platformPostUrl: "https://www.instagram.com/reel/DFabc1234/",
    providerEndpoint: "analytics_get_analytics" };
  const r = reconcileProviderReadbacks(baseline, [readback]);
  assert.deepEqual(r.updated, [mapping.zernioPostId]);
  assert.equal(r.registry.records[0].content, mapping.content, "approved identity must not be replaced");
  assert.equal(r.registry.records[0].status, "published");
  assert.equal(r.registry.records[0].platformPostId, readback.platformPostId);
  assert.equal(reconcileProviderReadbacks(r.registry, [readback]).updated.length, 0, "same live readback is a no-op");
  const replay = mergeLedger(r.registry, [mapping]);
  assert.equal(replay.registry.records[0].status, "published", "old scheduled package must never downgrade a published post");
  assert.equal(replay.registry.records[0].platformPostId, readback.platformPostId);
  assert.equal(replay.registry.records[0].publishedAt, readback.publishedAt);
  assert.equal(replay.updated.length, 0);
  assert.throws(() => reconcileProviderReadbacks(baseline, [{...readback, accountId:"another"}]), /mismatch/);
  assert.throws(() => reconcileProviderReadbacks(r.registry, [{...readback, platformPostId:"another12345"}]), /conflict/);
  assert.throws(() => reconcileProviderReadbacks(baseline, [{...readback, platformPostUrl:"https://example.invalid/"}]), /URL/);
  assert.throws(() => reconcileProviderReadbacks(baseline, [{...readback, zernioPostId:"not-real"}]), /Unknown Zernio/);
});

test("scheduled provider response leaves ledger unchanged; native ID stays unknown when absent", () => {
  const mapping = { content: identity, platform: "youtube", accountId: "acc1", accountUsername: "hskai_app",
    zernioPostId: "6afbc4ae86f07caca87ae669", platformPostId: null, status: "scheduled",
    videoSha256: "b".repeat(64), approvedVideoSha256: "b".repeat(64),
    approvedAt: "2026-11-17T03:00:00Z", verifiedAt: "2026-11-17T03:04:00Z",
    source: { provider: "Zernio", endpoint: "GET" } };
  const base = { schemaVersion: 1, records: [mapping] };
  const pending = reconcileProviderReadbacks(base, [{zernioPostId:mapping.zernioPostId,accountId:"acc1",platform:"youtube",status:"scheduled"}]);
  assert.equal(pending.updated.length, 0);
  const live = reconcileProviderReadbacks(base, [{
    zernioPostId:mapping.zernioPostId,accountId:"acc1",platform:"youtube",status:"published",
    checkedAt:"2026-11-17T14:00:00Z", publishedAt:"2026-11-17T13:00:00Z",
    platformPostId:null,platformPostUrl:"https://www.youtube.com/watch?v=abc12345",
    providerEndpoint:"Zernio get_post",
  }]);
  assert.equal(live.registry.records[0].status,"published");
  assert.equal(live.registry.records[0].platformPostId,null,"never invent native IDs");
});
