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

/**
 * The importer and every renderer spawn `ffmpeg`/`ffprobe` from PATH, while
 * the voice generator can fall back to Remotion's bundled binaries. Check the
 * system tools BEFORE any paid TTS so a missing dependency cannot surface
 * only after the take was bought (import/render would then fail with ENOENT).
 */
export function requireSystemMediaTools({ run = spawnSync } = {}) {
  const missing = ["ffmpeg", "ffprobe"].filter((command) => {
    const result = run(command, ["-version"], { stdio: "ignore" });
    return Boolean(result.error) || result.status !== 0;
  });
  if (missing.length)
    throw new Error(`Import and render need system ${missing.join(" and ")} on PATH; install before voice generation. No paid TTS/STT request was made.`);
}
