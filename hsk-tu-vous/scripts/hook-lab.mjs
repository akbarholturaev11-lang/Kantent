import { PROJECT_ROOT, readJson } from "./lib.mjs";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

export const HOOK_LAB_PATH = path.join(
  PROJECT_ROOT,
  "content",
  "hook-lab.json",
);

export async function readHookLab(filePath = HOOK_LAB_PATH) {
  const lab = await readJson(filePath);
  lab.ownerCorrections ??= [];
  lab.revision ??= 0;
  return lab;
}

export async function writeHookLab(lab, filePath = HOOK_LAB_PATH) {
  if (!Number.isSafeInteger(lab.revision) || lab.revision < 0)
    throw new Error("Unsupported Hook Lab revision.");
  const lockPath = `${filePath}.lock`;
  let lock;
  try {
    lock = await fs.open(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error("Hook Lab is being updated. Read the latest state and retry; do not remove its lock during a write.");
    throw error;
  }
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    const previous = await readHookLab(filePath);
    if (previous.revision !== lab.revision)
      throw new Error("Hook Lab revision changed. Read the latest state and retry.");
    const oldCorrections = previous.ownerCorrections ?? [];
    const nextCorrections = lab.ownerCorrections ?? [];
    if (
      nextCorrections.length < oldCorrections.length ||
      oldCorrections.some(
        (entry, index) => JSON.stringify(entry) !== JSON.stringify(nextCorrections[index]),
      )
    )
      throw new Error("Hook correction history is immutable; append a superseding rule.");
    const saved = { ...lab, ownerCorrections: nextCorrections, revision: lab.revision + 1 };
    await fs.writeFile(temporary, `${JSON.stringify(saved, null, 2)}\n`, "utf8");
    await fs.rename(temporary, filePath);
    return saved;
  } finally {
    await fs.rm(temporary, { force: true });
    await lock.close();
    await fs.rm(lockPath, { force: true });
  }
}

export function getActiveHookCorrections(lab) {
  const corrections = lab.ownerCorrections ?? [];
  const superseded = new Set(corrections.flatMap((item) => item.supersedes ?? []));
  return corrections
    .filter((item) => !superseded.has(item.id))
    .map((item) => ({ ...item, status: "active" }));
}

export function createHookCorrection({
  lab,
  ownerWording,
  rule,
  supersedes = [],
  createdAt = new Date().toISOString(),
}) {
  const clean = (value) => String(value ?? "").normalize("NFKC").trim();
  ownerWording = clean(ownerWording);
  rule = clean(rule);
  if (!ownerWording || !rule) throw new Error("Hook correction wording and rule are required.");
  const corrections = lab.ownerCorrections ?? [];
  const active = getActiveHookCorrections(lab);
  for (const id of supersedes) {
    if (!active.some((item) => item.id === id))
      throw new Error(`Cannot replace ${id}: the correction is not active.`);
  }
  return {
    id: `hook-correction-${String(corrections.length + 1).padStart(4, "0")}`,
    createdAt: new Date(createdAt).toISOString(),
    source: "owner-correction",
    scope: { type: "series" },
    ownerWording,
    rule,
    supersedes: [...supersedes],
  };
}

const median = (values) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
};

const round = (value) => Math.round(value * 10) / 10;

export function createHookReadback({
  episode,
  level,
  topic,
  platform,
  window,
  publishedAt,
  capturedAt,
  primaryMetric,
  views,
  viewsAt3Seconds,
  averageViewDurationSeconds,
  choseToViewRatePercent,
  shownInFeed,
  completedViews,
  saves,
  shares,
  comments,
  likes,
  followersGained,
  metricDefinition,
}) {
  const durationSeconds =
    episode.scenes.reduce(
      (sum, scene) => sum + (scene.durationFrames ?? scene.durationSec * 30),
      0,
    ) / 30;
  const primaryValue =
    primaryMetric === "three-second-hold-rate"
      ? (viewsAt3Seconds / views) * 100
      : primaryMetric === "chose-to-view-rate"
        ? choseToViewRatePercent
        : (averageViewDurationSeconds / durationSeconds) * 100;
  const roundedDuration = round(durationSeconds);

  const perThousand = (value) =>
    value === undefined ? null : round((value / views) * 1000);

  return {
    episodeId: episode.id,
    date: episode.date,
    hookExperimentId: episode.hookExperiment.id,
    hookFormatId: episode.hookExperiment.formatId,
    hookHypothesis: episode.hookExperiment.hypothesis,
    level,
    topic,
    platform,
    window,
    publishedAt,
    capturedAt,
    primaryMetric,
    primaryMetricValue: round(primaryValue),
    metricDefinition,
    videoDurationSeconds: roundedDuration,
    durationBand: roundedDuration < 30 ? "25-29s" : "30-35s",
    views,
    viewsAt3Seconds: viewsAt3Seconds ?? null,
    averageViewDurationSeconds: averageViewDurationSeconds ?? null,
    choseToViewRatePercent: choseToViewRatePercent ?? null,
    shownInFeed: shownInFeed ?? null,
    completedViews: completedViews ?? null,
    completionRatePercent:
      completedViews === undefined
        ? null
        : round((completedViews / views) * 100),
    saves: saves ?? null,
    savesPer1000Views: perThousand(saves),
    shares: shares ?? null,
    sharesPer1000Views: perThousand(shares),
    comments: comments ?? null,
    commentsPer1000Views: perThousand(comments),
    likes: likes ?? null,
    followersGained: followersGained ?? null,
    source: "owner-entered-platform-analytics",
  };
}

export function summarizeHookLab(lab, experiments) {
  const rules = lab.policy;
  const formatSummaries = lab.formats.map((format) => {
    const assigned = experiments.filter(
      (experiment) => experiment.formatId === format.id,
    );
    const records = lab.readbacks.filter(
      (entry) => entry.hookFormatId === format.id,
    );
    const eligible = records.filter(
      (entry) => entry.views >= rules.minimumViewsPerPost,
    );
    return {
      ...format,
      registeredEpisodes: assigned.length,
      recordedSnapshots: records.length,
      eligiblePosts: new Set(eligible.map((entry) => entry.episodeId)).size,
      status: records.length ? "measured" : "unmeasured",
    };
  });

  const cohortKeys = new Set(
    lab.readbacks.map((entry) =>
      [
        entry.platform,
        entry.window,
        entry.primaryMetric,
        entry.level,
        entry.durationBand,
      ].join("|"),
    ),
  );
  const comparisons = [];

  for (const cohortKey of cohortKeys) {
    const [platform, window, primaryMetric, level, durationBand] =
      cohortKey.split("|");
    const cohort = lab.readbacks.filter(
      (entry) =>
        entry.platform === platform &&
        entry.window === window &&
        entry.primaryMetric === primaryMetric &&
        entry.level === level &&
        entry.durationBand === durationBand &&
        entry.views >= rules.minimumViewsPerPost,
    );
    const baseline = cohort.filter(
      (entry) => entry.hookFormatId === lab.baselineFormatId,
    );
    const baselinePosts = new Set(baseline.map((entry) => entry.episodeId))
      .size;
    for (const format of lab.formats) {
      if (format.id === lab.baselineFormatId) continue;
      const candidate = cohort.filter(
        (entry) => entry.hookFormatId === format.id,
      );
      const candidatePosts = new Set(candidate.map((entry) => entry.episodeId))
        .size;
      if (!candidate.length && !baseline.length) continue;

      const comparison = {
        platform,
        window,
        primaryMetric,
        level,
        durationBand,
        topicsCompared: [...new Set(cohort.map((entry) => entry.topic))],
        baselineFormatId: lab.baselineFormatId,
        candidateFormatId: format.id,
        baselinePosts,
        candidatePosts,
        decision: "keep-testing",
      };

      if (
        baselinePosts < rules.minimumPostsPerFormat ||
        candidatePosts < rules.minimumPostsPerFormat
      ) {
        comparison.reason = "Not enough comparable posts for either group.";
        comparisons.push(comparison);
        continue;
      }

      const baselineMedian = median(
        baseline.map((entry) => entry.primaryMetricValue),
      );
      const candidateMedian = median(
        candidate.map((entry) => entry.primaryMetricValue),
      );
      if (baselineMedian <= 0) {
        comparison.reason =
          "Baseline median is zero; relative lift is undefined.";
        comparisons.push(comparison);
        continue;
      }
      const liftPercent = round(
        ((candidateMedian - baselineMedian) / baselineMedian) * 100,
      );
      comparison.baselineMedian = round(baselineMedian);
      comparison.candidateMedian = round(candidateMedian);
      comparison.relativeLiftPercent = liftPercent;

      const secondaryFields = ["savesPer1000Views", "sharesPer1000Views"];
      const hasSecondary = secondaryFields.every((field) =>
        [...baseline, ...candidate].every((entry) => entry[field] !== null),
      );
      if (!hasSecondary) {
        comparison.reason =
          "Primary result is available, but save/share guardrails are missing.";
        comparisons.push(comparison);
        continue;
      }
      const baselineIntent = median(
        baseline.map(
          (entry) => entry.savesPer1000Views + entry.sharesPer1000Views,
        ),
      );
      const candidateIntent = median(
        candidate.map(
          (entry) => entry.savesPer1000Views + entry.sharesPer1000Views,
        ),
      );
      comparison.secondaryIntentLiftPercent =
        baselineIntent > 0
          ? round(((candidateIntent - baselineIntent) / baselineIntent) * 100)
          : null;
      if (liftPercent < rules.minimumRelativeLiftPercent) {
        comparison.reason =
          "Candidate did not reach the initial primary-metric lift threshold.";
      } else if (
        comparison.secondaryIntentLiftPercent === null ||
        comparison.secondaryIntentLiftPercent <
          -rules.maximumSecondaryIntentDropPercent
      ) {
        comparison.reason =
          "Save/share guardrail is missing or fell beyond the allowed threshold.";
      } else {
        comparison.decision = "eligible-for-owner-promotion";
        comparison.reason =
          "Initial thresholds met; owner review is still required.";
      }
      comparisons.push(comparison);
    }
  }

  return {
    status: lab.readbacks.length ? "measured" : "unmeasured",
    platformAnalyticsConnected: false,
    note: "Zernio may be used for owner-confirmed Instagram/TikTok publishing. Readbacks are entered by the owner from platform dashboards; no analytics API is called.",
    baselineFormatId: lab.baselineFormatId,
    policy: rules,
    activeOwnerCorrections: getActiveHookCorrections(lab),
    correctionHistoryCount: (lab.ownerCorrections ?? []).length,
    formats: formatSummaries,
    comparisons,
    recentReadbacks: lab.readbacks.slice(-12),
    nextAction: lab.readbacks.length
      ? "Use the same platform, 24h/7d window, primary metric, HSK level, and duration band; gather missing comparable samples. Topic differences remain a possible confounder."
      : "After an approved video is published, enter its 24h and 7d dashboard metrics with record_hook_analytics.",
  };
}
