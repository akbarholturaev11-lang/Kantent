import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hanzi = /^\p{Script=Han}{1,8}$/u;
const clean = (text) => String(text ?? "").replace(/\s+/gu, " ").trim();
const artName = /^[a-z][a-z0-9-]{1,40}$/;
const lessonArt = (id, name) => `lesson-art/${id}/${name}.jpg`;

/** Pick one real scene and one compact teaching contrast, never a CTA. */
export function planVideoCover(episode) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(episode.id ?? ""))
    throw new Error("Invalid cover episode ID.");
  const scenes = episode.scenes.filter((scene) => scene.kind !== "cta");
  const illustrations = scenes.flatMap(scene => (scene.motionBeats ?? [])
    .map(beat => beat.visual?.illustration).filter(Boolean));
  const imagesOf = (ill) => Array.isArray(ill?.images) && ill.images.every(name => artName.test(name))
    ? ill.images.map(name => lessonArt(episode.id, name)) : [];
  const pair = illustrations.find(ill => ill.layout === "pair" && imagesOf(ill).length === 2);
  const sceneArt = illustrations.find(ill => ill.layout !== "pair" && imagesOf(ill).length);
  const promoArt = scenes.map(s => s.promoVisual?.assetPath)
    .find(src => /^public\/promo-art\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:jpg|png)$/u.test(src ?? ""));
  const isPromo = episode.kind === "advertisement";
  const headline = clean(isPromo ? episode.title : scenes[0]?.headline);
  const title = headline && [...headline].length <= 52 ? headline : clean(episode.title);
  if (!title) throw new Error("Cover requires a title in the episode language.");

  const cardGroups = scenes.map(s => [...new Set((s.cards ?? [])
    .map(card => clean(card.hanzi)).filter(text => hanzi.test(text)))]);
  const comparison = cardGroups.find(group => group.length === 2 && group.every(text => [...text].length <= 4));
  const primary = cardGroups.flat().find(Boolean) ?? scenes.flatMap(s => (s.motionBeats ?? [])
    .map(beat => clean(beat.visual?.hanzi))).find(text => hanzi.test(text));
  const terms = isPromo ? [] : comparison ?? (primary ? [primary] : []);
  const images = pair ? imagesOf(pair) : sceneArt ? imagesOf(sceneArt) : [];
  const background = imagesOf(sceneArt)[0] ?? (promoArt ? promoArt.slice(7) : images[0]) ?? null;
  return { title, terms, images: pair ? images : [], background,
    pandaMood: !isPromo && (images.length > 0 || terms.length > 0)
      ? (pair ? "dismissive" : title.endsWith("?") ? "talk" : "proud")
      : null };
}

const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export async function verifyVideoCover(filename, expectedHash) {
  if (!/^[a-f0-9]{64}$/u.test(expectedHash ?? ""))
    throw new Error("Missing cover hash. Generate and review the cover again.");
  const actual = digest(await fs.readFile(filename));
  if (actual !== expectedHash) throw new Error("Review cover changed. Generate and review it again.");
  return actual;
}

/** Render a still through the same bundled browser used for production video. */
export async function renderVideoCover({ episode, video, output }) {
  const plan = planVideoCover(episode);
  const work = await fs.mkdtemp(path.join(path.dirname(output), ".cover-"));
  const run = (executable, args) => {
    const proc = spawnSync(executable, args, { cwd: root, encoding: "utf8" });
    if (proc.error) throw proc.error;
    if (proc.status !== 0) throw new Error("Cover render failed: " + (proc.stderr || proc.stdout || executable).slice(-2500));
  };
  try {
    for (const asset of new Set([plan.background, ...plan.images].filter(Boolean)))
      await fs.access(path.join(root, "public", asset));
    if (!plan.background) {
      // Use an actual teaching frame for legacy drawings or promos without
      // separate illustration files. Skip openings and stay before the CTA.
      const scene = episode.scenes.find(s => s.kind !== "hook" && s.kind !== "cta") ?? episode.scenes[0];
      const start = (scene.startMs ?? 0) / 1000;
      const end = (scene.endMs ?? (start + 1) * 1000) / 1000;
      const frame = path.join(work, "context.jpg");
      run("ffmpeg", ["-nostdin", "-v", "error", "-ss", String(start + (end - start) / 2), "-i", video,
        "-frames:v", "1", "-vf", "crop=iw:ih*0.55:0:ih*0.17,scale=540:-2", frame]);
      plan.frameData = "data:image/jpeg;base64," + (await fs.readFile(frame)).toString("base64");
    }
    const props = path.join(work, "props.json");
    await fs.writeFile(props, JSON.stringify(plan));
    const temp = path.join(work, "cover.jpg");
    const browser = process.env.HSK_REMOTION_BROWSER_EXECUTABLE;
    run(path.join(root, "node_modules", ".bin", "remotion"), [
      "still", "src/cover-entry.tsx", "HSKAI-Cover", temp, "--props", props,
      "--image-format", "jpeg", "--jpeg-quality", "95", "--log", "error",
      ...(browser ? ["--browser-executable", browser] : []),
    ]);
    const bytes = await fs.readFile(temp);
    if (bytes.length < 8000 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
      throw new Error("Cover export is not a valid JPEG.");
    await fs.rename(temp, output);
    return { cover: output, coverSha256: digest(bytes) };
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}
