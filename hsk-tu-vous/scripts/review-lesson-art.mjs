#!/usr/bin/env node
/**
 * Lesson-art review service (owner decision 2026-11-09): every frame is
 * checked against the illustrated-glass requirements before rendering.
 *
 * Automated (fail closed): file present, JPEG, resolution, aspect ratio, not
 * blank, provenance recorded with matching SHA-256 and current prompt hash,
 * every beat's images/icons exist, cast only from the HSK AI registry and
 * inside the frame, anchors inside the image, the subtitle slot of every beat
 * covers no face/card/formula.
 *
 * Visual (an agent that LOOKED at each frame confirms it, bound to the frame
 * hash): text-free, no people, no baked-in characters, matches its prompt and
 * the continuity of its references, professional quality.
 *
 * Writes review/<episode-id>/lesson-art-review.json. render-episode refuses an
 * illustrated lesson whose current frames have no passing review.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "./lib.mjs";
import { framePrompt, validateArtManifest } from "./generate-lesson-art.mjs";
import { validateIllustration } from "./action-design-plan.mjs";
import { blockedBoxes, subtitleSlotFor } from "./illustrated-layout.mjs";

export const VISUAL_CHECKS = [
  "text-free: no letters, numbers, signs with writing, logos or watermarks",
  "no people (or only a distant figure with no recognizable face)",
  "no character baked in; HSK AI characters are drawn later from the registry",
  "shows what its prompt asks for, at the right time of day/season/place",
  "continuity with its reference frames (same place, style and palette)",
  "professional quality: sharp, no warped geometry, no artifacts, clean composition with room for the cast",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ratio = (value) => { const [w, h] = value.split(":").map(Number); return w / h; };

function probe(file) {
  const [w, h] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file])
    .toString().trim().split(",").map(Number);
  const gray = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-i", file, "-vf", "scale=32:32,format=gray", "-f", "rawvideo", "-"]);
  const mean = gray.reduce((a, b) => a + b, 0) / gray.length;
  const sd = Math.sqrt(gray.reduce((a, b) => a + (b - mean) ** 2, 0) / gray.length);
  return { width: w, height: h, lumaStdDev: Math.round(sd * 10) / 10 };
}

export async function reviewLessonArt(episodeId, { episode = null, confirmVisual = null } = {}) {
  const manifest = validateArtManifest(JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "content", "lesson-art", episodeId + ".json"), "utf8")));
  const dir = path.join(PROJECT_ROOT, "public", "lesson-art", episodeId);
  let provenance = { assets: {} };
  try { provenance = JSON.parse(await fs.readFile(path.join(dir, "provenance.json"), "utf8")); } catch { /* reported per frame */ }
  const reviewPath = path.join(PROJECT_ROOT, "review", episodeId, "lesson-art-review.json");
  let previous = null;
  try { previous = JSON.parse(await fs.readFile(reviewPath, "utf8")); } catch { /* first review */ }
  const frames = [];
  for (const asset of manifest.assets) {
    const file = path.join(dir, asset.name + ".jpg");
    const failures = [];
    let bytes = null;
    try { bytes = await fs.readFile(file); } catch { failures.push("missing file " + path.relative(PROJECT_ROOT, file)); }
    const frame = { name: asset.name, failures };
    if (bytes) {
      frame.sha256 = sha256(bytes);
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8) failures.push("not a JPEG");
      const info = probe(file);
      Object.assign(frame, info);
      const minLong = asset.aspectRatio === "1:1" ? 512 : 1500;
      if (Math.max(info.width, info.height) < minLong) failures.push(`resolution ${info.width}x${info.height} is below ${minLong} px on the long side`);
      if (Math.abs(info.width / info.height - ratio(asset.aspectRatio)) > 0.03) failures.push(`aspect ${info.width}x${info.height} does not match ${asset.aspectRatio}`);
      if (info.lumaStdDev < 8) failures.push("frame is blank or near-flat");
      const record = provenance.assets?.[asset.name];
      if (!record) failures.push("no provenance record (run --record-codex after Codex saves it)");
      else {
        if (record.sha256 !== frame.sha256) failures.push("provenance SHA-256 does not match the file");
        const { prompt } = await framePrompt(manifest, asset);
        if (record.promptSha256 && record.promptSha256 !== sha256(Buffer.from(prompt))) failures.push("prompt changed since this frame was made (stale frame)");
        frame.provider = record.provider ?? "unknown";
      }
      const visual = confirmVisual?.has(asset.name) ? { by: confirmVisual.get(asset.name), sha256: frame.sha256, at: new Date().toISOString() }
        : previous?.frames?.find((f) => f.name === asset.name && f.visual?.sha256 === frame.sha256)?.visual;
      if (visual) frame.visual = visual;
    }
    frames.push(frame);
  }
  const beats = [];
  if (episode) {
    const names = new Set(manifest.assets.map((a) => a.name));
    for (const scene of episode.scenes ?? []) for (const beat of scene.motionBeats ?? []) {
      const ill = beat.visual?.illustration;
      if (!ill) continue;
      const failures = [];
      try { validateIllustration(beat.id, ill); } catch (error) { failures.push(error.message); }
      for (const name of [...ill.images, ...(ill.icons ?? []).filter(Boolean)]) if (!names.has(name)) failures.push(`uses ${name}, which is not in the lesson-art manifest`);
      for (const member of ill.cast ?? []) if (member.y - member.h < 0 || member.x < 0 || member.x > 1) failures.push(`${member.id} is placed outside the frame`);
      const slot = subtitleSlotFor(ill);
      const covered = blockedBoxes(ill).some((box) => !(slot.right <= box.x0 || slot.left >= box.x1 || slot.top + slot.height <= box.y0 || slot.top >= box.y1));
      if (covered) failures.push("no subtitle slot is free of faces/cards/formula");
      beats.push({ id: beat.id, failures });
    }
  }
  const automatedPass = frames.every((f) => !f.failures.length) && beats.every((b) => !b.failures.length);
  const visualPass = frames.every((f) => f.visual);
  const result = { episodeId, reviewedAt: new Date().toISOString(), automatedPass, visualPass, pass: automatedPass && visualPass,
    visualChecks: VISUAL_CHECKS, frames, beats };
  await fs.mkdir(path.dirname(reviewPath), { recursive: true });
  await fs.writeFile(reviewPath, JSON.stringify(result, null, 2) + "\n");
  return result;
}

/** Render gate: the illustrated lesson's current frames have a passing review. */
export async function assertLessonArtReviewed(episode) {
  const uses = (episode.scenes ?? []).some((s) => (s.motionBeats ?? []).some((b) => b.visual?.illustration));
  if (!uses) return null;
  const result = await reviewLessonArt(episode.id, { episode });
  if (!result.pass) {
    const problems = [...result.frames.flatMap((f) => f.failures.map((x) => `${f.name}: ${x}`)),
      ...result.beats.flatMap((b) => b.failures.map((x) => `${b.id}: ${x}`)),
      ...result.frames.filter((f) => !f.visual).map((f) => `${f.name}: visual check not confirmed for this exact frame`)];
    throw new Error("Lesson-art review failed (review/" + episode.id + "/lesson-art-review.json):\n- " + problems.join("\n- "));
  }
  return result;
}

async function main() {
  const [episodeId, ...options] = process.argv.slice(2);
  if (!episodeId) throw new Error("Use: node scripts/review-lesson-art.mjs <episode-id> [--confirm-visual <name> \"<what you checked>\"]...");
  const confirm = new Map();
  for (let i = 0; i < options.length; i += 1) {
    if (options[i] === "--confirm-visual" && options[i + 1] && options[i + 2]) confirm.set(options[i + 1], options[i + 2]), i += 2;
    else throw new Error("Unknown option " + options[i]);
  }
  let episode = null;
  for (const file of [path.join(PROJECT_ROOT, "review", episodeId, "episode.json"), path.join(PROJECT_ROOT, "content", "episodes", episodeId + ".json")]) {
    try { episode = JSON.parse(await fs.readFile(file, "utf8")); break; } catch { /* next */ }
  }
  const result = await reviewLessonArt(episodeId, { episode, confirmVisual: confirm });
  for (const f of result.frames) console.log(`${f.failures.length ? "FAIL" : "ok  "} ${f.name} ${f.width ?? "?"}x${f.height ?? "?"} ${f.provider ?? ""}${f.visual ? " visual✓" : " visual pending"}${f.failures.length ? " — " + f.failures.join("; ") : ""}`);
  for (const b of result.beats.filter((x) => x.failures.length)) console.log(`FAIL ${b.id} — ${b.failures.join("; ")}`);
  console.log(result.pass ? "PASS" : result.automatedPass ? "Automated checks pass; confirm the visual checks after LOOKING at each frame:\n- " + VISUAL_CHECKS.join("\n- ") : "FAIL");
  if (!result.pass) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
