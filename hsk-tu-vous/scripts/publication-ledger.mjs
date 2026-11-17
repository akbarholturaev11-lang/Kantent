/**
 * Durable video ↔ script ↔ publication ledger (owner 2026-11-17, content/EXPERIMENTS.md).
 *
 * The verified local publication receipts live in the git-ignored review packages
 * (review/<id>/[<lang>/]publications.json). This module copies each verified
 * Zernio result into the tracked registry content/feedback/publications.json
 * together with what was published: content identity, exact video hash, CTA
 * version and the creative record (script, hook, storytelling, visual style,
 * experiment arm and the brief it was written from). Observations are then
 * joined to it by the Zernio post ID (scripts/content-attribution.mjs), so a
 * result is never matched by date, title or thumbnail.
 *
 *   node scripts/publication-ledger.mjs          dry run: what would be added / updated
 *   node scripts/publication-ledger.mjs --write  write the registry
 *
 * It never invents a field: a receipt without a verified Zernio ID, approval,
 * content identity or video hash is reported and skipped.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TRACKED_PLATFORMS, normalizeUsername, validatePublicationMapping } from "./content-attribution.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const LEDGER_PATH = "content/feedback/publications.json";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const tryJson = (file) => { try { return readJson(file); } catch { return null; } };

/** The narration a viewer heard, in scene order (the script fingerprint). */
export function scriptText(episode) {
  return (episode?.scenes ?? []).map((scene) => `${scene.id}: ${scene.narration ?? ""}`).join("\n");
}

/** What was published, as a creative record (null fields stay null: never guessed). */
export function creativeRecord(episode, experiments = null) {
  const experiment = episode?.experiment ?? null;
  const arm = experiment && experiments?.experiments?.find((item) => item.id === experiment.id)
    ?.arms?.find((item) => item.id === experiment.arm);
  const hookScene = episode?.scenes?.find((scene) => scene.kind === "hook") ?? episode?.scenes?.[0] ?? null;
  return {
    experimentId: experiment?.id ?? null,
    arm: experiment?.arm ?? null,
    promptSha256: arm?.scriptBrief ? sha(arm.scriptBrief) : null,
    hookId: episode?.hookExperiment?.id ?? null,
    hookFormat: episode?.hookExperiment?.formatId ?? null,
    hookText: hookScene?.narration ?? null,
    storytellingPattern: episode?.storytelling?.pattern ?? null,
    visualStyle: episode?.motionDesignStyle ?? null,
    scriptSha256: episode?.scenes?.length ? sha(scriptText(episode)) : null,
  };
}

/** Each review package folder holding a local publications.json. */
export function publicationPackages(root = ROOT) {
  const review = path.join(root, "review");
  const out = [];
  for (const id of fs.existsSync(review) ? fs.readdirSync(review).sort() : []) {
    for (const sub of ["", "tg"]) {
      const dir = path.join(review, id, sub);
      if (fs.existsSync(path.join(dir, "publications.json"))) out.push(dir);
    }
  }
  return out;
}

/** Ledger mappings from one package's verified receipts, plus why any receipt was skipped. */
export function mappingsFromPackage(dir, experiments = null) {
  const local = tryJson(path.join(dir, "publications.json"));
  const mappings = [];
  const skipped = [];
  if (local?.schemaVersion !== 1 || !Array.isArray(local.records)) return { mappings, skipped: [{ dir, reason: "unsupported publications.json" }] };
  for (const record of local.records) for (const item of record.platforms ?? []) {
    const label = `${path.relative(ROOT, dir) || dir} ${item.platform}`;
    if (!TRACKED_PLATFORMS.includes(item.platform)) { skipped.push({ dir: label, reason: "untracked platform" }); continue; }
    if (item.approvalConfirmed !== true) { skipped.push({ dir: label, reason: "no recorded exact-preview approval" }); continue; }
    if (!["scheduled", "published", "processing"].includes(item.status)) { skipped.push({ dir: label, reason: `status ${item.status}` }); continue; }
    const platformEpisode = tryJson(path.join(dir, item.platform === "instagram" ? "" : item.platform, "episode.json"))
      ?? tryJson(path.join(dir, "episode.json"));
    const mapping = {
      content: item.contentIdentity,
      platform: item.platform,
      accountId: item.accountId,
      accountUsername: normalizeUsername(item.accountName ?? ""),
      zernioPostId: item.zernioPostId ?? item.postId ?? null,
      platformPostId: item.platformPostId ?? null,
      status: item.status,
      videoSha256: item.videoSha256,
      approvedVideoSha256: item.videoSha256,
      approvedAt: item.approvedAt,
      verifiedAt: item.verifiedAt,
      scheduledFor: item.scheduledFor ?? null,
      publishedAt: item.publishedAt ?? null,
      ctaExperimentId: item.ctaExperimentId ?? null,
      postPreviewSha256: item.postPreviewSha256 ?? null,
      creative: creativeRecord(platformEpisode, experiments),
      source: { provider: "Zernio", endpoint: item.resultVerifiedBy ?? "Zernio GET /v1/posts/{id}", localRequestId: item.localRequestId ?? null,
        sourceCommit: item.sourceCommit ?? null },
    };
    const errors = validatePublicationMapping(mapping);
    if (errors.length) skipped.push({ dir: label, reason: errors.join("; ") });
    else mappings.push(mapping);
  }
  return { mappings, skipped };
}

/**
 * Merges verified package receipts into the tracked registry. A known post only
 * gets its provider-returned status / native ID / publish time updated; a post ID
 * is never re-assigned to other content or media.
 */
export function mergeLedger(registry, mappings) {
  const records = (registry?.records ?? []).map((record) => ({ ...record }));
  const added = [];
  const updated = [];
  for (const mapping of mappings) {
    const existing = records.find((record) => mapping.zernioPostId && record.zernioPostId === mapping.zernioPostId);
    if (!existing) { records.push(mapping); added.push(mapping.zernioPostId); continue; }
    if (JSON.stringify(existing.content) !== JSON.stringify(mapping.content) || existing.videoSha256 !== mapping.videoSha256)
      throw Error(`Zernio post ${mapping.zernioPostId} is recorded for different content or media; reconcile by hand.`);
    const next = { ...existing, status: mapping.status, platformPostId: existing.platformPostId ?? mapping.platformPostId,
      publishedAt: existing.publishedAt ?? mapping.publishedAt, verifiedAt: mapping.verifiedAt };
    if (JSON.stringify(next) !== JSON.stringify(existing)) { Object.assign(existing, next); updated.push(mapping.zernioPostId); }
  }
  return { registry: { schemaVersion: 1, records }, added, updated };
}

export function readExperimentsFile(root = ROOT) {
  return tryJson(path.join(root, "content", "experiments.json"));
}

export function syncPublicationLedger({ root = ROOT, write = false, dirs = null } = {}) {
  const file = path.join(root, LEDGER_PATH);
  const registry = tryJson(file) ?? { schemaVersion: 1, records: [] };
  const experiments = readExperimentsFile(root);
  const mappings = [];
  const skipped = [];
  for (const dir of dirs ?? publicationPackages(root)) {
    const result = mappingsFromPackage(dir, experiments);
    mappings.push(...result.mappings);
    skipped.push(...result.skipped);
  }
  const merged = mergeLedger(registry, mappings);
  if (write && (merged.added.length || merged.updated.length))
    fs.writeFileSync(file, JSON.stringify(merged.registry, null, 2) + "\n");
  return { ...merged, skipped, written: write && Boolean(merged.added.length || merged.updated.length) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const write = process.argv.includes("--write");
  const result = syncPublicationLedger({ write });
  console.log(`${result.added.length} new, ${result.updated.length} updated publication record(s)${write ? "" : " (dry run; --write to save)"}; ${result.registry.records.length} in ${LEDGER_PATH}.`);
  for (const item of result.skipped) console.log(`  skipped: ${item.dir} — ${item.reason}`);
}
