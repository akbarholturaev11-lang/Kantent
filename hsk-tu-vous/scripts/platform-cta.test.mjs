import test from "node:test";
import assert from "node:assert/strict";
import { getActiveCtaCorrections, readCtaLab } from "./cta-lab.mjs";
import { withLanguage } from "./language-context.mjs";
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

test("four video platform entries expose safe CTA states", () => {
  assert.deepEqual(CTA_PLATFORMS, ["instagram", "youtube", "tiktok", "facebook"]);
  assert.deepEqual(validatePlatformCtaConfig(lab), []);
  assert.equal(getPlatformCtaStatus(lab, "instagram").readyForRendering, true);
  const tiktok = getPlatformCtaStatus(lab, "tiktok");
  assert.equal(tiktok.status, "approved");
  assert.equal(tiktok.readyForDraft, true, "Owner-approved manual-DM CTA may be previewed locally");
  assert.equal(tiktok.readyForRendering, true, "Owner authorization permits a language-specific TikTok CTA render");
  assert.equal(tiktok.copy, lab.platformVariants.tiktok.canonicalRussian);
  assert.equal(tiktok.deliveryMode, "manual-dm");
  assert.deepEqual(tiktok.missing, []);
  assert.equal(tiktok.publishingAuthorized, true);
  const youtube = getPlatformCtaStatus(lab, "youtube");
  assert.equal(youtube.status, "approved");
  assert.equal(youtube.readyForDraft, true);
  assert.equal(youtube.readyForRendering, true);
  assert.equal(youtube.copy, lab.offer.canonicalRussian);
  assert.equal(youtube.copySource, "content/cta-lab.json#offer.canonicalRussian");
  assert.equal(youtube.publishingAuthorized, true);
  const facebook = getPlatformCtaStatus(lab, "facebook");
  assert.equal(facebook.status, "approved");
  assert.equal(facebook.readyForRendering, true);
  assert.equal(facebook.copy, lab.offer.canonicalRussian);
  assert.equal(facebook.publishingAuthorized, true);
});

test("Tajik TikTok uses only its translated CTA source and the current rule chain", async () => {
  const tajikLab = await withLanguage("tg", () => readCtaLab());
  const state = getPlatformCtaStatus(tajikLab, "tiktok");
  assert.equal(
    state.copy,
    "HSK AI-ро санҷ. Ба профили ман даро ва дар паёми хусусӣ «HSK» навис — ман пайванди боргирии HSK AI-ро дастӣ мефиристам.",
  );
  assert.notEqual(state.copy, getPlatformCtaStatus(lab, "tiktok").copy);
  assert.equal(
    state.copySource,
    "content/locales/tg/cta-lab.json#platformVariants.tiktok.canonicalRussian",
  );
  assert.equal(state.readyForRendering, true);
  const activeIds = new Set(
    getActiveCtaCorrections(lab, { formatId: "tiktok-manual-dm" })
      .map(({ id }) => id),
  );
  assert.equal(activeIds.has("cta-correction-0012"), false);
  assert.equal(activeIds.has("cta-correction-0013"), false);
  assert.equal(activeIds.has("cta-correction-0014"), false);
  assert.equal(activeIds.has("cta-correction-0015"), true);
  assert.equal(activeIds.has("cta-correction-0016"), true);
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

test("approved TikTok preview uses its own spoken CTA and remains behind the exact publication gate", () => {
  const draft = preparePlatformCtaDraft(baseEpisode, lab, "tiktok");
  assert.equal(draft.ctaPlatform, "tiktok");
  assert.equal(draft.cta, lab.platformVariants.tiktok.canonicalRussian);
  assert.notEqual(draft.cta, lab.offer.canonicalRussian);
  assert.deepEqual(draft.scenes.at(-1).visualBeats, lab.platformVariants.tiktok.sceneTemplate.visualBeats);
  assert.equal(draft.audioSrc, undefined, "Different TikTok narration must invalidate earlier voice");
  assert.equal(draft.voiceTextHash, undefined);
  assert.equal(draft.captionSource, "pending-gemini-generation");
  assert.equal(draft.ctaExperiment, undefined, "TikTok requires a distinct CTA version");
  assert.equal(draft.publishingStatus, "pending-owner-review");
  assert.equal(getPlatformCtaStatus(lab, "tiktok").publishingAuthorized, true);
  assert.equal(baseEpisode.cta, lab.offer.canonicalRussian, "Source remains unchanged");
});

test("YouTube reuses Instagram copy and changes only the two supplied screenshot frames", () => {
  const state = getPlatformCtaStatus(lab, "youtube");
  const instagram = lab.platformVariants.instagram.sceneTemplate;
  const youtube = lab.platformVariants.youtube.sceneTemplate;
  assert.equal(state.copy, lab.offer.canonicalRussian);
  assert.equal(lab.platformVariants.youtube.canonicalRussian, undefined);
  assert.equal(youtube.headline, instagram.headline);
  assert.equal(youtube.screenCaption, instagram.screenCaption);
  assert.equal(youtube.durationSec, instagram.durationSec);
  assert.deepEqual(youtube.visualBeats[0], instagram.visualBeats[0]);
  assert.deepEqual(youtube.visualBeats[3], instagram.visualBeats[3]);
  for (const index of [1, 2]) {
    const omitFrame = ({ screenImage, screenImageWidthPx, screenImageHeightPx, screenHighlight, ...rest }) => rest;
    assert.deepEqual(omitFrame(youtube.visualBeats[index]), omitFrame(instagram.visualBeats[index]));
  }
  assert.equal(youtube.visualBeats[1].screenImage, "cta/youtube-telegram-profile.jpg");
  assert.equal(youtube.visualBeats[2].screenImage, "cta/youtube-open-link-browser.jpg");
  const draft = preparePlatformCtaDraft(baseEpisode, lab, "youtube");
  assert.equal(draft.cta, lab.offer.canonicalRussian);
  assert.equal(draft.ctaPlatform, "youtube");
  assert.equal(draft.scenes.find((scene) => scene.kind === "cta").narration, lab.offer.canonicalRussian);
  assert.equal(draft.audioSrc, baseEpisode.audioSrc);
  assert.equal(draft.voiceTextHash, baseEpisode.voiceTextHash);
  assert.deepEqual(draft.captions, baseEpisode.captions);
  assert.equal(draft.scenes[0].durationFrames, baseEpisode.scenes[0].durationFrames);
  assert.equal(draft.ctaExperiment, undefined);
  assert.equal(draft.publishingStatus, "pending-owner-review");
});

test("Facebook reuses the language offer with a separate cue-synced no-UI ending", () => {
  const draft = preparePlatformCtaDraft(baseEpisode, lab, "facebook");
  const scene = draft.scenes.find((item) => item.kind === "cta");
  assert.equal(draft.cta, lab.offer.canonicalRussian);
  assert.equal(draft.ctaPlatform, "facebook");
  assert.equal(scene.narration, lab.offer.canonicalRussian);
  assert.ok(scene.visualBeats.length > 0);
  assert.ok(scene.visualBeats.every((beat) => beat.syncCueText));
  assert.ok(scene.visualBeats.every((beat) => !beat.screenImage));
  assert.equal(draft.audioSrc, baseEpisode.audioSrc);
  assert.deepEqual(draft.captions, baseEpisode.captions);
  assert.equal(draft.ctaExperiment, undefined, "Facebook needs its own exact CTA registration");
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
  assert.equal(cloned.captionSource, "pending-gemini-generation");
  assert.equal(cloned.publishingStatus, "pending-owner-review");
  assert.equal(cloned.scenes[0].durationFrames, undefined);
});

test("a platform CTA wording change invalidates shared speech and word timings", () => {
  const staged = structuredClone(lab);
  Object.assign(staged.platformVariants.youtube, {
    copySource: "platform",
    canonicalRussian: "Попробуй HSK AI. Зайди в канал, открой описание и скачай приложение с сайта.",
  });
  const draft = preparePlatformCtaDraft(baseEpisode, staged, "youtube");
  assert.equal(draft.audioSrc, undefined);
  assert.equal(draft.voiceTextHash, undefined);
  assert.equal(draft.captions, undefined);
  assert.equal(draft.captionSource, "pending-gemini-generation");
});

test("approved YouTube CTA can render with matching speech artifacts", () => {
  const staged = structuredClone(lab);
  Object.assign(staged.platformVariants.youtube, {
    status: "approved",
    copySource: "platform",
    deliveryMode: "channel-profile-link",
    canonicalRussian: "Тестовый утверждённый YouTube текст",
    headline: "YouTube CTA",
    screenCaption: "Канал",
    editPlan: "Show validated YouTube link path.",
    visualBeats: [{ hero: "Открой канал" }],
  });
  assert.equal(getPlatformCtaStatus(staged, "youtube").readyForDraft, true);
  assert.equal(getPlatformCtaStatus(staged, "youtube").readyForRendering, true);
  assert.equal(getPlatformCtaStatus(staged, "youtube").publishingAuthorized, true);
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
  bad.platformVariants.youtube.sceneTemplate = null;
  assert.ok(validatePlatformCtaConfig(bad).length > 0);
});
