import test from "node:test";
import assert from "node:assert/strict";
import { readCtaLab } from "./cta-lab.mjs";
import {
  CTA_PLATFORMS,
  getPlatformCtaStatus,
  preparePlatformCtaDraft,
  validatePlatformCtaConfig,
} from "./platform-cta.mjs";

const lab = await readCtaLab();
const baseEpisode = {
  id: "test-cta-episode",
  cta: lab.offer.canonicalRussian,
  scenes: [
    { id: "hook", kind: "hook", narration: "Начнём урок.", durationFrames: 90 },
    {
      id: "cta",
      kind: "cta",
      narration: lab.offer.canonicalRussian,
      headline: "Approved HSK AI CTA",
      visualBeats: [{ hero: "ПРОФИЛЬ", syncCueText: "Зайди" }],
    },
  ],
  audioSrc: "generated/voice.mp3",
  voiceTextHash: "old-script-hash",
  captions: [{ text: "Попробуй", startMs: 0, endMs: 100 }],
  ctaExperiment: { id: "immutable-instagram-record" },
  publishingStatus: "owner-approved-for-zernio-publishing",
};

test("exactly three platform entries have safe states", () => {
  assert.deepEqual(CTA_PLATFORMS, ["instagram", "tiktok", "youtube"]);
  assert.deepEqual(validatePlatformCtaConfig(lab), []);
  assert.equal(getPlatformCtaStatus(lab, "instagram").readyForRendering, true);
  for (const platform of ["tiktok", "youtube"]) {
    const state = getPlatformCtaStatus(lab, platform);
    assert.equal(state.status, "pending-owner-configuration");
    assert.equal(state.readyForDraft, false);
    assert.equal(state.readyForRendering, false);
    assert.equal(state.copy, null);
    assert.ok(state.missing.length > 0);
  }
  assert.equal(getPlatformCtaStatus(lab, "youtube").publishingAuthorized, false);
});

test("Instagram CTA copy is centrally read from offer and not duplicated", () => {
  const state = getPlatformCtaStatus(lab, "instagram");
  assert.equal(state.copy, lab.offer.canonicalRussian);
  assert.equal(state.copySource, "content/cta-lab.json#offer.canonicalRussian");
  assert.equal(lab.platformVariants.instagram.canonicalRussian, undefined);
  const retained = preparePlatformCtaDraft(baseEpisode, lab, "instagram");
  assert.deepEqual(retained, baseEpisode);
  assert.notEqual(retained, baseEpisode);
});

test("pending TikTok or YouTube can never silently inherit Instagram copy", () => {
  for (const platform of ["tiktok", "youtube"]) {
    assert.throws(
      () => preparePlatformCtaDraft(baseEpisode, lab, platform),
      /CTA is not ready/,
    );
  }
});

test("TikTok keyword auto-DM requires actual verification before approval", () => {
  const staged = structuredClone(lab);
  staged.platformVariants.tiktok = {
    ...staged.platformVariants.tiktok,
    status: "approved",
    deliveryMode: "keyword-dm",
    canonicalRussian: "Тестовый утверждённый текст",
    headline: "TikTok CTA",
    screenCaption: "TikTok",
    editPlan: "Show a correct direct-message action.",
    visualBeats: [{ hero: "HSK" }],
  };
  assert.ok(validatePlatformCtaConfig(staged).some((e) => e.includes("keyword DM")));
  assert.throws(
    () => getPlatformCtaStatus(staged, "tiktok"),
    /keyword DM cannot be approved/,
  );
  staged.platformVariants.tiktok.automationVerified = true;
  assert.deepEqual(validatePlatformCtaConfig(staged), []);
  const cloned = preparePlatformCtaDraft(baseEpisode, staged, "tiktok");
  assert.equal(cloned.cta, "Тестовый утверждённый текст");
  assert.equal(cloned.scenes.find((s) => s.kind === "cta").narration, cloned.cta);
  assert.equal(cloned.scenes[0].narration, baseEpisode.scenes[0].narration);
  assert.equal(baseEpisode.cta, lab.offer.canonicalRussian);
  assert.equal(cloned.ctaExperiment, undefined);
  assert.equal(cloned.audioSrc, undefined);
  assert.equal(cloned.voiceTextHash, undefined);
  assert.equal(cloned.captions, undefined);
  assert.equal(cloned.captionSource, "pending-tts-export");
  assert.equal(cloned.publishingStatus, "pending-owner-review");
  assert.equal(cloned.scenes[0].durationFrames, undefined);
});

test("YouTube publication remains blocked even for an eventually approved CTA", () => {
  const staged = structuredClone(lab);
  Object.assign(staged.platformVariants.youtube, {
    status: "approved",
    deliveryMode: "channel-profile-link",
    canonicalRussian: "Тестовый утверждённый YouTube текст",
    headline: "YouTube CTA",
    screenCaption: "Канал",
    editPlan: "Show validated YouTube link path.",
    visualBeats: [{ hero: "Открой канал" }],
  });
  assert.equal(getPlatformCtaStatus(staged, "youtube").readyForDraft, true);
  assert.equal(getPlatformCtaStatus(staged, "youtube").readyForRendering, false);
  assert.equal(getPlatformCtaStatus(staged, "youtube").publishingAuthorized, false);
  const draft = preparePlatformCtaDraft(baseEpisode, staged, "youtube");
  assert.equal(draft.cta, staged.platformVariants.youtube.canonicalRussian);
});

test("changing the Instagram offer without re-registering does not silently reuse old snapshot", () => {
  const altered = structuredClone(lab);
  altered.offer.canonicalRussian = "Other wording";
  assert.throws(
    () => preparePlatformCtaDraft(baseEpisode, altered, "instagram"),
    /Register a new version/,
  );
});

test("unknown platform and incompletely approved variants fail closed", () => {
  assert.throws(() => getPlatformCtaStatus(lab, "telegram"), /Unsupported/);
  const bad = structuredClone(lab);
  bad.platformVariants.youtube.status = "approved";
  assert.ok(validatePlatformCtaConfig(bad).length > 0);
});
