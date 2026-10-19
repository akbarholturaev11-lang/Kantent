import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT, FPS, writeJson } from "./lib.mjs";
import { assertSharedLesson, sharedRenderRanges } from "./platform-exports.mjs";

function run(args) {
  const binary = path.join(PROJECT_ROOT, "node_modules", ".bin", "remotion");
  const result = spawnSync(binary, args, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `Media export failed (${result.status}): ${(result.stderr || result.stdout || "").slice(-5000)}`,
    );
  return result.stdout;
}

export async function verifyPlatformVideo(file, totalFrames, execute = run) {
  const metadata = JSON.parse(
    await execute([
      "ffprobe",
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name,codec_type,width,height,pix_fmt,color_space,r_frame_rate,nb_frames,duration:format=duration",
      "-of",
      "json",
      file,
    ]),
  );
  const video = metadata.streams?.find(
    (stream) => stream.codec_type === "video",
  );
  const audio = metadata.streams?.find(
    (stream) => stream.codec_type === "audio",
  );
  if (
    !video ||
    !audio ||
    video.codec_name !== "h264" ||
    audio.codec_name !== "aac" ||
    video.width !== 1080 ||
    video.height !== 1920 ||
    video.pix_fmt !== "yuv420p" ||
    video.color_space !== "bt709" ||
    video.r_frame_rate !== `${FPS}/1` ||
    Number(video.nb_frames) !== totalFrames ||
    !Number.isFinite(Number(video.duration)) ||
    !Number.isFinite(Number(audio.duration)) ||
    Math.abs(Number(video.duration) - totalFrames / FPS) > 1 / FPS ||
    Math.abs(Number(audio.duration) - Number(video.duration)) > 0.1
  )
    throw new Error(
      "Encoded platform video failed resolution, frame-count or audio-duration checks.",
    );
  return metadata;
}

/** Render the lesson once, two visual endings, and one continuous audio mix.
 * Concatenation copies the same encoded lesson frames into both final videos.
 * Audio is muxed once per final file, so the CTA join never splits speech/AAC.
 */
export async function renderSharedPlatformVideos({
  episodes,
  outputs,
  workDir,
  renderOptions = [],
  semanticTimeline = null,
  execute = run,
  log = console.log,
}) {
  const base = episodes.instagram;
  const ranges = sharedRenderRanges(base);
  for (const episode of Object.values(episodes))
    assertSharedLesson(base, episode);
  await fs.mkdir(workDir, { recursive: true });
  const props = {};
  for (const [platform, episode] of Object.entries(episodes)) {
    props[platform] = path.join(workDir, `${platform}-props.json`);
    // Platform-specific CTA differs, but assertSharedLesson already proves
    // narration/timing/lesson body matches the single exact-cue timeline.
    await writeJson(props[platform], { episode, ...(semanticTimeline ? {semanticTimeline} : {}) });
  }
  const browser = process.env.HSK_REMOTION_BROWSER_EXECUTABLE
    ? ["--browser-executable", process.env.HSK_REMOTION_BROWSER_EXECUTABLE]
    : [];
  const render = (platform, output, options) =>
    execute([
      "render",
      "src/index.ts",
      "HSKAI-Episode",
      output,
      "--props",
      props[platform],
      ...options,
      ...browser,
      ...renderOptions,
    ]);
  const videoOptions = [
    "--codec",
    "h264",
    "--image-format",
    "png",
    "--pixel-format",
    "yuv420p",
    "--color-space",
    "bt709",
    "--muted",
  ];
  const body = path.join(workDir, "shared-lesson.mp4");
  const audio = path.join(workDir, "shared-audio.aac");
  log("Rendering shared lesson once...");
  await render("instagram", body, [
    ...videoOptions,
    "--frames",
    ranges.body.join("-"),
  ]);
  log("Rendering continuous shared voice and sound mix...");
  await render("instagram", audio, ["--codec", "aac"]);
  for (const platform of Object.keys(episodes)) {
    log(`Rendering ${platform} CTA ending...`);
    const ending = path.join(workDir, `${platform}-ending.mp4`);
    await render(platform, ending, [
      ...videoOptions,
      "--frames",
      ranges.ending.join("-"),
    ]);
    const list = path.join(workDir, `${platform}-concat.txt`);
    // Relative filenames avoid FFmpeg quoting problems with workspace paths.
    await fs.writeFile(
      list,
      `file 'shared-lesson.mp4'\nfile '${platform}-ending.mp4'\n`,
    );
    await fs.mkdir(path.dirname(outputs[platform]), { recursive: true });
    await execute([
      "ffmpeg",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-i",
      audio,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c",
      "copy",
      "-t",
      String(ranges.totalFrames / FPS),
      "-movflags",
      "+faststart",
      outputs[platform],
    ]);
    await verifyPlatformVideo(outputs[platform], ranges.totalFrames, execute);
  }
  await fs.rm(workDir, { recursive: true, force: true });
  return ranges;
}
