import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { validatePlatformCtaConfig } from "./platform-cta.mjs";
import { languageSettings, activeLanguage, ctaSourceHash } from "./language-context.mjs";

export const CTA_LAB_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../content/cta-lab.json",
);
export const CTA_PRIMARY_METRIC = "profile-link-clickers-per-1000-views";
const LEGACY_CTA_PRIMARY_METRIC = "hsk-commenters-per-1000-views";

const clone = (value) => JSON.parse(JSON.stringify(value));
const stable = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
const digest = (value) =>
  createHash("sha256").update(stable(value)).digest("hex");
const clean = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim();
const required = (value, field) => {
  if (!clean(value)) throw new Error(`${field} is required.`);
  return clean(value);
};
const identifier = (value, field) => {
  required(value, field);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value))
    throw new Error(
      `${field} must use lowercase letters, numbers, and hyphens.`,
    );
  return value;
};
const timestamp = (value, field) => {
  required(value, field);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error(`${field} must be an ISO date-time with timezone.`);
  if (!/(Z|[+-]\d{2}:\d{2})$/u.test(value))
    throw new Error(`${field} needs a timezone.`);
  return new Date(value).toISOString();
};
const count = (value, name, { optional = false } = {}) => {
  if (value === undefined || value === null) {
    if (optional) return null;
    throw new Error(`${name} is required; missing is not zero.`);
  }
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${name} must be a nonnegative integer.`);
  return value;
};
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
const rounded = (value) =>
  value === null ? null : Math.round(value * 1000) / 1000;
const nextId = (prefix, records) =>
  `${prefix}-${String(records.length + 1).padStart(4, "0")}`;
const assertUnique = (records, name) => {
  if (
    !Array.isArray(records) ||
    records.some((item) => !item.id) ||
    new Set(records.map((item) => item.id)).size !== records.length
  )
    throw new Error(`${name} must be an array with unique immutable IDs.`);
};

export function currentCtaRuleVersion(lab) {
  return `cta-policy-v${lab.corrections.length}`;
}

export function getActiveCtaCorrections(lab, { episodeId, formatId } = {}) {
  const superseded = new Set(
    lab.corrections.flatMap((item) => item.supersedes ?? []),
  );
  return lab.corrections
    .filter(
      (item) =>
        !superseded.has(item.id) &&
        (item.scope.type === "series" ||
          (item.scope.type === "episode" &&
            item.scope.episodeId === episodeId) ||
          (item.scope.type === "format" && item.scope.formatId === formatId)),
    )
    .map((item) => ({ ...clone(item), status: "active" }));
}

function validateLab(lab) {
  const platformErrors = validatePlatformCtaConfig(lab);
  if (platformErrors.length) throw new Error("Invalid platform CTA configuration: " + platformErrors.join("; "));
  if (
    lab.version !== 1 ||
    !Number.isSafeInteger(lab.revision) ||
    lab.revision < 0
  )
    throw new Error("Unsupported CTA lab version/revision.");
  for (const field of ["corrections", "experiments", "readbacks", "promotions"])
    assertUnique(lab[field], field);
  const seen = new Map();
  for (const correction of lab.corrections) {
    if (correction.ruleVersion !== `cta-policy-v${seen.size + 1}`)
      throw new Error("CTA correction versions must be sequential.");
    for (const id of correction.supersedes ?? []) {
      if (!seen.has(id))
        throw new Error(
          `Correction ${id} cannot supersede a missing or future record.`,
        );
      if (stable(seen.get(id).scope) !== stable(correction.scope))
        throw new Error("A replacement correction must have the same scope.");
    }
    seen.set(correction.id, correction);
  }
  for (const experiment of lab.experiments) {
    if (digest(experiment.copySnapshot) !== experiment.copyHash)
      throw new Error(`CTA copy snapshot changed: ${experiment.id}.`);
  }
  for (const readback of lab.readbacks) {
    const experiment = lab.experiments.find(
      (item) => item.id === readback.experimentId,
    );
    if (
      !experiment ||
      readback.copyHash !== experiment.copyHash ||
      stable(readback.experimentSnapshot) !== stable(experiment)
    )
      throw new Error(
        `Readback ${readback.id} is not bound to its registered CTA snapshot.`,
      );
  }
}

export async function readCtaLab(filePath = languageSettings().ctaLabPath) {
  const lab = JSON.parse(await fs.readFile(filePath, "utf8"));
  validateLab(lab);
  if (activeLanguage() !== "ru" && filePath === languageSettings().ctaLabPath) {
    if (lab.languageCode !== languageSettings().languageCode) throw new Error("CTA Lab language mismatch.");
    const shared = JSON.parse(await fs.readFile(CTA_LAB_PATH, "utf8"));
    if (lab.localization?.sourceHash !== ctaSourceHash(shared))
      throw new Error("LOCALIZATION_REQUIRED: central CTA direction/rules changed. Review the translated CTA and cue words before production.");
  }
  return lab;
}

// Append-only ledger plus revision check prevents two MCP clients losing corrections.
export async function writeCtaLab(lab, filePath = languageSettings().ctaLabPath) {
  validateLab(lab);
  const lockPath = `${filePath}.lock`;
  let lock;
  try {
    lock = await fs.open(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "CTA lab is being updated. Read the latest lab and retry; do not remove its lock during a write.",
      );
    throw error;
  }
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    const previous = await readCtaLab(filePath);
    if (previous.revision !== lab.revision)
      throw new Error(
        "CTA lab revision changed. Read the latest lab and retry.",
      );
    for (const field of [
      "corrections",
      "experiments",
      "readbacks",
      "promotions",
    ]) {
      if (
        lab[field].length < previous[field].length ||
        previous[field].some(
          (entry, index) => stable(entry) !== stable(lab[field][index]),
        )
      )
        throw new Error(
          `CTA ${field} history is immutable. Append a new version or replacement snapshot.`,
        );
    }
    const saved = { ...lab, revision: lab.revision + 1 };
    await fs.writeFile(
      temporary,
      `${JSON.stringify(saved, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(temporary, filePath);
    return saved;
  } finally {
    await fs.rm(temporary, { force: true });
    await lock.close();
    await fs.rm(lockPath, { force: true });
  }
}

export function createCtaCorrection({
  lab,
  ownerWording,
  rule,
  scope = { type: "series" },
  supersedes = [],
  createdAt = new Date().toISOString(),
  source = "owner-correction",
}) {
  required(ownerWording, "ownerWording");
  required(rule, "rule");
  if (!["series", "episode", "format"].includes(scope.type))
    throw new Error("Correction scope must be series, episode, or format.");
  if (scope.type === "episode") required(scope.episodeId, "scope.episodeId");
  if (scope.type === "format") required(scope.formatId, "scope.formatId");
  const active = getActiveCtaCorrections(lab, scope);
  for (const id of supersedes) {
    const prior = active.find((item) => item.id === id);
    if (!prior || stable(prior.scope) !== stable(scope))
      throw new Error(
        `Cannot replace ${id}: it must be active and have the same scope.`,
      );
  }
  return {
    id: nextId("cta-correction", lab.corrections),
    ruleVersion: `cta-policy-v${lab.corrections.length + 1}`,
    createdAt: timestamp(createdAt, "createdAt"),
    source,
    ownerWording, // Preserve the owner's exact words, including spelling.
    rule: clean(rule),
    scope: clone(scope),
    supersedes: [...supersedes],
    effect: "mandatory-owner-policy",
    performanceEvidence: "not-a-performance-result",
  };
}

export function ctaCopySnapshot(episode) {
  return {
    cta: clean(episode.cta),
    scenes: (episode.scenes ?? [])
      .filter((scene) => scene.kind === "cta")
      .map((scene) => ({
        id: scene.id,
        narration: clean(scene.narration),
        headline: clean(scene.headline),
        screenCaption: clean(scene.screenCaption),
        captionStyleId: scene.captionStyleId ?? null,
        visualBeats: clone(scene.visualBeats ?? []),
        editPlan: clean(scene.editPlan),
      })),
    placement: ctaPlacementSnapshot(episode),
  };
}

export function ctaPlacementSnapshot(episode) {
  const scenes = episode.scenes ?? [];
  return scenes.flatMap((scene, sceneIndex) => {
    if (scene.kind !== "cta") return [];
    const before = scenes.slice(0, sceneIndex);
    return [{
      sceneId: scene.id,
      sceneIndex,
      precedingSceneIds: before.map((item) => item.id),
      durationSec: scene.durationSec ?? null,
      plannedStartSec: before.every((item) => Number.isFinite(item.durationSec))
        ? before.reduce((total, item) => total + item.durationSec, 0)
        : null,
    }];
  });
}

export function ctaContextSnapshot(episode) {
  // Use authored content, not imported timing fields, to bind the hypothesis.
  // A different hook, lesson, voice, or topic needs a fresh registration.
  const nonCtaContent = (episode.scenes ?? []).filter((scene) => scene.kind !== "cta").map((scene) => ({
    id: scene.id,
    kind: scene.kind,
    narration: clean(scene.narration),
    headline: clean(scene.headline),
    screenCaption: clean(scene.screenCaption),
    captionStyleId: scene.captionStyleId ?? null,
    visualBeats: clone(scene.visualBeats ?? []),
    cards: clone(scene.cards ?? []),
    editPlan: clean(scene.editPlan),
    ...(scene.promoVisual ? {promoVisual:clone(scene.promoVisual)} : {}),
    ...(scene.motionBeats?.length ? {motionBeats:clone(scene.motionBeats)} : {}),
  }));
  return {
    level: episode.level ?? null,
    topic: episode.topic ?? null,
    hookFormatId: episode.hookExperiment?.formatId ?? null,
    voiceProfileId: episode.voiceProfileId ?? null,
    voiceProvider: episode.voiceProvider ?? null,
    nonCtaContentHash: digest(nonCtaContent),
    ...(episode.scenes?.some(scene=>scene.motionBeats?.length)
      ? {motionDesign:episode.motionDesign === true,motionDesignStyle:episode.motionDesignStyle ?? null} : {}),
  };
}

const normalizeVoiceProvider = (provider) =>
  provider === "text-to-speech.online" ? "text-to-speech-online" : provider;

export function validateCtaEpisode(
  episode,
  lab,
  { requireRegistration = true } = {},
) {
  const errors = [];
  const warnings = [];
  const experiment = episode.ctaExperiment;
  const active = getActiveCtaCorrections(lab, {
    episodeId: episode.id,
    formatId: experiment?.formatId,
  });
  const ruleVersion = currentCtaRuleVersion(lab);
  const snapshot = ctaCopySnapshot(episode);
  if (snapshot.scenes.length !== 1)
    errors.push("Exactly one CTA scene is required.");
  const spoken = snapshot.scenes.map((scene) => scene.narration).join(" ");
  const tajik = episode.languageCode === "tg-TJ";
  if (lab.languageCode && episode.languageCode !== lab.languageCode)
    errors.push("CTA lab language must match the episode language.");
  for (const [field, text] of [
    ["cta", snapshot.cta],
    ["CTA narration", spoken],
  ]) {
    if (!(tajik ? /санҷ|озмо/iu : /попроб/iu).test(text)) errors.push(`${field}: invite viewers to try HSK AI.`);
    if (!/HSK\s+AI/u.test(text)) errors.push(`${field}: name HSK AI exactly.`);
    if (!(tajik ? /профил|саҳифа/iu : /профил/iu).test(text)) errors.push(`${field}: direct viewers to the profile.`);
    if (!(tajik ? /пайванд/iu : /ссылк/iu).test(text)) errors.push(`${field}: ask viewers to open the profile link.`);
    if (!(tajik ? /боргир|зеркаш/iu : /скача/iu).test(text))
      errors.push(`${field}: direct viewers to download HSK AI.`);
    if (
      (tajik ? /захира\s+кун|обуна\s+шав|лайк\s+мон|ҷавоб\s+навис/iu : /(сохран[иите]|подпиш|постав[ььте].*лайк|напиши(?:те)?\s+ответ|ответь)/iu).test(
        text,
      )
    )
      errors.push(
        `${field}: remove competing save/follow/quiz actions from the main CTA.`,
      );
    if (
      (tajik ? /худкор|фавр[иӣ]|кафолат|ройгон|дар\s+\d+\s+(?:рӯз|ҳафта|соат)/iu : /(автоматич|мгновенн|гарантир|за\s+\d+\s+(?:дн|недел|час)|бесплатн)/iu).test(
        text,
      )
    )
      errors.push(
        `${field}: remove unverified automation, speed, guarantee, or free-offer claims.`,
      );
  }
  const approvedTikTokManualDm = episode.ctaPlatform === "tiktok" &&
    lab.platformVariants?.tiktok?.status === "approved" &&
    lab.platformVariants?.tiktok?.deliveryMode === "manual-dm";
  if (!approvedTikTokManualDm &&
      (tajik ? /шарҳ\s+навис|директ|паём[иӣ]?\s+шахс|пайванд.*мефирист/iu : /(коммент|директ|личн.*сообщ|пришл.*ссылк|отправл.*ссылк)/iu).test(spoken))
    errors.push("CTA narration: remove the superseded comment/DM route.");
  if (active.some((item) => item.id === "cta-correction-0008")) {
    const screenshots = snapshot.scenes[0]?.visualBeats
      .filter((beat) => beat.screenImage)
      .map((beat) => ({ image: beat.screenImage, cue: beat.syncCueText }));
    const expected = episode.ctaPlatform === "youtube"
      ? [
          { image: "cta/youtube-telegram-profile.jpg", cue: "Зайди" },
          { image: "cta/youtube-open-link-browser.jpg", cue: "Открой" },
          { image: "cta/website-download.png", cue: "скачай" },
        ]
      : [
          { image: "cta/instagram-profile.png", cue: "Зайди" },
          { image: "cta/instagram-links.png", cue: "Открой" },
          { image: "cta/website-download.png", cue: "скачай" },
        ];
    if (JSON.stringify(screenshots) !== JSON.stringify(expected))
      errors.push("CTA visuals must show profile, profile links, then website download on their matching word cues.");
    if (snapshot.scenes[0]?.visualBeats.some((beat) => beat.actionIcon === "comment" || beat.actionIcon === "direct-message"))
      errors.push("CTA visuals: remove the superseded comment/DM actions.");
  }
  if (requireRegistration) {
    if (!experiment)
      errors.push("Register this CTA before voice preparation/rendering.");
    else {
      if (experiment.ruleVersion !== ruleVersion)
        errors.push(
          `CTA must acknowledge current mandatory rule version ${ruleVersion}.`,
        );
      const registered = lab.experiments.find(
        (item) => item.id === experiment.id,
      );
      if (!registered)
        errors.push(
          "CTA experiment ID is not present in the immutable registration ledger.",
        );
      else {
        if (registered.episodeId !== episode.id)
          errors.push("CTA registration belongs to a different episode.");
        if (registered.copyHash !== digest(snapshot))
          errors.push(
            "CTA changed after registration. Register a new version; preserve old attribution.",
          );
        const registeredContext = {
          ...registered.contextSnapshot,
          voiceProvider: normalizeVoiceProvider(
            registered.contextSnapshot.voiceProvider,
          ),
        };
        const currentContext = {
          ...ctaContextSnapshot(episode),
          voiceProvider: normalizeVoiceProvider(episode.voiceProvider),
        };
        if (stable(registeredContext) !== stable(currentContext))
          errors.push("Episode context changed after CTA registration. Register a new version for the current level, topic, hook, lesson, and voice.");
        if (stable(experiment) !== stable(ctaExperimentMetadata(registered)))
          errors.push("CTA metadata differs from its immutable registration.");
        const missing = active.filter(
          (item) => !registered.acknowledgedCorrectionIds.includes(item.id),
        );
        if (missing.length)
          errors.push(
            `Acknowledge owner corrections: ${missing.map((item) => item.id).join(", ")}.`,
          );
      }
    }
  }
  warnings.push(
    "Text checks do not prove visual/audio sync. Review each active owner correction against the actual narration and rendered frames.",
  );
  warnings.push(episode.ctaPlatform === "tiktok"
    ? "TikTok's manual-DM CTA does not prove a DM was sent or verify the download link; TikTok publishing is not authorized."
    : "The CTA directs viewers to the profile link and website; text checks do not verify current site availability or actual downloads.");
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    ruleVersion,
    activeCorrectionIds: active.map((item) => item.id),
  };
}

export function ctaExperimentMetadata(experiment) {
  return Object.fromEntries(
    [
      "id",
      "formatId",
      "ruleVersion",
      "offerId",
      "keyword",
      "hypothesis",
      "changedVariable",
      "comparisonGroupId",
      "registeredAt",
      "copyHash",
      "acknowledgedCorrectionIds",
    ].map((key) => [key, clone(experiment[key])]),
  );
}

export function createCtaExperiment({
  lab,
  episode,
  id,
  formatId = "benefit-profile-link-download",
  hypothesis,
  changedVariable = "baseline",
  comparisonGroupId = "hsk-profile-link-download-v1",
  keyword = lab.offer.keyword,
  registeredAt = new Date().toISOString(),
  acknowledgedCorrectionIds,
  supersedes = null,
}) {
  identifier(id, "id");
  if (lab.experiments.some((item) => item.id === id))
    throw new Error("CTA experiment ID already exists; use a new version ID.");
  identifier(formatId, "formatId");
  required(hypothesis, "hypothesis");
  identifier(comparisonGroupId, "comparisonGroupId");
  if (!["baseline", "wording", "visual", "placement"].includes(changedVariable))
    throw new Error(
      "Test only one CTA change: wording, visual, or placement; otherwise use baseline.",
    );
  const validation = validateCtaEpisode(episode, lab, {
    requireRegistration: false,
  });
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  const active = getActiveCtaCorrections(lab, {
    episodeId: episode.id,
    formatId,
  });
  if (
    !Array.isArray(acknowledgedCorrectionIds) ||
    active.some((rule) => !acknowledgedCorrectionIds.includes(rule.id))
  )
    throw new Error(
      "Read and explicitly acknowledge every active correction ID before registering the CTA.",
    );
  if (
    acknowledgedCorrectionIds.some(
      (id) => !active.some((rule) => rule.id === id),
    )
  )
    throw new Error(
      "Acknowledgement contains an inactive or out-of-scope correction.",
    );
  const prior = lab.experiments.find((item) => item.id === supersedes);
  if (supersedes && (!prior || prior.episodeId !== episode.id))
    throw new Error(
      "A revised CTA must supersede an existing registration for the same episode.",
    );
  const copySnapshot = ctaCopySnapshot(episode);
  return {
    id,
    episodeId: required(episode.id, "episode.id"),
    date: episode.date,
    formatId,
    ruleVersion: currentCtaRuleVersion(lab),
    offerId: lab.offer.id,
    keyword,
    hypothesis: clean(hypothesis),
    changedVariable,
    comparisonGroupId,
    registeredAt: timestamp(registeredAt, "registeredAt"),
    acknowledgedCorrectionIds: [...acknowledgedCorrectionIds],
    supersedes,
    copyHash: digest(copySnapshot),
    copySnapshot,
    placementHash: digest(copySnapshot.placement),
    contextSnapshot: ctaContextSnapshot(episode),
    primaryMetric: CTA_PRIMARY_METRIC,
    evidenceStatus: "unmeasured",
  };
}

export function createCtaReadback({
  lab,
  experimentId,
  platform,
  window,
  publishedAt,
  capturedAt,
  views,
  hskCommenters,
  profileLinkClickers,
  videoDurationSeconds,
  metricDefinition,
  postReference,
  deliveredDms,
  linkClicks,
  downloads,
  supersedes = null,
  notes = "",
}) {
  const experiment = lab.experiments.find((item) => item.id === experimentId);
  if (!experiment)
    throw new Error(
      "Unknown CTA experiment. Attribute metrics to the exact version that was published.",
    );
  if (!lab.policy.readbackWindows.includes(window))
    throw new Error("Readback window must be 24h or 7d.");
  platform = required(platform, "platform").toLowerCase();
  postReference = required(postReference, "postReference");
  metricDefinition = required(metricDefinition, "metricDefinition");
  publishedAt = timestamp(publishedAt, "publishedAt");
  capturedAt = timestamp(capturedAt, "capturedAt");
  if (Date.parse(experiment.registeredAt) > Date.parse(publishedAt))
    throw new Error(
      "CTA registration happened after publication; it is not a preregistered experiment.",
    );
  if (Date.parse(capturedAt) < Date.parse(publishedAt))
    throw new Error("Analytics cannot be captured before publication.");
  views = count(views, "views");
  hskCommenters = count(hskCommenters, "hskCommenters", { optional: true });
  profileLinkClickers = count(profileLinkClickers, "profileLinkClickers", { optional: true });
  if (hskCommenters !== null && hskCommenters > views)
    throw new Error(
      "HSK commenters exceed views; check the metric definition/window.",
    );
  if (profileLinkClickers !== null && profileLinkClickers > views)
    throw new Error("Profile link clickers exceed views; check the metric definition/window.");
  if (!Number.isFinite(videoDurationSeconds) || videoDurationSeconds <= 0)
    throw new Error("Supply the actual positive published video duration.");
  const downstream = Object.fromEntries(
    Object.entries({ deliveredDms, linkClicks, downloads }).map(
      ([name, value]) => [name, count(value, name, { optional: true })],
    ),
  );
  const currentProfileOffer =
    experiment.offerId === "hsk-ai-profile-link-download-v1";
  const primaryCount = currentProfileOffer
    ? profileLinkClickers
    : hskCommenters;
  const primaryMetric = currentProfileOffer
    ? CTA_PRIMARY_METRIC
    : LEGACY_CTA_PRIMARY_METRIC;
  const prior = lab.readbacks.find((item) => item.id === supersedes);
  const samePostWindow = (entry) =>
    entry.platform === platform &&
    entry.postReference === postReference &&
    entry.window === window;
  const activeReadbacks = latestCtaReadbacks(lab);
  if (
    supersedes &&
    (!prior ||
      !samePostWindow(prior) ||
      prior.experimentId !== experimentId ||
      !activeReadbacks.some((item) => item.id === prior.id))
  )
    throw new Error(
      "Replacement readback must reference the active snapshot for the same post, window, and CTA version.",
    );
  if (activeReadbacks.some(samePostWindow) && !supersedes)
    throw new Error(
      "A snapshot for this post/window exists. Append a correction with supersedes; do not overwrite history.",
    );
  if (
    lab.readbacks.some(
      (entry) =>
        entry.platform === platform &&
        entry.postReference === postReference &&
        entry.experimentId !== experimentId,
    )
  )
    throw new Error(
      "This published post is already attributed to a different CTA version.",
    );
  return {
    id: nextId("cta-readback", lab.readbacks),
    experimentId,
    copyHash: experiment.copyHash,
    experimentSnapshot: clone(experiment),
    platform,
    window,
    postReference,
    publishedAt,
    capturedAt,
    metricDefinition,
    videoDurationSeconds,
    durationBand:
      videoDurationSeconds < 25
        ? "under-25s"
        : videoDurationSeconds < 30
          ? "25-29s"
          : videoDurationSeconds <= 35
            ? "30-35s"
            : "over-35s",
    views,
    hskCommenters,
    profileLinkClickers,
    primaryMetric,
    primaryMetricValue:
      views > 0 && primaryCount !== null
        ? rounded((primaryCount / views) * 1000)
        : null,
    ...downstream,
    downstreamPer1000Views: Object.fromEntries(
      Object.entries(downstream).map(([key, value]) => [
        key,
        views > 0 && value !== null ? rounded((value / views) * 1000) : null,
      ]),
    ),
    supersedes,
    notes: clean(notes),
    source: "owner-entered-platform-analytics",
  };
}

export function latestCtaReadbacks(lab) {
  const replaced = new Set(
    lab.readbacks.map((item) => item.supersedes).filter(Boolean),
  );
  return lab.readbacks.filter((item) => !replaced.has(item.id));
}

export function summarizeCtaLab(lab) {
  const readbacks = latestCtaReadbacks(lab);
  const cohorts = new Map();
  for (const record of readbacks) {
    const experiment = record.experimentSnapshot;
    // Explicit metric definitions and control settings are part of attribution.
    const key = stable({
      platform: record.platform,
      window: record.window,
      metricDefinition: record.metricDefinition,
      offerId: experiment.offerId,
      keyword: experiment.keyword,
      level: experiment.contextSnapshot.level,
      topic: experiment.contextSnapshot.topic,
      durationBand: record.durationBand,
      comparisonGroupId: experiment.comparisonGroupId,
      hookFormatId: experiment.contextSnapshot.hookFormatId,
      voiceProfileId: experiment.contextSnapshot.voiceProfileId,
      voiceProvider: experiment.contextSnapshot.voiceProvider,
    });
    if (!cohorts.has(key)) cohorts.set(key, []);
    cohorts.get(key).push(record);
  }
  const comparisons = [];
  for (const [cohort, records] of cohorts) {
    const eligible = records.filter(
      (item) =>
        item.views >= lab.policy.minimumViewsPerPost &&
        item.primaryMetricValue !== null,
    );
    const baseline = eligible.filter(
      (item) =>
        item.experimentSnapshot.changedVariable === "baseline" &&
        item.experimentSnapshot.formatId === lab.baselineFormatId,
    );
    const candidates = new Set(
      records
        .filter(
          (item) => item.experimentSnapshot.changedVariable !== "baseline",
        )
        .map(
          (item) =>
            `${item.experimentSnapshot.formatId}|${item.experimentSnapshot.changedVariable}`,
        ),
    );
    for (const candidateKey of candidates) {
      const [formatId, changedVariable] = candidateKey.split("|");
      const candidate = eligible.filter(
        (item) =>
          item.experimentSnapshot.formatId === formatId &&
          item.experimentSnapshot.changedVariable === changedVariable,
      );
      const baselineMedian = median(
        baseline.map((item) => item.primaryMetricValue),
      );
      const candidateMedian = median(
        candidate.map((item) => item.primaryMetricValue),
      );
      const relativeLiftPercent =
        baselineMedian > 0 && candidateMedian !== null
          ? rounded(((candidateMedian - baselineMedian) / baselineMedian) * 100)
          : null;
      const sufficient =
        baseline.length >= lab.policy.minimumPostsPerVariant &&
        candidate.length >= lab.policy.minimumPostsPerVariant;
      const baselineCopies = new Set(baseline.map((item) => item.copyHash));
      const unchangedTreatment =
        candidate.length > 0 &&
        candidate.every((item) => baselineCopies.has(item.copyHash));
      const downstream = Object.fromEntries(
        lab.policy.optionalDownstreamCounts.map((field) => {
          const complete =
            baseline.length > 0 &&
            candidate.length > 0 &&
            [...baseline, ...candidate].every(
              (entry) => entry.downstreamPer1000Views[field] !== null,
            );
          const base = complete
            ? median(
                baseline.map((entry) => entry.downstreamPer1000Views[field]),
              )
            : null;
          const test = complete
            ? median(
                candidate.map((entry) => entry.downstreamPer1000Views[field]),
              )
            : null;
          return [
            field,
            {
              status: complete ? "supplied" : "unknown",
              baselineMedian: base,
              candidateMedian: test,
              relativeLiftPercent:
                base > 0 ? rounded(((test - base) / base) * 100) : null,
            },
          ];
        }),
      );
      const downstreamDecline = Object.values(downstream).some(
        (metric) =>
          metric.relativeLiftPercent !== null &&
          metric.relativeLiftPercent <
            -lab.policy.maximumSuppliedDownstreamDropPercent,
      );
      const candidateReady =
        sufficient &&
        !unchangedTreatment &&
        relativeLiftPercent !== null &&
        relativeLiftPercent >= lab.policy.minimumRelativeLiftPercent &&
        !downstreamDecline;
      comparisons.push({
        cohort: JSON.parse(cohort),
        candidateFormatId: formatId,
        changedVariable,
        baselinePosts: baseline.length,
        candidatePosts: candidate.length,
        baselineMedian,
        candidateMedian,
        relativeLiftPercent,
        downstream,
        decision: candidateReady ? "eligible-for-owner-review" : "keep-testing",
        reason: !sufficient
          ? "Not enough comparable posts/views."
          : unchangedTreatment
            ? "Candidate and baseline contain the same CTA copies; a different label is not a tested change."
            : relativeLiftPercent === null
              ? "Missing primary counts or zero baseline; relative lift is undefined."
              : downstreamDecline
                ? "Supplied downstream counts fell beyond the operating guardrail."
                : candidateReady
                  ? "Initial operating thresholds met; attribution and owner review are still required."
                  : "Initial lift threshold not met.",
        evidenceReadbackIds: [...baseline, ...candidate].map((item) => item.id),
        caveat:
          "Topics and audiences may differ. Declared one-variable changes are not proof of causality; supplied downstream counts remain separate and missing is not zero.",
      });
    }
  }
  return {
    status: readbacks.some((item) => item.primaryMetricValue !== null)
      ? "measured"
      : "unmeasured",
    mandatoryRuleVersion: currentCtaRuleVersion(lab),
    activeCorrections: getActiveCtaCorrections(lab),
    scopedCorrections: lab.corrections
      .filter(
        (item) =>
          item.scope.type !== "series" &&
          !lab.corrections.some((newer) => newer.supersedes.includes(item.id)),
      )
      .map((item) => ({ ...clone(item), status: "active" })),
    canonicalCta: lab.offer.canonicalRussian,
    registeredExperiments: lab.experiments.length,
    recordedSnapshots: lab.readbacks.length,
    activeSnapshots: readbacks.length,
    policy: clone(lab.policy),
    comparisons,
    promotions: clone(lab.promotions),
    recentReadbacks: readbacks.slice(-12),
    platformAnalyticsConnected: false,
    automaticDmsConfigured: false,
    nextAction: readbacks.length
      ? "Gather comparable owner-entered counts, inspect downstream evidence, and keep unproven variants as experiments."
      : "After publication, record exact-version 24h/7d views, unique profile-link clickers, and downloads when available.",
  };
}

export function createCtaPromotion({
  lab,
  candidateFormatId,
  changedVariable,
  evidenceReadbackIds,
  ownerWording,
  approvedAt = new Date().toISOString(),
  ownerConfirmed = false,
}) {
  if (ownerConfirmed !== true)
    throw new Error("Promotion requires the owner's explicit decision.");
  required(ownerWording, "ownerWording");
  const comparison = summarizeCtaLab(lab).comparisons.find(
    (item) =>
      item.candidateFormatId === candidateFormatId &&
      item.changedVariable === changedVariable &&
      item.decision === "eligible-for-owner-review" &&
      stable([...item.evidenceReadbackIds].sort()) ===
        stable([...(evidenceReadbackIds ?? [])].sort()),
  );
  if (!comparison)
    throw new Error(
      "No comparable evidence currently supports this promotion. Keep testing; owner policy corrections can still apply immediately.",
    );
  approvedAt = timestamp(approvedAt, "approvedAt");
  if (
    lab.readbacks.some(
      (item) =>
        evidenceReadbackIds.includes(item.id) &&
        Date.parse(item.capturedAt) > Date.parse(approvedAt),
    )
  )
    throw new Error("Owner promotion cannot predate its evidence.");
  return {
    id: nextId("cta-promotion", lab.promotions),
    approvedAt,
    approvedBy: "owner",
    ownerWording,
    candidateFormatId,
    changedVariable,
    evidenceReadbackIds: [...evidenceReadbackIds],
    comparisonSnapshot: clone(comparison),
    meaning:
      "Owner-selected playbook candidate; not statistical or causal proof.",
  };
}
