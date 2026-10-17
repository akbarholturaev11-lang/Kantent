import fs from "node:fs/promises";
import path from "node:path";
import { assertNotPreviouslyPublished } from "./published-evidence.mjs";
import { requireFreshGitMain } from "./git-freshness.mjs";
import {
  createCtaExperiment,
  ctaExperimentMetadata,
  getActiveCtaCorrections,
  readCtaLab,
  validateCtaEpisode,
  writeCtaLab,
} from "./cta-lab.mjs";
import { getPlatformCtaStatus, preparePlatformCtaDraft } from "./platform-cta.mjs";
import {
  readJson,
  reviewDir,
  writeJson,
} from "./lib.mjs";

const id = process.argv[2];
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id ?? "")) {
  throw new Error("Foydalanish: node scripts/prepare-tiktok-review.mjs <episode-ID>");
}
const sourceRevision = requireFreshGitMain();
assertNotPreviouslyPublished(id);
const basePath = path.join(reviewDir(id), "episode.json");
const base = await readJson(basePath);
const folder = path.join(reviewDir(id), "tiktok");
const episodePath = path.join(folder, "episode.json");
const lab = await readCtaLab();
const status = getPlatformCtaStatus(lab, "tiktok");
if (!status.readyForDraft) {
  throw new Error(`TikTok CTA is not ready: ${status.missing.join(", ")}.`);
}

try {
  const saved = await readJson(episodePath);
  const validation = validateCtaEpisode(saved, lab);
  if (!validation.valid) {
    throw new Error(`Existing TikTok review package is stale:\n${validation.errors.join("\n")}`);
  }
  console.log(`TikTok review draft already exists: ${episodePath}`);
  process.exit(0);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const episode = preparePlatformCtaDraft(base, lab, "tiktok");
const active = getActiveCtaCorrections(lab, {
  episodeId: episode.id,
  formatId: "tiktok-manual-dm",
});
let version = 1;
while (lab.experiments.some((entry) => entry.id === `${id}-tiktok-cta-v${version}`)) {
  version += 1;
}
const registration = createCtaExperiment({
  lab,
  episode,
  id: `${id}-tiktok-cta-v${version}`,
  formatId: "tiktok-manual-dm",
  comparisonGroupId: "tiktok-profile-manual-dm-v1",
  keyword: "HSK",
  hypothesis: "Bind the owner-approved TikTok manual-DM CTA and cue-synced kinetic typography to this reviewed lesson; performance remains unmeasured.",
  changedVariable: "baseline",
  acknowledgedCorrectionIds: active.map((item) => item.id),
});
lab.experiments.push(registration);
const savedLab = await writeCtaLab(lab);
episode.ctaExperiment = ctaExperimentMetadata(registration);
const validation = validateCtaEpisode(episode, savedLab);
if (!validation.valid) {
  throw new Error(`TikTok CTA registration failed validation:\n${validation.errors.join("\n")}`);
}
await fs.mkdir(folder, { recursive: true });
await writeJson(episodePath, episode);
await writeJson(path.join(folder, "status.json"), {
  stage: "tiktok-review-prepared",
  updatedAt: new Date().toISOString(),
  sourceRevision,
  ctaExperimentId: registration.id,
  ctaRuleVersion: registration.ruleVersion,
  publicationAuthorized: false,
});
console.log(`TikTok review draft prepared: ${episodePath}`);
console.log(`CTA registration: ${registration.id} (CTA Lab revision ${savedLab.revision}).`);
console.log(`Local review only; TikTok publishing authorized: ${status.publishingAuthorized}.`);
