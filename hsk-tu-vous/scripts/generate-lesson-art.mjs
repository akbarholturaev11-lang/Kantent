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

async function main() {
  const [episodeId, ...options] = process.argv.slice(2);
  if (!episodeId) throw new Error("Use: node scripts/generate-lesson-art.mjs <episode-id> [--regenerate <name>]");
  const regenerate = new Set();
  for (let i = 0; i < options.length; i += 1) {
    if (options[i] === "--regenerate" && options[i + 1]) regenerate.add(options[++i]);
    else throw new Error("Unknown option " + options[i]);
  }
  const manifest = validateArtManifest(JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "content", "lesson-art", episodeId + ".json"), "utf8")));
  if (typeof process.loadEnvFile === "function" && !process.env.OPENROUTER_API_KEY) {
    try { process.loadEnvFile(path.join(PROJECT_ROOT, ".env.local")); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for lesson art.");
  const outDir = path.join(PROJECT_ROOT, "public", "lesson-art", episodeId);
  await fs.mkdir(outDir, { recursive: true });
  const provenancePath = path.join(outDir, "provenance.json");
  let provenance = { episodeId, assets: {} };
  try { provenance = JSON.parse(await fs.readFile(provenancePath, "utf8")); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  for (const asset of manifest.assets) {
    const file = path.join(outDir, asset.name + ".jpg");
    // HSK AI characters only: each shown character's registry PNG is a
    // reference image (in order) and its identity text is part of the prompt.
    const characters = await loadCharacters(asset.characters ?? []);
    const cast = characters.map((c, index) => `CHARACTER ${index + 1} (reference image ${index + 1}, keep exactly): ${c.identity}`).join("\n");
    const prompt = `${manifest.style}\n\n${HUMAN_FACE_RULE}\n\n${cast ? cast + "\n\n" : ""}${asset.prompt}`;
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
        promptSha256: sha256(prompt), characters: asset.characters ?? [], references: asset.references ?? [], sha256: sha256(result.bytes),
        generationId: result.id, usage: result.usage, generatedAt: new Date().toISOString() };
      await fs.writeFile(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
      console.log(`generated ${asset.name}.jpg (${result.bytes.length} bytes, cost ${result.usage?.cost ?? "unknown"})`);
    } catch (error) {
      console.error(`FAILED ${asset.name}: ${redactCredentials(error?.message ?? String(error))}`);
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
