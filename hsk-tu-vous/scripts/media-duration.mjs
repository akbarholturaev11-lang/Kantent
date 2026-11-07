import { spawnSync } from "node:child_process";

export function readMediaDurationMs(filePath, {
  ffprobePath = "ffprobe",
  run = spawnSync,
} = {}) {
  const result = run(ffprobePath, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "json",
    filePath,
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`ffprobe could not read media duration: ${result.stderr || result.stdout || "unknown error"}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error("ffprobe returned invalid JSON while reading media duration.");
  }
  const seconds = Number(parsed?.format?.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("ffprobe returned no positive media duration.");
  }
  const milliseconds = Math.round(seconds * 1000);
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
    throw new Error("Media duration is outside the supported range.");
  }
  return milliseconds;
}
