#!/usr/bin/env node
/**
 * Lesson illustrations for the illustrated-glass lesson format (owner
 * decision 2026-11-09, references: illustrated explainer reels).
 *
 * Reads content/lesson-art/<episode-id>.json, generates each missing image
 * once through OpenRouter (image-output model named in the manifest), and
 * writes public/lesson-art/<episode-id>/<name>.png plus provenance.json
 * (model, prompt hash, sha256, cost). Existing images are never regenerated
 * unless --regenerate <name> is passed explicitly. Images contain no text, so
 * every language reuses them. The API key is never printed or stored.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { PROJECT_ROOT } from "./lib.mjs";
import { redactCredentials } from "./video-credentials.mjs";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// Owner rules 2026-11-09, appended to EVERY prompt so no manifest can forget
// them: characters come only from the HSK AI registry; no human is drawn as a
// character, and any unavoidable distant figure shows no recognizable face.
export const HUMAN_FACE_RULE = "CHARACTER RULE (mandatory): the only characters allowed are the HSK AI characters given as reference images (panda, dragon Longlong, crane Hehe, monkey Wuwu, rabbit Yueyue), drawn exactly as their references. Do not draw any human as a character and do not invent any other creature or mascot. If a distant human figure is unavoidable in the background, it must not show a recognizable face (privacy-blurred, featureless, or seen from behind).";
const CHARACTER_REGISTRY = path.join(PROJECT_ROOT, "content", "characters", "hsk-ai-characters.json");
export async function loadCharacters(ids) {
  if (!ids.length) return [];
  const registry = JSON.parse(await fs.readFile(CHARACTER_REGISTRY, "utf8"));
  return ids.map((id) => {
    const [characterId, mood = "idle"] = String(id).split(":");
    const character = registry.characters.find((entry) => entry.id === characterId);
    if (!character) throw new Error(`Unknown character "${characterId}"; use only content/characters/hsk-ai-characters.json.`);
    if (!registry.moods.includes(mood)) throw new Error(`Unknown mood "${mood}" for ${characterId}.`);
    return { ...character, mood, file: path.join("content", "characters", `${characterId}-${mood}.png`) };
  });
}
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function validateArtManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw new Error("Lesson art manifest is required.");
  if (!/^[a-z0-9-]+$/.test(manifest.episodeId ?? "")) throw new Error("Lesson art needs an episodeId.");
  if (typeof manifest.model !== "string" || !manifest.model.includes("/")) throw new Error("Lesson art needs an OpenRouter model id.");
  if (typeof manifest.style !== "string" || manifest.style.length < 40) throw new Error("Lesson art needs a shared style prompt.");
  const names = new Set();
  for (const asset of manifest.assets ?? []) {
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(asset.name ?? "") || names.has(asset.name))
      throw new Error("Each lesson art asset needs a unique kebab-case name.");
    names.add(asset.name);
    if (typeof asset.prompt !== "string" || asset.prompt.length < 30) throw new Error(asset.name + ": prompt is too short.");
    if (!["9:16", "1:1", "4:5", "16:9"].includes(asset.aspectRatio)) throw new Error(asset.name + ": unsupported aspect ratio.");
    if (asset.characters !== undefined && (!Array.isArray(asset.characters) || asset.characters.some((id) => !/^[a-z]+(:[a-z-]+)?$/.test(id))))
      throw new Error(asset.name + ": characters are registry ids like \"panda\" or \"crane:celebrate\" (content/characters/hsk-ai-characters.json).");
    if (asset.character !== undefined) throw new Error(asset.name + ": use \"characters\": [ids] from the HSK AI registry.");
    for (const reference of asset.references ?? [])
      if (!names.has(reference)) throw new Error(asset.name + ": a reference must be an earlier asset.");
    for (const [id, box] of Object.entries(asset.anchors ?? {})) {
      if (!/^[a-z][a-z0-9-]*$/.test(id) || !["x", "y", "w", "h"].every((key) => Number.isFinite(box[key]) && box[key] >= 0 && box[key] <= 1))
        throw new Error(asset.name + ": anchors are normalized {x,y,w,h} boxes.");
    }
  }
  if (!names.size) throw new Error("Lesson art manifest has no assets.");
  return manifest;
}

async function generate({ apiKey, model, prompt, aspectRatio, referencePngs, imageSize = "2K" }) {
  const content = [{ type: "text", text: prompt },
    ...referencePngs.map((png) => ({ type: "image_url", image_url: { url: "data:image/png;base64," + png.toString("base64") } }))];
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], modalities: ["image", "text"],
      image_config: { aspect_ratio: aspectRatio, image_size: imageSize } }),
    signal: AbortSignal.timeout(180_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenRouter image generation failed (HTTP ${response.status}): ${data?.error?.message ?? ""}`);
  const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const match = typeof url === "string" ? url.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/) : null;
  if (!match) throw new Error("OpenRouter returned no image.");
  return { bytes: Buffer.from(match[2], "base64"), format: match[1], usage: data.usage ?? null, id: data.id ?? null };
}

/** The full prompt a frame is generated from (same for Codex and the paid fallback). */
export async function framePrompt(manifest, asset) {
  const characters = await loadCharacters(asset.characters ?? []);
  const cast = characters.map((c, index) => `CHARACTER ${index + 1} (reference image ${index + 1}, keep exactly): ${c.identity}`).join("\n");
  return { prompt: `${manifest.style}\n\n${HUMAN_FACE_RULE}\n\n${cast ? cast + "\n\n" : ""}${asset.prompt}`, characters };
}

/** Exact, self-contained instructions for Codex to generate the missing frames. */
export async function writeCodexBrief({ episodeId, manifest, outDir }) {
  const missing = [];
  for (const asset of manifest.assets) {
    const file = path.join(outDir, asset.name + ".jpg");
    if (await fs.access(file).then(() => true, () => false)) continue;
    const { prompt, characters } = await framePrompt(manifest, asset);
    missing.push({ asset, file, prompt, references: [...characters.map((c) => c.file),
      ...(asset.references ?? []).map((name) => path.relative(PROJECT_ROOT, path.join(outDir, name + ".jpg")))] });
  }
  const lines = [`# Codex frame brief — ${episodeId}`, "",
    "Generate each frame below with Codex's own image generation (no paid API). Rules: content/EDITING_SPEC.md#illustrated-glass-lesson-format.",
    "- Text-free backgrounds: no letters, no people, no characters (characters are drawn later from content/characters/hsk-ai-characters.json).",
    "- Highest available resolution, at least 1500 px on the long side, exact aspect ratio; save as JPEG (quality ≥ 90) at the given path.",
    "- Use each listed reference image for continuity. Generate in the listed order (later frames reference earlier ones).",
    `- After saving each frame run: node scripts/generate-lesson-art.mjs ${episodeId} --record-codex <name>`,
    `- Then run: node scripts/review-lesson-art.mjs ${episodeId} and fix every failure before rendering.`, ""];
  for (const item of missing) lines.push(`## ${item.asset.name}`, "", `- Save to: \`${path.relative(PROJECT_ROOT, item.file)}\``,
    `- Aspect ratio: ${item.asset.aspectRatio}`, `- References: ${item.references.length ? item.references.map((r) => "`" + r + "`").join(", ") : "none"}`,
    "", "```text", item.prompt, "```", "");
  if (!missing.length) lines.push("All frames exist.");
  const file = path.join(PROJECT_ROOT, "review", episodeId, "lesson-art-codex-brief.md");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, lines.join("\n") + "\n");
  return { file, missing };
}

async function recordCodexFrames({ episodeId, manifest, outDir, names }) {
  const provenancePath = path.join(outDir, "provenance.json");
  let provenance = { episodeId, assets: {} };
  try { provenance = JSON.parse(await fs.readFile(provenancePath, "utf8")); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  for (const name of names) {
    const asset = manifest.assets.find((entry) => entry.name === name);
    if (!asset) throw new Error(`${name} is not in content/lesson-art/${episodeId}.json`);
    const bytes = await fs.readFile(path.join(outDir, name + ".jpg"));
    const { prompt } = await framePrompt(manifest, asset);
    provenance.assets[name] = { file: name + ".jpg", provider: "codex", promptSha256: sha256(prompt),
      characters: asset.characters ?? [], references: asset.references ?? [], sha256: sha256(bytes), recordedAt: new Date().toISOString() };
    console.log(`recorded ${name}.jpg as a Codex frame`);
  }
  await fs.writeFile(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
}

async function main() {
  const [episodeId, ...options] = process.argv.slice(2);
  if (!episodeId) throw new Error("Use: node scripts/generate-lesson-art.mjs <episode-id> [--paid] [--regenerate <name>] [--record-codex <name>]");
  const regenerate = new Set();
  const recordCodex = new Set();
  let paid = false;
  for (let i = 0; i < options.length; i += 1) {
    if (options[i] === "--regenerate" && options[i + 1]) regenerate.add(options[++i]);
    else if (options[i] === "--record-codex" && options[i + 1]) recordCodex.add(options[++i]);
    else if (options[i] === "--paid") paid = true;
    else throw new Error("Unknown option " + options[i]);
  }
  const manifest = validateArtManifest(JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "content", "lesson-art", episodeId + ".json"), "utf8")));
  const outDir = path.join(PROJECT_ROOT, "public", "lesson-art", episodeId);
  // Owner decision 2026-11-09: frames are a CODEX task. Without --paid this
  // script never calls an image API; it writes the exact Codex brief for the
  // missing frames, or records frames Codex has saved (--record-codex).
  if (!paid) {
    await fs.mkdir(outDir, { recursive: true });
    if (recordCodex.size) return recordCodexFrames({ episodeId, manifest, outDir, names: recordCodex });
    const brief = await writeCodexBrief({ episodeId, manifest, outDir });
    console.log(brief.missing.length
      ? `${brief.missing.length} frame(s) missing — Codex must generate them: ${path.relative(PROJECT_ROOT, brief.file)}`
      : "All frames exist. Run node scripts/review-lesson-art.mjs " + episodeId);
    if (brief.missing.length) process.exitCode = 3;
    return;
  }
  if (typeof process.loadEnvFile === "function" && !process.env.OPENROUTER_API_KEY) {
    try { process.loadEnvFile(path.join(PROJECT_ROOT, ".env.local")); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for the paid --paid fallback.");
  await fs.mkdir(outDir, { recursive: true });
  const provenancePath = path.join(outDir, "provenance.json");
  let provenance = { episodeId, assets: {} };
  try { provenance = JSON.parse(await fs.readFile(provenancePath, "utf8")); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  for (const asset of manifest.assets) {
    const file = path.join(outDir, asset.name + ".jpg");
    // Same prompt as the Codex brief; character references first, in order.
    const { prompt, characters } = await framePrompt(manifest, asset);
    const exists = await fs.access(file).then(() => true, () => false);
    if (exists && !regenerate.has(asset.name)) {
      console.log(`kept ${asset.name}.jpg (saved image is never regenerated without --regenerate)`);
      continue;
    }
    const referencePngs = [
      ...await Promise.all(characters.map((c) => fs.readFile(path.join(PROJECT_ROOT, c.file)))),
      ...await Promise.all((asset.references ?? []).map((name) => fs.readFile(path.join(outDir, name + ".jpg")))),
    ];
    try {
      const result = await generate({ apiKey, model: manifest.model, prompt, aspectRatio: asset.aspectRatio, referencePngs });
      // Stored as high-quality JPEG (2K art would be ~6 MB as PNG in git).
      const rawFile = path.join(outDir, asset.name + ".raw." + (result.format === "jpeg" ? "jpg" : result.format));
      await fs.writeFile(rawFile, result.bytes);
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", rawFile, "-q:v", "2", file]);
      await fs.rm(rawFile, { force: true });
      provenance.assets[asset.name] = { file: asset.name + ".jpg", provider: "openrouter", model: manifest.model, format: result.format,
        promptSha256: sha256(prompt), characters: asset.characters ?? [], references: asset.references ?? [], sha256: sha256(await fs.readFile(file)), rawSha256: sha256(result.bytes),
        generationId: result.id, usage: result.usage, generatedAt: new Date().toISOString() };
      await fs.writeFile(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
      console.log(`generated ${asset.name}.jpg (${(await fs.stat(file)).size} bytes, cost ${result.usage?.cost ?? "unknown"})`);
    } catch (error) {
      console.error(`FAILED ${asset.name}: ${redactCredentials(error?.message ?? String(error))}`);
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
