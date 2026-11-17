/**
 * Loudness and true-peak check of a final video mix (professional-motion
 * lessons, content/EDITING_SPEC.md#professional-motion-system item 10).
 * Uses ffmpeg's EBU R128 meter; fails when the true peak is above the
 * ceiling in content/visual-system.json#proMotion.sound.maxTruePeakDbtp.
 *
 *   node scripts/mix-check.mjs review/<id>/youtube/<file>.mp4 [...more]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Parse the summary block that ffmpeg's ebur128 filter prints at the end. */
export function parseEbur128Summary(log) {
  const summary = String(log).split("Summary:").at(-1) ?? "";
  const number = (pattern) => {
    const match = summary.match(pattern);
    return match ? Number(match[1]) : null;
  };
  return {
    integratedLufs: number(/I:\s+(-?[\d.]+|-inf)\s+LUFS/),
    loudnessRangeLu: number(/LRA:\s+(-?[\d.]+)\s+LU/),
    truePeakDbtp: number(/True peak:\s+Peak:\s+(-?[\d.]+|-inf)\s+dBFS/),
  };
}

export function checkMix(file, maxTruePeakDbtp) {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw Error(file + ": ffmpeg could not measure the audio track.\n" + run.stderr.slice(-800));
  const result = parseEbur128Summary(run.stderr);
  if (result.truePeakDbtp === null || result.integratedLufs === null) throw Error(file + ": no EBU R128 summary in ffmpeg output.");
  return { file, ...result, maxTruePeakDbtp, ok: result.truePeakDbtp <= maxTruePeakDbtp };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("Usage: node scripts/mix-check.mjs <video.mp4> [...]"); process.exit(2); }
  const visual = JSON.parse(fs.readFileSync(new URL("../content/visual-system.json", import.meta.url), "utf8"));
  const ceiling = visual.proMotion.sound.maxTruePeakDbtp;
  const results = files.map((file) => checkMix(file, ceiling));
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => !result.ok)) process.exit(1);
}
