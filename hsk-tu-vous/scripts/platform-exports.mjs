import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  createCtaExperiment,
  ctaExperimentMetadata,
  readCtaLab,
  validateCtaEpisode,
} from "./cta-lab.mjs";
import {
  getPlatformCtaStatus,
  preparePlatformCtaDraft,
} from "./platform-cta.mjs";
import { APPROVED_PUBLICATION_PLATFORMS } from "./publication-policy.mjs";
import {
  episodeContentHash,
  narrationHash,
  readJson,
  reviewDir,
  FPS,
} from "./lib.mjs";

export function sharedRenderRanges(episode) {
  const last = episode.scenes.at(-1);
  if (
    last?.kind !== "cta" ||
    episode.scenes.filter((s) => s.kind === "cta").length !== 1
  )
    throw new Error("Shared export requires exactly one final CTA scene.");
  const frames = episode.scenes.map((s) =>
    Math.max(1, s.durationFrames ?? Math.ceil((s.durationSec ?? 4) * FPS)),
  );
  const ctaStart = frames.slice(0, -1).reduce((a, b) => a + b, 0);
  const totalFrames = Math.max(
    frames.reduce((a, b) => a + b, 0),
    Math.ceil(((episode.audioDurationMs ?? 0) * FPS) / 1000),
  );
  if (ctaStart < 1)
    throw new Error("Shared export requires a lesson before the CTA.");
  return {
    ctaStart,
    totalFrames,
    body: [0, ctaStart - 1],
    ending: [ctaStart, totalFrames - 1],
  };
}

export function assertSharedLesson(base, variant) {
  const ranges = sharedRenderRanges(base);
  const next = sharedRenderRanges(variant);
  if (
    JSON.stringify(ranges) !== JSON.stringify(next) ||
    JSON.stringify(base.scenes.slice(0, -1)) !==
      JSON.stringify(variant.scenes.slice(0, -1)) ||
    narrationHash(base) !== narrationHash(variant) ||
    [
      "audioSrc",
      "voiceTextHash",
      "voiceProfileId",
      "audioDurationMs",
      "audioTrimAfterFrames",
      "backgroundMusicSrc",
      "captionSource",
    ].some((key) => base[key] !== variant[key]) ||
    JSON.stringify(base.captions) !== JSON.stringify(variant.captions)
  )
    throw new Error(
      "Platform CTA changed shared narration, timing or lesson. Import matching speech before exporting; do not reuse stale audio.",
    );
}

/** Only an already reviewed/registered base may produce approved visual variants. */
export function prepareExportEpisodes(base, lab) {
  if (base.ctaPlatform && base.ctaPlatform !== "instagram")
    throw new Error(
      "Automatic shared exports require the Instagram working lesson as the base.",
    );
  const validation = validateCtaEpisode(base, lab);
  if (!validation.valid)
    throw new Error(
      "CTA rejasi yangilanishi kerak:\n" + validation.errors.join("\n"),
    );
  sharedRenderRanges(base);
  const registrations = [];
  const episodes = {};
  for (const platform of APPROVED_PUBLICATION_PLATFORMS) {
    if (!getPlatformCtaStatus(lab, platform).readyForRendering)
      throw new Error(`${platform} CTA is not approved for rendering.`);
    const episode = preparePlatformCtaDraft(base, lab, platform);
    assertSharedLesson(base, episode);
    if (platform !== "instagram") {
      const ledger = {
        ...lab,
        experiments: [...lab.experiments, ...registrations],
      };
      for (const previous of [...ledger.experiments]
        .reverse()
        .filter((entry) => entry.episodeId === base.id)) {
        episode.ctaExperiment = ctaExperimentMetadata(previous);
        if (validateCtaEpisode(episode, ledger).valid) break;
        delete episode.ctaExperiment;
      }
      if (!episode.ctaExperiment) {
        let version = 1;
        while (
          ledger.experiments.some(
            (entry) => entry.id === `${base.id}-${platform}-cta-v${version}`,
          )
        )
          version++;
        const registration = createCtaExperiment({
          lab: ledger,
          episode,
          id: `${base.id}-${platform}-cta-v${version}`,
          formatId: base.ctaExperiment.formatId,
          comparisonGroupId: `${base.ctaExperiment.comparisonGroupId}-${platform}`,
          hypothesis:
            "Bind the owner-approved platform CTA visuals to the reviewed shared lesson and existing speech. This baseline registration makes no performance claim.",
          // Inherit the explicitly reviewed base acknowledgements. Never infer
          // acknowledgement of a new rule or manufacture analytics evidence.
          acknowledgedCorrectionIds: [
            ...base.ctaExperiment.acknowledgedCorrectionIds,
          ],
        });
        registrations.push(registration);
        episode.ctaExperiment = ctaExperimentMetadata(registration);
      }
    }
    episodes[platform] = episode;
  }
  return { episodes, registrations };
}

export function platformPackagePaths(id, platform) {
  if (!APPROVED_PUBLICATION_PLATFORMS.includes(platform))
    throw new Error("Unsupported export platform.");
  const folder =
    platform === "instagram"
      ? reviewDir(id)
      : path.join(reviewDir(id), platform);
  return {
    platform,
    folder,
    episode: path.join(folder, "episode.json"),
    video: path.join(folder, "video.mp4"),
    captions: path.join(folder, "captions.srt"),
    post: path.join(folder, "post.md"),
  };
}

export async function videoHash(file) {
  return createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
}

/** Bind a destination to its actual rendered ending, never to the other video. */
export async function requirePlatformPackage(
  base,
  status,
  platform,
  { lab } = {},
) {
  lab ??= await readCtaLab();
  const stored = status.platformPackages?.[platform];
  // Historical single-Instagram packages remain readable; they cannot
  // authorize YouTube using an Instagram file.
  if (!stored && platform !== "instagram")
    throw new Error(
      "YouTube export is missing. Render the shared platform packages first.",
    );
  const paths = platformPackagePaths(base.id, platform);
  const episode =
    platform === "instagram" ? base : await readJson(paths.episode);
  if (stored) {
    const expected = preparePlatformCtaDraft(base, lab, platform);
    expected.ctaExperiment = episode.ctaExperiment;
    if (
      stored.baseContentHash !== episodeContentHash(base) ||
      stored.contentHash !== episodeContentHash(episode) ||
      stored.ctaExperimentId !== episode.ctaExperiment?.id ||
      episodeContentHash(expected) !== episodeContentHash(episode)
    )
      throw new Error(
        `${platform} export no longer matches the current lesson/CTA. Render again.`,
      );
    assertSharedLesson(base, episode);
  }
  const validation = validateCtaEpisode(episode, lab);
  if (!validation.valid)
    throw new Error(
      "CTA rejasi yangilanishi kerak:\n" + validation.errors.join("\n"),
    );
  for (const file of [paths.video, paths.captions, paths.post])
    await fs.access(file);
  const hash = await videoHash(paths.video);
  if (stored?.videoSha256 && stored.videoSha256 !== hash)
    throw new Error(
      `${platform} rendered video changed. Render and review again.`,
    );
  return {
    ...paths,
    contentHash: episodeContentHash(episode),
    baseContentHash: episodeContentHash(base),
    ctaExperimentId: episode.ctaExperiment.id,
    ctaCopyHash: episode.ctaExperiment.copyHash,
    ctaRuleVersion: validation.ruleVersion,
    videoSha256: hash,
  };
}

export async function requireApprovedPlatformPackages(
  base,
  status,
  approval,
  { lab } = {},
) {
  for (const target of approval.publicationIntent.platforms) {
    const current = await requirePlatformPackage(
      base,
      status,
      target.platform,
      { lab },
    );
    const approved = approval.platformPackages?.[target.platform];
    if (
      (!approved && target.platform !== "instagram") ||
      (approved &&
        (approved.contentHash !== current.contentHash ||
          approved.videoSha256 !== current.videoSha256))
    )
      throw new Error(
        `${target.platform} video is not the exact owner-approved export.`,
      );
  }
}
