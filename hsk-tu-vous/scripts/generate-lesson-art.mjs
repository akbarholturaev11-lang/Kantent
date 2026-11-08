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
import { PROJECT_ROOT } from "./lib.mjs";
import { redactCredentials } from "./video-credentials.mjs";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// Owner rule 2026-11-09: a drawn human never shows a recognizable face. It is
// appended to EVERY prompt here so no manifest can forget it. Aobao the panda
// is the only character with a visible face.
export const HUMAN_FACE_RULE = "PEOPLE RULE (mandatory): any human figure in the image must NOT show a recognizable face — the whole face area is strongly blurred like a privacy blur (soft, featureless, no eyes, nose or mouth visible), or the person is seen from behind. Hair, body, clothes and pose stay clear. This rule never applies to Aobao the panda.";
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
    if (asset.character !== undefined && asset.character !== "aobao-panda")
      throw new Error(asset.name + ": the only lesson character is aobao-panda (content/characters).");
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

async function generate({ apiKey, model, prompt, aspectRatio, referencePngs }) {
  const content = [{ type: "text", text: prompt },
    ...referencePngs.map((png) => ({ type: "image_url", image_url: { url: "data:image/png;base64," + png.toString("base64") } }))];
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], modalities: ["image", "text"],
      image_config: { aspect_ratio: aspectRatio } }),
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
    const file = path.join(outDir, asset.name + ".png");
    // The HSK AI panda is the only character: its canonical file is always
    // the first reference image and its identity text is part of the prompt.
    const character = asset.character ? JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "content", "characters", asset.character + ".json"), "utf8")) : null;
    const prompt = `${manifest.style}\n\n${HUMAN_FACE_RULE}\n\n${character ? `CHARACTER (first reference image, keep exactly): ${character.identity}\n\n` : ""}${asset.prompt}`;
    const exists = await fs.access(file).then(() => true, () => false);
    if (exists && !regenerate.has(asset.name)) {
      console.log(`kept ${asset.name}.png (saved image is never regenerated without --regenerate)`);
      continue;
    }
    const referencePngs = [
      ...(character ? [await fs.readFile(path.join(PROJECT_ROOT, character.reference))] : []),
      ...await Promise.all((asset.references ?? []).map((name) => fs.readFile(path.join(outDir, name + ".png")))),
    ];
    try {
      const result = await generate({ apiKey, model: manifest.model, prompt, aspectRatio: asset.aspectRatio, referencePngs });
      await fs.writeFile(file, result.bytes);
      provenance.assets[asset.name] = { file: asset.name + ".png", model: manifest.model, format: result.format,
        promptSha256: sha256(prompt), character: asset.character ?? null, references: asset.references ?? [], sha256: sha256(result.bytes),
        generationId: result.id, usage: result.usage, generatedAt: new Date().toISOString() };
      await fs.writeFile(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
      console.log(`generated ${asset.name}.png (${result.bytes.length} bytes, cost ${result.usage?.cost ?? "unknown"})`);
    } catch (error) {
      console.error(`FAILED ${asset.name}: ${redactCredentials(error?.message ?? String(error))}`);
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
