import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { validateInput, resolveExactEpisode, validateProbe, packageReview } from "./github-video-pipeline.mjs";
import { withLanguage } from "./language-context.mjs";
import { PROJECT_ROOT, reviewDir, writeStatus } from "./lib.mjs";
import { platformPackagePaths } from "./platform-exports.mjs";

test("production request is restricted to canonical episode and explicit configured language", () => {
  assert.deepEqual(validateInput("er-vs-liang-cafe-20261026", "all").languages, ["ru", "tg"]);
  assert.deepEqual(validateInput("2026-10-26", "tg").languages, ["tg"]);
  for (const value of ["../secrets", "broken\nname", "2026-10-28 && curl", ""]) {
    assert.throws(() => validateInput(value, "all"));
  }
  assert.throws(() => validateInput("today", "zh"));
});

test("exact dates stay exact; no duplicate published episode, fabricated date or silent fallback", () => {
  const calendar = { timezone: "Asia/Shanghai", items: [
    { id: "old", date: "2026-10-26", status: "planned" },
    { id: "current", date: "2026-10-28", status: "planned" },
    { id: "future", date: "2026-10-30", status: "planned" },
  ]};
  const now = new Date("2026-10-27T17:00:00Z"); // 01:00 Beijing, 28 October
  assert.equal(resolveExactEpisode(calendar, "today", now, ["ru"]).id, "current");
  assert.equal(resolveExactEpisode(calendar, "2026-10-26", now, ["ru"]).id, "old");
  assert.equal(resolveExactEpisode(calendar, "old", now, ["ru"]).date, "2026-10-26");
  assert.equal(resolveExactEpisode(calendar, "today", now, ["ru"], new Set(["current"])).id, "future");
  assert.throws(() => resolveExactEpisode(calendar, "2026-10-26", now, ["ru"], new Set(["old"])), /duplicate/);
  assert.throws(() => resolveExactEpisode(calendar, "2026-10-29", now, ["ru"]));
});

test("probe requires both real audio and portrait video", () => {
  const good = { format: { duration: "4.5" }, streams: [
    { codec_type: "video", width: 1080, height: 1920 },
    { codec_type: "audio" },
  ]};
  assert.deepEqual(validateProbe(good), { width: 1080, height: 1920, durationSec: 4.5 });
  assert.throws(() => validateProbe({ ...good, streams: good.streams.slice(0, 1) }), /Invalid MP4/);
  assert.throws(() => validateProbe({ ...good, format: { duration: "0" } }), /Invalid MP4/);
  assert.throws(() => validateProbe({ ...good, streams: [{ codec_type: "video", width: 1920, height: 1080 }, { codec_type: "audio" }] }), /Invalid MP4/);
});

test("real MP4/SRT verifier stages RU Instagram/YouTube and TG Instagram without requiring TG YouTube", async () => {
  const id = "github-ci-review-verifier-test";
  const sourceDir = path.join(PROJECT_ROOT, "review", id);
  const exists = await fs.stat(sourceDir).then(() => true, () => false);
  assert.equal(exists, false, "Never overwrite an existing review folder");
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-ci-review-"));
  try {
    const mp4 = path.join(temp, "test.mp4");
    const ff = spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=black:s=360x640:r=30:d=3.5",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=24000:duration=3.5",
      "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k", mp4,
    ], { encoding: "utf8", timeout: 120000 });
    assert.equal(ff.status, 0, ff.stderr ?? ff.error?.message);
    const sha = createHash("sha256").update(await fs.readFile(mp4)).digest("hex");
    for (const language of ["ru", "tg"]) {
      await withLanguage(language, async () => {
        const platformPackages = {};
        for (const platform of language === "ru" ? ["instagram", "youtube"] : ["instagram"]) {
          const files = platformPackagePaths(id, platform);
          await fs.mkdir(files.folder, { recursive: true });
          await fs.copyFile(mp4, files.video);
          await fs.writeFile(files.captions, "1\n00:00:00,100 --> 00:00:01,000\nТест\n");
          await fs.writeFile(files.post, "Synthetic technical test only - NOT A REAL LESSON\n");
          platformPackages[platform] = { videoSha256: sha, ctaExperimentId: "fixture-v1", contentHash: "fixture-source" };
        }
        await writeStatus(id, { stage: "rendered-pending-owner-approval", platformPackages });
      });
    }
    const bundle = path.join(temp, "out");
    const manifest = await packageReview(id, ["ru", "tg"], bundle);
    assert.equal(manifest.publicationAuthorized, false);
    assert.equal(manifest.state, "rendered-pending-owner-approval");
    assert.deepEqual(Object.keys(manifest.languages), ["ru", "tg"]);
    assert.equal(manifest.languages.tg.instagram.sha256, sha);
    assert.deepEqual(Object.keys(manifest.languages.ru), ["instagram","youtube"]);
    assert.deepEqual(Object.keys(manifest.languages.tg), ["instagram"]);
    await assert.rejects(fs.stat(path.join(bundle,"tg","youtube","video.mp4")), {code:"ENOENT"});
    assert.equal(createHash("sha256").update(await fs.readFile(path.join(bundle, "ru", "instagram", "video.mp4"))).digest("hex"), sha);
    assert.equal((await fs.readFile(path.join(bundle, "manifest.json"), "utf8")).includes("published\": false"), true);
    // Hash tamper test: existing artifact must never be marked complete.
    await fs.appendFile(path.join(sourceDir, "tg", "instagram", "video.mp4"), "tamper");
    await assert.rejects(packageReview(id, ["ru", "tg"], path.join(temp, "unsafe")), /does not match/);
    await assert.rejects(fs.stat(path.join(temp, "unsafe", "manifest.json")), { code: "ENOENT" });
  } finally {
    await fs.rm(sourceDir, { recursive: true, force: true });
    await fs.rm(temp, { recursive: true, force: true });
  }
});
