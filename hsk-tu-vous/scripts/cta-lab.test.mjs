import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  readCtaLab,
  writeCtaLab,
  createCtaCorrection,
  currentCtaRuleVersion,
  getActiveCtaCorrections,
  createCtaExperiment,
  ctaExperimentMetadata,
  validateCtaEpisode,
  createCtaReadback,
  summarizeCtaLab,
  createCtaPromotion,
} from "./cta-lab.mjs";

const seed = await readCtaLab();
const fresh = () => ({
  ...structuredClone(seed),
  revision: 0,
  experiments: [],
  readbacks: [],
  promotions: [],
});
const episodeFor = (lab, id = "test-episode") => ({
  id,
  date: "2026-09-28",
  level: "HSK 1",
  topic: "greetings",
  voiceProfileId: "ru-dmitry-v1",
  hookExperiment: { formatId: "question" },
  cta: lab.offer.canonicalRussian,
  scenes: [
    {
      id: "cta",
      kind: "cta",
      narration: lab.offer.canonicalRussian,
      visualBeats: [
        { hero: "HSK AI", syncCueText: "Попробуй" },
        { hero: "ПРОФИЛЬ", screenImage: "cta/instagram-profile.png", syncCueText: "Зайди" },
        { hero: "ССЫЛКА", screenImage: "cta/instagram-links.png", syncCueText: "Открой" },
        { hero: "СКАЧАТЬ", screenImage: "cta/website-download.png", syncCueText: "скачай" },
      ],
    },
  ],
});
function register(lab, episode = episodeFor(lab), overrides = {}) {
  const record = createCtaExperiment({
    lab,
    episode,
    id: `${episode.id}-cta-v1`,
    hypothesis:
      "A single profile-to-website action should increase qualified link visits.",
    registeredAt: "2026-09-28T10:00:00Z",
    acknowledgedCorrectionIds: getActiveCtaCorrections(lab, {
      episodeId: episode.id,
      formatId: overrides.formatId ?? "benefit-profile-link-download",
    }).map((item) => item.id),
    ...overrides,
  });
  lab.experiments.push(record);
  episode.ctaExperiment = ctaExperimentMetadata(record);
  return { record, episode };
}
function readback(lab, record, overrides = {}) {
  return createCtaReadback({
    lab,
    experimentId: record.id,
    platform: "instagram",
    window: "24h",
    postReference: record.episodeId,
    publishedAt: "2026-09-29T10:00:00Z",
    capturedAt: "2026-09-30T10:00:00Z",
    views: 1000,
    profileLinkClickers: 10,
    videoDurationSeconds: 31.2,
    metricDefinition:
      "Platform views; unique viewers who opened the profile link.",
    ...overrides,
  });
}

test("owner corrections persist exactly; superseded history and scopes remain intact", async () => {
  const lab = fresh();
  const original = "  owner exact wording\nwith spelling  ";
  const replacedId = getActiveCtaCorrections(lab)[0].id;
  const correction = createCtaCorrection({
    lab,
    ownerWording: original,
    rule: "Use the new owner wording.",
    supersedes: [replacedId],
  });
  lab.corrections.push(correction);
  assert.equal(correction.ownerWording, original);
  assert.equal(lab.corrections[0].ruleVersion, "cta-policy-v1");
  assert(
      !getActiveCtaCorrections(lab).some(
      (entry) => entry.id === replacedId,
    ),
  );
  assert.equal(currentCtaRuleVersion(lab), correction.ruleVersion);
  assert.throws(
    () =>
      createCtaCorrection({
        lab,
        ownerWording: "x",
        rule: "y",
        scope: { type: "episode", episodeId: "test" },
        supersedes: [correction.id],
      }),
    /same scope/,
  );
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-cta-"));
  const file = path.join(folder, "cta-lab.json");
  try {
    await fs.writeFile(file, JSON.stringify(fresh()));
    const saved = await writeCtaLab(lab, file);
    assert.equal(saved.revision, 1);
    assert.equal(
      (await readCtaLab(file)).corrections.at(-1).ownerWording,
      original,
    );
    await assert.rejects(writeCtaLab(lab, file), /revision changed/);
    saved.corrections[0].ownerWording = "rewritten history";
    await assert.rejects(writeCtaLab(saved, file), /history is immutable/);
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
});

test("new rules and CTA edits invalidate registration without relabeling old metrics", () => {
  const lab = fresh();
  const { record, episode } = register(lab);
  assert.equal(validateCtaEpisode(episode, lab).valid, true);
  episode.scenes[0].visualBeats[0].hero = "NEW VISUAL";
  assert(
    validateCtaEpisode(episode, lab).errors.some((error) =>
      error.includes("changed after registration"),
    ),
  );
  episode.scenes[0].visualBeats[0].hero = "HSK AI";
  episode.scenes.unshift({
    id: "new-hook",
    kind: "hook",
    narration: "A different, but still same-topic opening.",
    headline: "A new opening",
  });
  assert(
    validateCtaEpisode(episode, lab).errors.some((error) =>
      error.includes("Episode context changed"),
    ),
  );
  const result = readback(lab, record);
  assert.equal(
    result.experimentSnapshot.copySnapshot.scenes[0].visualBeats[0].hero,
    "HSK AI",
  );
  lab.corrections.push(
    createCtaCorrection({
      lab,
      ownerWording: "Make HSK clearer",
      rule: "Use high contrast for HSK.",
    }),
  );
  assert(
    validateCtaEpisode(episode, lab).errors.some((error) =>
      error.includes("mandatory rule version"),
    ),
  );
  assert.equal(result.experimentSnapshot.ruleVersion, record.ruleVersion);
});

test("missing counts, explicit zero, and corrected snapshots stay distinct", () => {
  const lab = fresh();
  const { record } = register(lab);
  assert.equal(
    readback(lab, record, { profileLinkClickers: null }).primaryMetricValue,
    null,
  );
  assert.equal(
    readback(lab, record, { profileLinkClickers: 0 }).primaryMetricValue,
    0,
  );
  assert.equal(
    readback(lab, record, { views: 0, profileLinkClickers: 0 }).primaryMetricValue,
    null,
  );
  const first = readback(lab, record, { profileLinkClickers: 0, downloads: 0 });
  assert.equal(first.linkClicks, null);
  assert.equal(first.downloads, 0);
  lab.readbacks.push(first);
  assert.throws(() => readback(lab, record), /snapshot.*exists/);
  const corrected = readback(lab, record, {
    profileLinkClickers: 4,
    supersedes: first.id,
  });
  lab.readbacks.push(corrected);
  const summary = summarizeCtaLab(lab);
  assert.equal(summary.recordedSnapshots, 2);
  assert.equal(summary.activeSnapshots, 1);
  assert.equal(summary.recentReadbacks[0].primaryMetricValue, 4);
  assert.equal(lab.readbacks[0].profileLinkClickers, 0);
});

test("published post cannot be relabeled and registration must precede publishing", () => {
  const lab = fresh();
  const first = register(lab).record;
  lab.readbacks.push(readback(lab, first));
  const second = register(lab, episodeFor(lab), {
    id: "test-episode-cta-v2",
    supersedes: first.id,
  }).record;
  assert.throws(
    () => readback(lab, second, { window: "7d" }),
    /different CTA version/,
  );
  assert.throws(
    () => readback(lab, first, { publishedAt: "2026-09-27T10:00:00Z" }),
    /after publication/,
  );
  const wrong = episodeFor(lab);
  wrong.cta = "Сохрани видео. Напиши HSK AI в комментариях.";
  const validation = validateCtaEpisode(wrong, lab, {
    requireRegistration: false,
  });
  assert(
    validation.errors.some((message) =>
      message.includes("direct viewers to the profile"),
    ),
  );
  assert(validation.errors.some((message) => message.includes("competing")));
});

test("only matched evidence can suggest a candidate; promotion needs an owner decision", () => {
  const lab = fresh();
  for (let index = 0; index < 6; index++) {
    const baseline = index < 3;
    const episode = episodeFor(lab, `post-${index}`);
    episode.scenes.unshift({
      id: `hook-${index}`,
      kind: "hook",
      narration: `A distinct greeting hook ${index}.`,
      headline: `Greeting ${index}`,
    });
    if (!baseline) {
      episode.cta = episode.cta.replace(
        "Хочешь учить китайский просто и легко?",
        "Хочешь легко и просто учить китайский?",
      );
      episode.scenes[0].narration = episode.cta;
    }
    const record = register(
      lab,
      episode,
      baseline ? {} : { formatId: "benefit-short", changedVariable: "wording" },
    ).record;
    lab.readbacks.push(
      readback(lab, record, { profileLinkClickers: baseline ? 10 : 13 }),
    );
  }
  const comparison = summarizeCtaLab(lab).comparisons[0];
  assert.equal(comparison.decision, "eligible-for-owner-review");
  assert.equal(comparison.baselinePosts, 3);
  assert.equal(comparison.candidatePosts, 3);
  assert.equal(comparison.downstream.downloads.status, "unknown");
  const input = {
    lab,
    candidateFormatId: "benefit-short",
    changedVariable: "wording",
    evidenceReadbackIds: comparison.evidenceReadbackIds,
    ownerWording: "Use this pattern.",
    approvedAt: "2026-10-01T10:00:00Z",
  };
  assert.throws(() => createCtaPromotion(input), /owner's explicit/);
  assert.equal(
    createCtaPromotion({ ...input, ownerConfirmed: true }).approvedBy,
    "owner",
  );
  assert.throws(
    () =>
      createCtaPromotion({
        ...input,
        ownerConfirmed: true,
        approvedAt: "2026-09-28T10:00:00Z",
      }),
    /predate/,
  );
  lab.readbacks.at(-1).platform = "youtube";
  assert(
    summarizeCtaLab(lab).comparisons.every(
      (item) => item.decision === "keep-testing",
    ),
  );
});
