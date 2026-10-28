/**
 * Publish one exact local review MP4 through the isolated GitHub -> Zernio
 * handoff. The video bytes travel from this machine straight to Zernio's
 * temporary presigned upload URL; GitHub receives no MP4 or unencrypted URL.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { validateApprovedIntent } from "./zernio-publication-core.mjs";
import { exactCaptionFromPostPreview, requestEnv } from "./zernio-approved-publish.mjs";
import { zernioTargetAccount } from "./video-credentials.mjs";
import {
  MAX_LOCAL_VIDEO_BYTES, decryptTicket, isSha256, localMediaSecretName,
  safeRequestId, safeZernioPublicUrl, sha256, verifyPostPreview,
} from "./zernio-local-transfer.mjs";

const REPOSITORY = "akbarholturaev11-lang/Kantent";
const WORKFLOW = "zernio-codex-local-publish.yml";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const REVIEW_ROOT = path.join(PROJECT_ROOT, "review");
const PLATFORMS = new Set(["instagram", "youtube", "tiktok", "facebook"]);
const LOCAL_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+08:00$/;

function parseFlags(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!key.startsWith("--") || i + 1 >= args.length)
      throw Error("Invalid command-line options.");
    if (Object.hasOwn(result, key.slice(2))) throw Error("Duplicate command-line option " + key + ".");
    result[key.slice(2)] = args[++i];
  }
  return result;
}

function gh(args, options = {}) {
  return execFileSync("gh", args, {
    cwd: PROJECT_ROOT, encoding: "utf8", timeout: options.timeout ?? 30_000,
    input: options.input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 3 * 1024 * 1024,
  }).trim();
}

function dispatchFields(values) {
  const fields = [];
  for (const [key, value] of Object.entries(values)) fields.push("--field", key + "=" + String(value ?? ""));
  return fields;
}

function safeJsonParse(value, label) {
  try { return JSON.parse(value); }
  catch { throw Error(label + " must contain valid JSON."); }
}

function pathInsideReview(rawPath, reviewDir, label) {
  if (typeof rawPath !== "string" || !rawPath.trim()) throw Error("Local status.json is missing " + label + ".");
  const resolved = path.resolve(path.isAbsolute(rawPath) ? rawPath : path.join(reviewDir, rawPath));
  if (!resolved.startsWith(reviewDir + path.sep)) throw Error(label + " must stay inside the selected local review package.");
  return resolved;
}

function localPackageLanguage(episode) {
  if (episode.languageCode === "ru-RU") return "ru";
  if (episode.languageCode === "tg-TJ") return "tg";
  throw Error("The local review episode has an unsupported or missing language locale.");
}

function localEpisodeHash(episode) {
  const { publishingStatus: _publishingStatus, ...content } = episode;
  return sha256(Buffer.from(JSON.stringify(content), "utf8"));
}

async function assertNoDuplicatePublication(reviewDir, status, episodeId, platform, accountId, videoSha256) {
  const prior = [...(Array.isArray(status.publicationRecords) ? status.publicationRecords : [])];
  try {
    const publications = JSON.parse(await fs.readFile(path.join(reviewDir, "publications.json"), "utf8"));
    for (const record of publications.records ?? []) prior.push(...(record.platforms ?? []));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (String(status.stage ?? "").startsWith("zernio-") && prior.length === 0)
    throw Error("Publication status has no matching local receipt; reconcile it before another upload.");
  if (prior.some(record => record.platform === platform && record.accountId === accountId &&
      (record.status !== "failed" || record.videoSha256 === videoSha256)))
    throw Error("This exact local package/platform/account already has a publication record; inspect Zernio before any retry.");

  const names = (await fs.readdir(reviewDir)).filter(name => /^codex-local-publication-[a-f0-9]{24}\.json$/.test(name));
  for (const name of names) {
    let previous;
    try { previous = JSON.parse(await fs.readFile(path.join(reviewDir, name), "utf8")); }
    catch { throw Error("A previous local publication state is unreadable; reconcile it before another dispatch."); }
    const blockedStates = new Set([
      "media-uploaded-post-not-yet-created",
      "post-dispatched-needs-reconciliation",
      "post-created-awaiting-verification",
      "published", "scheduled", "processing", "partial",
    ]);
    if (previous.episodeId === episodeId && previous.platform === platform &&
        previous.accountId === accountId && previous.videoSha256 === videoSha256 &&
        blockedStates.has(previous.status))
      throw Error("A previous local publish attempt may already have posted this video; reconcile its saved state before retrying.");
  }
}

async function verifyLocalPackage(opts) {
  const language = opts.language;
  const platform = opts.platform;
  if (!["ru", "tg"].includes(language) || !PLATFORMS.has(platform))
    throw Error("Choose a configured language and owner-authorized video platform.");
  const reviewDir = path.resolve(opts["review-dir"] ?? "");
  if (!reviewDir.startsWith(REVIEW_ROOT + path.sep) || reviewDir.split(path.sep).includes("archive"))
    throw Error("Review directory must be a current package inside this project's ignored review/ folder.");
  const [episode, status] = await Promise.all([
    fs.readFile(path.join(reviewDir, "episode.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(reviewDir, "status.json"), "utf8").then(JSON.parse),
  ]);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(episode.id ?? "") ||
      localPackageLanguage(episode) !== language || episode.contentIdentity?.language !== language)
    throw Error("Local review package ID or language differs from the selected destination.");
  const allowedStages = new Set([
    "rendered-pending-owner-approval", "owner-approved-for-zernio-publishing",
    "zernio-published", "zernio-scheduled", "zernio-publication-processing",
    "zernio-publication-partial", "zernio-publication-failed",
  ]);
  if (!allowedStages.has(status.stage) || status.publicationAuthorized === true ||
      ["published", "scheduled"].includes(episode.publishingStatus))
    throw Error("Only a current, unposted local review package can enter this handoff.");

  const platformStatus = status.platformPackages?.[platform];
  if (!platformStatus || platformStatus.platform !== platform ||
      !isSha256(platformStatus.videoSha256) || !isSha256(platformStatus.contentHash) ||
      typeof platformStatus.ctaExperimentId !== "string" || !platformStatus.ctaExperimentId)
    throw Error("The selected language/platform does not have a registered rendered MP4 and CTA package.");
  const videoPath = pathInsideReview(platformStatus.video, reviewDir, "platform video path");
  const postPath = pathInsideReview(platformStatus.post, reviewDir, "platform post preview path");
  const platformEpisodePath = pathInsideReview(platformStatus.episode, reviewDir, "platform episode path");
  const [videoBytes, postBytes, platformEpisode] = await Promise.all([
    fs.readFile(videoPath), fs.readFile(postPath), fs.readFile(platformEpisodePath, "utf8").then(JSON.parse),
  ]);
  if (platformEpisode.id !== episode.id || localPackageLanguage(platformEpisode) !== language ||
      platformEpisode.contentIdentity?.language !== language ||
      localEpisodeHash(platformEpisode) !== platformStatus.contentHash ||
      platformEpisode.ctaExperiment?.id !== platformStatus.ctaExperimentId)
    throw Error("Platform episode, language, content hash and registered CTA do not match the review package.");
  if (videoBytes.length < 8_000 || videoBytes.length > MAX_LOCAL_VIDEO_BYTES ||
      sha256(videoBytes) !== platformStatus.videoSha256)
    throw Error("Local MP4 is missing, altered or outside the 8 KB–350 MB transfer limit.");

  const account = zernioTargetAccount(language, platform);
  await assertNoDuplicatePublication(reviewDir, status, episode.id, platform, account.accountId, platformStatus.videoSha256);
  const postSha256 = sha256(postBytes);
  const postPreviewBase64 = postBytes.toString("base64");
  if (postPreviewBase64.length > 48_000)
    throw Error("Exact post preview exceeds the safe workflow input size; shorten its internal preview before dispatch.");
  const approvedPostJson = safeJsonParse(await fs.readFile(path.resolve(opts["approved-post-json"]), "utf8"),
    "Approved post JSON file");
  if (!approvedPostJson || typeof approvedPostJson !== "object" || Array.isArray(approvedPostJson))
    throw Error("Approved post JSON file must contain one object.");
  const confirmation = opts.confirmation;
  if (opts.mode !== "scheduled" && opts.mode !== "now")
    throw Error("Codex-local publishing currently supports exact scheduled or publish-now approvals.");
  const approvedEnv = {
    APPROVED_RUN_ID: "1234567",
    APPROVED_LANGUAGE: language,
    APPROVED_PLATFORM: platform,
    APPROVED_MODE: opts.mode,
    APPROVED_VIDEO_SHA256: platformStatus.videoSha256,
    APPROVED_POST_SHA256: postSha256,
    APPROVED_POST_JSON: JSON.stringify(approvedPostJson),
    APPROVAL_CONFIRMATION: confirmation,
    APPROVED_ACCOUNT_ID: account.accountId,
  };
  const raw = requestEnv(approvedEnv);
  const approval = validateApprovedIntent(raw, approvedEnv);
  const preview = verifyPostPreview({
    postPreviewBase64, postSha256, approvedPostJson,
    extractCaption: exactCaptionFromPostPreview,
  });
  if (preview.details.content !== approval.content)
    throw Error("Approved caption does not exactly match the local platform post preview.");
  const localSourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: REPOSITORY_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (!/^[a-f0-9]{40}$/.test(localSourceCommit)) throw Error("Cannot identify the local source commit.");
  return {
    reviewDir, episode, status, platformStatus, platformEpisode,
    episodeId: episode.id, language, platform, accountId: account.accountId,
    expectedUsername: account.expectedUsername,
    videoBytes, postBytes, postPreviewBase64, postSha256,
    approvedPostJson: JSON.stringify(preview.details),
    contentHash: platformStatus.contentHash,
    ctaExperimentId: platformStatus.ctaExperimentId,
    videoSha256: platformStatus.videoSha256,
    mode: approval.mode, confirmation,
    scheduledFor: approval.scheduledFor ?? "",
    localSourceCommit,
  };
}

async function assertCurrentMainCode() {
  const localHead = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: REPOSITORY_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const remoteMain = gh(["api", "repos/" + REPOSITORY + "/commits/main", "--jq", ".sha"]);
  if (localHead !== remoteMain)
    throw Error("Local Codex publish code must match the current GitHub main before dispatch.");
  const changed = execFileSync("git", ["status", "--porcelain", "--",
    ".github/workflows/zernio-codex-local-publish.yml",
    "hsk-tu-vous/scripts/codex-local-video-publish.mjs",
    "hsk-tu-vous/scripts/zernio-codex-local-publish.mjs",
    "hsk-tu-vous/scripts/zernio-local-transfer.mjs",
    "hsk-tu-vous/scripts/zernio-approved-publish.mjs"], {
    cwd: REPOSITORY_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (changed) throw Error("Commit and push the Codex-local handoff code to main before using it.");
}

async function readRun(runId) {
  return JSON.parse(gh(["run", "view", String(runId), "--repo", REPOSITORY,
    "--json", "databaseId,status,conclusion,event,headBranch,headSha,displayTitle"]));
}

async function waitForRun(requestId, phase) {
  const title = "Codex-local " + phase + " " + requestId;
  let runId = null;
  const discoverUntil = Date.now() + 90_000;
  while (!runId && Date.now() < discoverUntil) {
    const listed = JSON.parse(gh(["run", "list", "--repo", REPOSITORY,
      "--workflow", WORKFLOW, "--event", "workflow_dispatch", "--limit", "30",
      "--json", "databaseId,status,displayTitle,headBranch"]));
    const found = listed.find(run => run.displayTitle === title && run.headBranch === "main");
    if (found) runId = String(found.databaseId);
    else await delay(3_000);
  }
  if (!runId) throw Error("GitHub did not return the dispatched " + phase + " workflow run.");
  const stopAt = Date.now() + 40 * 60 * 1000;
  while (Date.now() < stopAt) {
    const run = await readRun(runId);
    if (run.event !== "workflow_dispatch" || run.headBranch !== "main")
      throw Error("Codex-local workflow did not execute from a manual dispatch on main.");
    if (run.status === "completed") {
      if (run.conclusion !== "success") {
        let failure = "";
        try { failure = gh(["run", "view", runId, "--repo", REPOSITORY, "--log-failed"], { timeout: 60_000 }); }
        catch { /* Keep the generic failure when GitHub does not return logs. */ }
        throw Error("GitHub " + phase + " run failed (" + runId + "). " +
          failure.split("\n").filter(line => /CODEX_LOCAL_ZERNIO_BLOCKED|Error:|error:/i.test(line))
            .slice(-5).join(" ").slice(0, 500));
      }
      return { runId, run };
    }
    await delay(5_000);
  }
  throw Error("GitHub " + phase + " run " + runId + " did not finish within 40 minutes.");
}

async function waitAndDownloadArtifact(runId, artifactName, destination) {
  await fs.mkdir(destination, { recursive: true });
  gh(["run", "download", runId, "--repo", REPOSITORY,
    "--name", artifactName, "--dir", destination], { timeout: 120_000 });
}

async function writeLocalState(file, value) {
  const temp = file + ".tmp";
  await fs.writeFile(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  await fs.rename(temp, file);
}

async function savePublicationRecord(data, receipt) {
  const now = new Date().toISOString();
  const publicationsPath = path.join(data.reviewDir, "publications.json");
  let publications;
  try { publications = JSON.parse(await fs.readFile(publicationsPath, "utf8")); }
  catch (error) {
    if (error?.code !== "ENOENT") throw error;
    publications = { schemaVersion: 1, episodeId: data.episodeId, records: [] };
  }
  if (publications.schemaVersion !== 1 || !Array.isArray(publications.records))
    throw Error("Existing local publications.json has an unsupported schema; reconcile before writing a result.");
  let record = publications.records.find(item => item.contentHash === data.contentHash);
  if (!record) {
    record = { contentHash: data.contentHash, createdAt: now, platforms: [] };
    publications.records.push(record);
  }
  const existing = record.platforms.find(item =>
    item.platform === data.platform && item.accountId === data.accountId);
  if (existing?.postId && existing.postId !== receipt.postId)
    throw Error("A different Zernio post ID is already recorded for this platform/account; manual reconciliation is required.");
  const normalizedStatus = receipt.state === "pending_approval" ? "pending" : receipt.state;
  if (!["published", "scheduled", "processing", "pending", "failed"].includes(normalizedStatus))
    throw Error("Zernio readback returned an unsupported status for the local publication registry.");
  const saved = {
    platform: data.platform,
    accountId: data.accountId,
    accountName: data.expectedUsername,
    postId: receipt.postId,
    ...(receipt.platformPostUrl ? { postUrl: receipt.platformPostUrl } : {}),
    status: normalizedStatus,
    ...(receipt.approvedSchedule ? { scheduledFor: receipt.approvedSchedule } : {}),
    contentIdentity: data.platformEpisode.contentIdentity,
    contentHash: data.contentHash,
    ctaExperimentId: data.ctaExperimentId,
    video: path.relative(data.reviewDir, data.platformStatus.video),
    videoSha256: data.videoSha256,
    updatedAt: now,
  };
  if (existing) Object.assign(existing, saved);
  else record.platforms.push(saved);
  record.updatedAt = now;
  publications.updatedAt = now;

  const statuses = record.platforms.map(item => item.status);
  const stage = statuses.every(item => item === "published") ? "zernio-published"
    : statuses.every(item => item === "scheduled") ? "zernio-scheduled"
      : statuses.some(item => item === "processing" || item === "pending") ? "zernio-publication-processing"
        : statuses.every(item => item === "failed") ? "zernio-publication-failed"
          : "zernio-publication-partial";
  const nextStatus = {
    ...data.status,
    stage,
    publicationRecords: record.platforms,
    updatedAt: now,
  };
  const nextEpisode = { ...data.episode, publishingStatus: stage };
  const staged = [
    [publicationsPath, publications],
    [path.join(data.reviewDir, "status.json"), nextStatus],
    [path.join(data.reviewDir, "episode.json"), nextEpisode],
  ];
  for (const [file, value] of staged) await writeLocalState(file, value);
  return { status: nextStatus, publications };
}

async function runLocalPublication(opts) {
  await assertCurrentMainCode();
  const data = await verifyLocalPackage(opts);
  const requestId = safeRequestId(randomBytes(12).toString("hex"));
  const mediaUrlSecretName = localMediaSecretName(requestId);
  const keys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const publicKeyBase64 = keys.publicKey.toString("base64");
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-codex-zernio-"));
  const localStatePath = path.join(data.reviewDir, "codex-local-publication-" + requestId + ".json");
  const state = {
    sourceType: "codex-local", requestId, episodeId: data.episodeId,
    language: data.language, platform: data.platform, accountId: data.accountId,
    videoSha256: data.videoSha256, postSha256: data.postSha256,
    mode: data.mode, status: "preparing-upload-ticket", createdAt: new Date().toISOString(),
  };
  await writeLocalState(localStatePath, state);
  let mediaUploaded = false;
  let postDispatched = false;
  let secretCreated = false;
  try {
    const inputs = {
      phase: "prepare", request_id: requestId, language: data.language,
      platform: data.platform, account_id: data.accountId,
      video_sha256: data.videoSha256, video_bytes: data.videoBytes.length,
      post_sha256: data.postSha256, post_preview_base64: data.postPreviewBase64,
      episode_id: data.episodeId, content_hash: data.contentHash,
      cta_experiment_id: data.ctaExperimentId, mode: data.mode,
      scheduled_for: data.scheduledFor, approved_post_json: data.approvedPostJson,
      approval_confirmation: data.confirmation,
      media_url_secret_name: mediaUrlSecretName,
      recipient_public_key: publicKeyBase64,
      local_source_commit: data.localSourceCommit,
    };
    gh(["workflow", "run", WORKFLOW, "--repo", REPOSITORY, "--ref", "main", ...dispatchFields(inputs)]);
    const preparedRun = await waitForRun(requestId, "prepare");
    state.ticketRunId = preparedRun.runId;
    state.status = "encrypted-ticket-ready-no-media-upload";
    await writeLocalState(localStatePath, state);

    const ticketDir = path.join(tempRoot, "ticket");
    await waitAndDownloadArtifact(preparedRun.runId, "codex-local-ticket-" + requestId, ticketDir);
    const [meta, envelope] = await Promise.all([
      fs.readFile(path.join(ticketDir, "metadata.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(ticketDir, "ticket.enc.json"), "utf8").then(JSON.parse),
    ]);
    const ticket = decryptTicket(envelope, keys.privateKey);
    if (meta.requestId !== requestId || meta.ticketRunId !== preparedRun.runId ||
        meta.sourceCommit !== preparedRun.run.headSha || meta.episodeId !== data.episodeId ||
        meta.language !== data.language || meta.platform !== data.platform ||
        meta.accountId !== data.accountId || meta.videoSha256 !== data.videoSha256 ||
        meta.videoBytes !== data.videoBytes.length || meta.postSha256 !== data.postSha256 ||
        meta.contentHash !== data.contentHash || meta.ctaExperimentId !== data.ctaExperimentId ||
        meta.mode !== data.mode || meta.scheduledFor !== data.scheduledFor ||
        meta.mediaUrlSecretName !== mediaUrlSecretName || ticket.requestId !== requestId ||
        ticket.uploadExpiresAt !== meta.uploadExpiresAt)
      throw Error("Downloaded encrypted ticket does not match this exact local video and post preview.");
    const expiresAt = Date.parse(ticket.uploadExpiresAt);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt - 30_000)
      throw Error("Zernio upload ticket is expired or too close to expiry; stop before upload.");
    const mediaUrl = safeZernioPublicUrl(ticket.publicUrl);
    if (sha256(data.videoBytes) !== data.videoSha256)
      throw Error("Local MP4 changed after review; stop before upload.");

    const uploaded = await fetch(ticket.uploadUrl, {
      method: "PUT", headers: { "Content-Type": "video/mp4" },
      body: data.videoBytes, signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    if (!uploaded.ok) throw Error("Zernio presigned upload failed (HTTP " + uploaded.status + "); no post was created.");
    mediaUploaded = true;
    state.status = "media-uploaded-post-not-yet-created";
    await writeLocalState(localStatePath, state);

    gh(["secret", "set", mediaUrlSecretName, "--repo", REPOSITORY], {
      input: mediaUrl + "\n", timeout: 30_000,
    });
    secretCreated = true;
    const publishInputs = {
      ...inputs, phase: "publish", ticket_run_id: preparedRun.runId,
    };
    gh(["workflow", "run", WORKFLOW, "--repo", REPOSITORY, "--ref", "main", ...dispatchFields(publishInputs)]);
    postDispatched = true;
    state.status = "post-dispatched-needs-reconciliation";
    state.publishDispatchedAt = new Date().toISOString();
    await writeLocalState(localStatePath, state);

    const publishRun = await waitForRun(requestId, "publish");
    const receiptDir = path.join(tempRoot, "receipt");
    await waitAndDownloadArtifact(publishRun.runId,
      "codex-local-receipt-" + publishRun.runId, receiptDir);
    const receipt = JSON.parse(await fs.readFile(path.join(receiptDir, "receipt.json"), "utf8"));
    if (receipt.sourceType !== "codex-local" || receipt.localRequestId !== requestId ||
        receipt.videoSha256 !== data.videoSha256 || receipt.postPreviewSha256 !== data.postSha256 ||
        receipt.accountId !== data.accountId || receipt.language !== data.language ||
        receipt.platform !== data.platform || !receipt.postId)
      throw Error("Zernio audit receipt does not match this local video request.");
    const saved = await savePublicationRecord(data, receipt);
    Object.assign(state, {
      status: receipt.state,
      publishRunId: publishRun.runId,
      postId: receipt.postId,
      platformPostUrl: receipt.platformPostUrl ?? null,
      finishedAt: new Date().toISOString(),
    });
    await writeLocalState(localStatePath, state);
    console.log("Codex-local Zernio readback verified: " + data.language + "/" + data.platform +
      " status=" + receipt.state + " postId=" + receipt.postId);
    if (receipt.platformPostUrl) console.log(receipt.platformPostUrl);
    console.log("Local publication status saved: " + saved.status.stage);
    return receipt;
  } catch (error) {
    state.status = postDispatched ? "post-dispatched-needs-reconciliation"
      : mediaUploaded ? "media-uploaded-post-not-yet-created" : "pre-transfer-failed-no-post";
    state.updatedAt = new Date().toISOString();
    state.error = String(error.message || "error").slice(0, 500);
    await writeLocalState(localStatePath, state);
    throw error;
  } finally {
    if (secretCreated) {
      try { gh(["secret", "delete", mediaUrlSecretName, "--repo", REPOSITORY], { timeout: 30_000 }); }
      catch { console.error("Temporary GitHub secret cleanup needs attention: " + mediaUrlSecretName); }
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const opts = parseFlags(process.argv.slice(2));
  for (const required of ["review-dir", "language", "platform", "approved-post-json", "mode", "confirmation"])
    if (!opts[required]) throw Error("Missing required option --" + required + ".");
  await runLocalPublication(opts);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error("CODEX_LOCAL_PUBLISH_BLOCKED: " + String(error.message || "error").slice(0, 700));
    process.exitCode = 1;
  });
}
