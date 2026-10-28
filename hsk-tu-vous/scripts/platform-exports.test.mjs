import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  readCtaLab,
  createCtaExperiment,
  ctaExperimentMetadata,
  getActiveCtaCorrections,
  createCtaCorrection,
  validateCtaEpisode,
} from "./cta-lab.mjs";
import { composeLessonCta } from "./episode-cta-assembly.mjs";
import {
  prepareExportEpisodes,
  assertSharedLesson,
  sharedRenderRanges,
  platformPackagePaths,
  requirePlatformPackage,
  requireApprovedPlatformPackages,
  videoHash,
} from "./platform-exports.mjs";
import {
  renderSharedPlatformVideos,
  verifyPlatformVideo,
} from "./render-platform-videos.mjs";
import {
  PROJECT_ROOT,
  episodeContentHash,
  narrationHash,
  invalidateReviewArtifacts,
  reviewDir,
  writeJson,
} from "./lib.mjs";

async function fixture(id = "platform-export-test") {
  const lab = await readCtaLab();
  const source = JSON.parse(
    await fs.readFile(
      path.join(PROJECT_ROOT, "content/episodes/zhe-na-ge.json"),
    ),
  );
  source.id = id;
  source.learningFactSources = [
    {
      title: "Fixture source",
      url: "https://example.test/reference",
      checkedAt: "2026-10-09",
      supports: "Test fixture only",
    },
  ];
  const base = composeLessonCta(source, lab);
  delete base.ctaExperiment;
  Object.assign(base, {
    audioSrc: "generated/test/voice.mp3",
    voiceTextHash: narrationHash(base),
    captions: [{ text: "Попробуй", startMs: 23000, endMs: 23500 }],
    captionSource: "gemini-word-timestamps",
    audioDurationMs: 30000,
  });
  const record = createCtaExperiment({
    lab,
    episode: base,
    id: `${id}-base`,
    hypothesis:
      "Record the reviewed base CTA without claiming measured improvements.",
    acknowledgedCorrectionIds: getActiveCtaCorrections(lab, {
      episodeId: id,
      formatId: "benefit-profile-link-download",
    }).map((x) => x.id),
  });
  lab.experiments.push(record);
  base.ctaExperiment = ctaExperimentMetadata(record);
  return { base, lab };
}

test("platform exports cannot share narration or lesson frames across languages",async()=>{
  const {base}=await fixture("platform-language-test");
  const variant=structuredClone(base);
  variant.languageCode="tg-TJ";
  assert.throws(()=>assertSharedLesson(base,variant),/Platform CTA changed shared narration/);
});

test("shared-voice platform exports preserve one lesson and add distinct registered CTA endings", async () => {
  const { base, lab } = await fixture();
  const before = JSON.stringify({ base, lab });
  const { episodes, registrations } = prepareExportEpisodes(base, lab);
  assert.deepEqual(Object.keys(episodes), ["instagram", "youtube", "facebook"]);
  assert.equal(registrations.length, 2);
  assert.deepEqual(
    episodes.youtube.scenes.slice(0, -1),
    base.scenes.slice(0, -1),
  );
  assert.equal(episodes.youtube.audioSrc, base.audioSrc);
  assert.equal(episodes.youtube.voiceTextHash, base.voiceTextHash);
  assert.deepEqual(episodes.youtube.captions, base.captions);
  assert.equal(episodes.facebook.audioSrc, base.audioSrc);
  assert.equal(episodes.facebook.voiceTextHash, base.voiceTextHash);
  assert.deepEqual(episodes.facebook.captions, base.captions);
  assert.ok(episodes.facebook.scenes.at(-1).visualBeats.every((beat) => !beat.screenImage));
  assert.equal(
    episodes.youtube.scenes.at(-1).visualBeats[1].screenImage,
    "cta/youtube-telegram-profile.jpg",
  );
  assert.equal(
    episodes.youtube.scenes.at(-1).visualBeats[2].screenImage,
    "cta/youtube-open-link-browser.jpg",
  );
  assert.notEqual(episodes.youtube.ctaExperiment.id, base.ctaExperiment.id);
  assert.deepEqual(
    episodes.youtube.ctaExperiment.acknowledgedCorrectionIds,
    base.ctaExperiment.acknowledgedCorrectionIds,
  );
  assert.equal(
    JSON.stringify({ base, lab }),
    before,
    "must not rewrite a source snapshot or ledger",
  );
  lab.experiments.push(...registrations);
  assert.equal(validateCtaEpisode(episodes.youtube, lab).valid, true);
  const again = prepareExportEpisodes(base, lab);
  assert.equal(
    again.registrations.length,
    0,
    "reuse an exact immutable registration",
  );
  assert.equal(
    again.episodes.youtube.ctaExperiment.id,
    episodes.youtube.ctaExperiment.id,
  );
});

test("automatic derivation rejects new rules, changed CTA speech and a non-final CTA", async () => {
  const { base, lab } = await fixture();
  const changed = structuredClone(lab);
  changed.platformVariants.youtube.copySource = "platform";
  changed.platformVariants.youtube.canonicalRussian =
    "Попробуй HSK AI. Зайди в профиль, открой ссылку, затем скачай приложение с сайта.";
  assert.throws(() => prepareExportEpisodes(base, changed), /shared narration/);
  const updated = structuredClone(lab);
  updated.corrections.push(
    createCtaCorrection({
      lab: updated,
      ownerWording: "Read this new correction.",
      rule: "Read the latest mandatory rule before rendering.",
      scope: { type: "series" },
    }),
  );
  assert.throws(() => prepareExportEpisodes(base, updated), /CTA rejasi/);
  const reordered = structuredClone(base);
  reordered.scenes.unshift(reordered.scenes.pop());
  assert.throws(() => sharedRenderRanges(reordered), /final CTA/);
});

test("render workflow draws one lesson, three shared-voice CTA endings and one continuous mix", async () => {
  const { base, lab } = await fixture();
  const { episodes } = prepareExportEpisodes(base, lab);
  const expectedRanges = sharedRenderRanges(base);
  const folder = await fs.mkdtemp(
    path.join(os.tmpdir(), "hsk-platform-render-"),
  );
  const commands = [];
  try {
    const ranges = await renderSharedPlatformVideos({
      episodes,
      outputs: {
        instagram: path.join(folder, "ig.mp4"),
        youtube: path.join(folder, "yt.mp4"),
        facebook: path.join(folder, "fb.mp4"),
      },
      workDir: path.join(folder, "work"),
      execute: (args) => {
        commands.push(args);
        if (args[0] === "ffprobe")
          return JSON.stringify({
            streams: [
              {
                codec_type: "video",
                codec_name: "h264",
                width: 1080,
                height: 1920,
                pix_fmt: "yuv420p",
                color_space: "bt709",
                r_frame_rate: "30/1",
                nb_frames: expectedRanges.totalFrames,
                duration: expectedRanges.totalFrames / 30,
              },
              { codec_type: "audio", codec_name: "aac", duration: expectedRanges.totalFrames / 30 },
            ],
          });
      },
      log: () => {},
    });
    const renders = commands.filter((args) => args[0] === "render");
    assert.equal(renders.length, 5);
    assert.equal(
      renders.filter((args) => args.includes(ranges.body.join("-"))).length,
      1,
    );
    assert.equal(
      renders.filter((args) => args.includes(ranges.ending.join("-"))).length,
      3,
    );
    assert.equal(renders.filter((args) => args.includes("--muted")).length, 4);
    assert.equal(renders.filter((args) => args.includes("aac")).length, 1);
    const muxes = commands.filter((args) => args[0] === "ffmpeg");
    assert.equal(muxes.length, 3);
    assert.ok(
      muxes.every((args) => args.includes("copy") && args.includes("1:a:0")),
    );
    await assert.rejects(fs.access(path.join(folder, "work")), {
      code: "ENOENT",
    });
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
});

test("an encoded output with dropped frames is never accepted as a finished package", async () => {
  await assert.rejects(
    verifyPlatformVideo("test.mp4", 900, () =>
      JSON.stringify({
        streams: [
          {
            codec_type: "video",
            codec_name: "h264",
            width: 1080,
            height: 1920,
            pix_fmt: "yuv420p",
            color_space: "bt709",
            r_frame_rate: "30/1",
            nb_frames: 899,
            duration: 30,
          },
          { codec_type: "audio", codec_name: "aac", duration: 30 },
        ],
      }),
    ),
    /frame-count/,
  );
});

test("preview and publishing bind YouTube to its exact export, registration and media hash", async () => {
  const id = `platform-test-${Date.now()}`;
  const { base, lab } = await fixture(id);
  const { episodes, registrations } = prepareExportEpisodes(base, lab);
  lab.experiments.push(...registrations);
  const status = { platformPackages: {} };
  try {
    await assert.rejects(
      requirePlatformPackage(base, status, "youtube", { lab }),
      /youtube export is missing/,
    );
    for (const [platform, episode] of Object.entries(episodes)) {
      const files = platformPackagePaths(id, platform);
      await writeJson(files.episode, episode);
      for (const file of [files.video, files.captions, files.post])
        await fs.writeFile(file, platform);
      status.platformPackages[platform] = {
        ...files,
        baseContentHash: episodeContentHash(base),
        contentHash: episodeContentHash(episode),
        ctaExperimentId: episode.ctaExperiment.id,
        videoSha256: await videoHash(files.video),
      };
    }
    const selected = await requirePlatformPackage(base, status, "youtube", {
      lab,
    });
    assert.equal(selected.video, path.join(reviewDir(id), "youtube/video.mp4"));
    assert.equal(selected.ctaExperimentId, episodes.youtube.ctaExperiment.id);
    const approval = {
      publicationIntent: { platforms: [{ platform: "youtube" }] },
      platformPackages: { youtube: selected },
    };
    await requireApprovedPlatformPackages(base, status, approval, { lab });
    approval.platformPackages.youtube = {
      ...selected,
      videoSha256: "different-video",
    };
    await assert.rejects(
      requireApprovedPlatformPackages(base, status, approval, { lab }),
      /exact owner-approved/,
    );
    const changed = structuredClone(lab);
    changed.platformVariants.youtube.sceneTemplate.visualBeats[1]
      .screenHighlight.topPercent++;
    await assert.rejects(
      requirePlatformPackage(base, status, "youtube", { lab: changed }),
      /no longer matches/,
    );
    await fs.writeFile(selected.video, "swapped-video");
    await assert.rejects(
      requirePlatformPackage(base, status, "youtube", { lab }),
      /rendered video changed/,
    );
    await fs.writeFile(selected.video, "youtube");
    await writeJson(path.join(reviewDir(id), "approvals/history.json"), {
      historical: true,
    });
    await invalidateReviewArtifacts(id);
    await assert.rejects(fs.access(selected.video), { code: "ENOENT" });
    assert.deepEqual(
      JSON.parse(
        await fs.readFile(path.join(reviewDir(id), "approvals/history.json")),
      ),
      { historical: true },
    );
  } finally {
    await fs.rm(reviewDir(id), { recursive: true, force: true });
  }
});

test("approval CLI rejects a missing YouTube export and archives each selected platform CTA separately", async () => {
  const { base, lab } = await fixture();
  const { episodes, registrations } = prepareExportEpisodes(base, lab);
  lab.experiments.push(...registrations);
  const folder = await fs.mkdtemp(
    path.join(os.tmpdir(), "hsk-platform-approval-"),
  );
  try {
    await fs.cp(
      path.join(PROJECT_ROOT, "scripts"),
      path.join(folder, "scripts"),
      { recursive: true, filter: (file) => !file.endsWith(".test.mjs") },
    );
    // Approval reads canonical planning and render policy through the normal
    // loader. Keep this isolated project complete without invoking production.
    await fs.cp(path.join(PROJECT_ROOT, "content"), path.join(folder, "content"), { recursive: true });
    await writeJson(path.join(folder, "content/cta-lab.json"), lab);
    const fixtureCalendar = JSON.parse(await fs.readFile(path.join(folder, "content/calendar.json"), "utf8"));
    fixtureCalendar.items = [{ id: base.id, date: base.date, episodeFile: `episodes/${base.id}.json`, status: "planned" }];
    await writeJson(path.join(folder, "content/calendar.json"), fixtureCalendar);
    const canonicalLesson = structuredClone(base);
    delete canonicalLesson.cta;
    delete canonicalLesson.ctaExperiment;
    canonicalLesson.scenes = canonicalLesson.scenes.filter(scene=>scene.kind!=="cta");
    await writeJson(path.join(folder, "content/episodes", `${base.id}.json`), canonicalLesson);
    const review = path.join(folder, "review", base.id);
    const status = {
      stage: "rendered-pending-owner-approval",
      contentHash: episodeContentHash(base),
      ctaExperimentId: base.ctaExperiment.id,
      platformPackages: {},
    };
    for (const [platform, episode] of Object.entries(episodes)) {
      const dest =
        platform === "instagram" ? review : path.join(review, platform);
      await writeJson(path.join(dest, "episode.json"), episode);
      for (const name of ["video.mp4", "captions.srt", "post.md"])
        await fs.writeFile(path.join(dest, name), platform);
      status.platformPackages[platform] = {
        baseContentHash: episodeContentHash(base),
        contentHash: episodeContentHash(episode),
        ctaExperimentId: episode.ctaExperiment.id,
        videoSha256: await videoHash(path.join(dest, "video.mp4")),
      };
    }
    const intent = {
      mode: "now",
      timezone: "Asia/Shanghai",
      platforms: [
        {
          platform: "instagram",
          accountId: "test-ig",
          accountName: "Test IG",
          caption: "Test Instagram caption",
          instagramSettings: { shareToFeed: false, isAiGenerated: false },
        },
        {
          platform: "youtube",
          accountId: "test-yt",
          accountName: "Test YT",
          caption: "Test YouTube description",
          youtubeSettings: {
            title: "Test title",
            visibility: "unlisted",
            madeForKids: false,
            containsSyntheticMedia: false,
          },
        },
      ],
    };
    const approve = () =>
      spawnSync(
        process.execPath,
        [
          path.join(folder, "scripts/approve-package.mjs"),
          base.id,
          JSON.stringify(intent),
        ],
        { encoding: "utf8" },
      );
    const youtube = status.platformPackages.youtube;
    delete status.platformPackages.youtube;
    await writeJson(path.join(review, "status.json"), status);
    const missing = approve();
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /youtube export is missing/);
    await assert.rejects(fs.access(path.join(review, "approval.json")), {
      code: "ENOENT",
    });
    status.platformPackages.youtube = youtube;
    await writeJson(path.join(review, "status.json"), status);
    const result = approve();
    assert.equal(result.status, 0, result.stderr);
    const approval = JSON.parse(
      await fs.readFile(path.join(review, "approval.json")),
    );
    assert.notEqual(
      approval.platformPackages.youtube.video,
      approval.platformPackages.instagram.video,
    );
    assert.equal(
      approval.platformPackages.youtube.ctaExperimentId,
      episodes.youtube.ctaExperiment.id,
    );
    const archive = JSON.parse(
      await fs.readFile(
        path.join(
          review,
          "approvals",
          `${episodes.youtube.ctaExperiment.id}.json`,
        ),
      ),
    );
    assert.equal(archive.ctaExperimentId, episodes.youtube.ctaExperiment.id);
    assert.equal(archive.contentHash, episodeContentHash(episodes.youtube));
    assert.deepEqual(
      archive.publicationIntent.platforms.map((x) => x.platform),
      ["youtube"],
    );
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
});
