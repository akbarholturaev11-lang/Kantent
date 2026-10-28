/**
 * GitHub Actions half of the Codex-local media route. `prepare` only verifies
 * the exact approval and creates an encrypted, one-use Zernio upload ticket.
 * `publish` rechecks the same ticket, media bytes, account and approval before
 * creating one post and verifying Zernio readback. No local MP4 enters GitHub.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  API_ROOT, exactCaptionFromPostPreview, jsonRequest, requestEnv,
  verifyAccount, verifyTikTokCreatorSettings, writeReceipt,
} from "./zernio-approved-publish.mjs";
import {
  validateApprovedIntent, publicationBody, safeSignedUploadUrl,
  parseZernioPostReply,
} from "./zernio-publication-core.mjs";
import { zernioRoute, zernioTargetAccount } from "./video-credentials.mjs";
import {
  MAX_LOCAL_VIDEO_BYTES, buildLocalTicketMetadata, encryptTicket, isSha256,
  localMediaSecretName, safeRequestId, safeTicketPublicKey,
  safeZernioPublicUrl, signLocalTicket, ticketMacMatches, verifyPostPreview,
} from "./zernio-local-transfer.mjs";

const self = fileURLToPath(import.meta.url);
const OWNER = "akbarholturaev11-lang";
const REPOSITORY = "akbarholturaev11-lang/Kantent";
const WORKFLOW_PATH = ".github/workflows/zernio-codex-local-publish.yml";

function responseAccountId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return String(value._id ?? value.id ?? "");
  return "";
}

function actionGuard(env = process.env) {
  if (env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_REPOSITORY !== REPOSITORY ||
      env.GITHUB_REF !== "refs/heads/main" || env.GITHUB_ACTOR !== OWNER)
    throw Error("Codex-local Zernio flow only accepts the repository owner's manual dispatch on trusted main.");
}

function approvalFrom(env, runId) {
  const approvedEnv = {
    ...env,
    APPROVED_RUN_ID: String(runId),
    APPROVED_LANGUAGE: env.CODEX_LOCAL_LANGUAGE,
    APPROVED_PLATFORM: env.CODEX_LOCAL_PLATFORM,
    APPROVED_VIDEO_SHA256: env.CODEX_LOCAL_VIDEO_SHA256,
  };
  const approval = validateApprovedIntent(requestEnv(approvedEnv), approvedEnv);
  const preview = verifyPostPreview({
    postPreviewBase64: env.APPROVED_POST_PREVIEW_B64,
    postSha256: env.APPROVED_POST_SHA256,
    approvedPostJson: approvedEnv.APPROVED_POST_JSON,
    extractCaption: exactCaptionFromPostPreview,
  });
  if (preview.details.content !== approval.content ||
      JSON.stringify(preview.details) !== JSON.stringify(JSON.parse(approvedEnv.APPROVED_POST_JSON)))
    throw Error("Approved post JSON changed while validating the exact preview.");
  return { approval, approvedEnv, postPreview: preview };
}

function actionInputs(env = process.env) {
  const requestId = safeRequestId(env.CODEX_LOCAL_REQUEST_ID);
  const videoBytes = Number(env.CODEX_LOCAL_VIDEO_BYTES);
  const values = {
    requestId,
    videoBytes,
    videoSha256: String(env.CODEX_LOCAL_VIDEO_SHA256 ?? ""),
    postSha256: String(env.APPROVED_POST_SHA256 ?? ""),
    episodeId: String(env.CODEX_LOCAL_EPISODE_ID ?? ""),
    contentHash: String(env.CODEX_LOCAL_CONTENT_HASH ?? ""),
    ctaExperimentId: String(env.CODEX_LOCAL_CTA_EXPERIMENT_ID ?? ""),
    mediaUrlSecretName: String(env.CODEX_LOCAL_MEDIA_URL_SECRET_NAME ?? ""),
  };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.episodeId) ||
      !isSha256(values.contentHash) || !values.ctaExperimentId ||
      !isSha256(values.videoSha256) || !isSha256(values.postSha256) ||
      !Number.isInteger(values.videoBytes) || values.videoBytes < 8_000 ||
      values.videoBytes > MAX_LOCAL_VIDEO_BYTES ||
      values.mediaUrlSecretName !== localMediaSecretName(requestId))
    throw Error("Invalid Codex-local package identity, video hash, size or transfer-secret binding.");
  return values;
}

async function prepareUpload(env = process.env) {
  actionGuard(env);
  if (env.CODEX_LOCAL_PHASE !== "prepare") throw Error("Wrong phase for upload-ticket preparation.");
  const values = actionInputs(env);
  const { approval, approvedEnv } = approvalFrom(env, env.GITHUB_RUN_ID);
  if (String(approval.target.accountId) !== String(env.APPROVED_ACCOUNT_ID))
    throw Error("Target account differs from the canonical language/platform account.");
  const route = zernioRoute(approval.language, approvedEnv, approval.platform);
  const account = await verifyAccount(route.secret, approval.target);
  if (approval.platform === "tiktok")
    await verifyTikTokCreatorSettings(route.secret, approval.target, approval.settings.tiktokSettings);

  safeTicketPublicKey(env.CODEX_LOCAL_RECIPIENT_PUBLIC_KEY);
  const presign = await jsonRequest(API_ROOT + "/media/presign", {
    method: "POST", token: route.secret,
    body: {
      filename: [values.episodeId, approval.language, approval.platform, "codex-local.mp4"].join("-"),
      contentType: "video/mp4", size: values.videoBytes,
    },
  });
  const uploadUrl = safeSignedUploadUrl(presign.data?.uploadUrl);
  const publicUrl = safeZernioPublicUrl(presign.data?.publicUrl);
  const expiresIn = Number(presign.data?.expiresIn);
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 3600)
    throw Error("Zernio returned an invalid or unsupported presigned-upload lifetime.");

  const meta = buildLocalTicketMetadata({
    requestId: values.requestId,
    ticketRunId: env.GITHUB_RUN_ID,
    sourceCommit: env.GITHUB_SHA,
    episodeId: values.episodeId,
    language: approval.language,
    platform: approval.platform,
    accountId: approval.target.accountId,
    expectedUsername: account.username,
    credentialGroup: route.group,
    videoSha256: values.videoSha256,
    videoBytes: values.videoBytes,
    postSha256: values.postSha256,
    contentHash: values.contentHash,
    ctaExperimentId: values.ctaExperimentId,
    mode: approval.mode,
    scheduledFor: approval.scheduledFor,
    mediaUrlSecretName: values.mediaUrlSecretName,
    createdAt: new Date().toISOString(),
    uploadExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });
  meta.ticketMac = signLocalTicket(meta, publicUrl, route.secret);
  const envelope = encryptTicket({
    requestId: values.requestId, uploadUrl, publicUrl,
    uploadExpiresAt: meta.uploadExpiresAt,
  }, env.CODEX_LOCAL_RECIPIENT_PUBLIC_KEY);
  const out = env.CODEX_LOCAL_TICKET_DIR || "/tmp/codex-local-zernio-ticket";
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, "metadata.json"), JSON.stringify(meta, null, 2) + "\n", { mode: 0o600 });
  await fs.writeFile(path.join(out, "ticket.enc.json"), JSON.stringify(envelope, null, 2) + "\n", { mode: 0o600 });
  console.log("Prepared an encrypted Zernio upload ticket; no video bytes or public media URL were written to GitHub.");
  return meta;
}

async function verifyTicketRun(ticketRunId, expectedCommit, token) {
  if (!token) throw Error("GitHub read-only workflow token missing.");
  const { data } = await jsonRequest(
    "https://api.github.com/repos/" + REPOSITORY + "/actions/runs/" + encodeURIComponent(ticketRunId),
    { token, headers: { "X-GitHub-Api-Version": "2022-11-28" } },
  );
  if (data?.repository?.full_name !== REPOSITORY || data?.path !== WORKFLOW_PATH ||
      data?.event !== "workflow_dispatch" || data?.head_branch !== "main" ||
      data?.head_sha !== expectedCommit || data?.conclusion !== "success" ||
      data?.actor?.login !== OWNER)
    throw Error("Upload ticket did not come from a successful owner-dispatched Codex-local workflow on the same trusted main commit.");
  return { sourceRunId: Number(ticketRunId), sourceCommit: data.head_sha, sourceUrl: data.html_url };
}

async function hashRemoteMedia(mediaUrl, expectedBytes) {
  const response = await fetch(safeZernioPublicUrl(mediaUrl), {
    headers: { Accept: "video/mp4" }, signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!response.ok || !response.body || new URL(response.url).hostname !== "media.zernio.com")
    throw Error("Zernio did not return the uploaded MP4 from the expected media host.");
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > expectedBytes || bytes > MAX_LOCAL_VIDEO_BYTES)
      throw Error("Uploaded Zernio media exceeds the approved byte size.");
    hash.update(chunk);
  }
  if (bytes !== expectedBytes) throw Error("Uploaded Zernio media byte size differs from the local MP4.");
  return { bytes, sha256: hash.digest("hex") };
}

async function reconcileExistingPost(env = process.env) {
  actionGuard(env);
  if (env.CODEX_LOCAL_PHASE !== "reconcile") throw Error("Wrong phase for read-only post reconciliation.");
  const language = String(env.CODEX_LOCAL_LANGUAGE ?? "");
  const platform = String(env.CODEX_LOCAL_PLATFORM ?? "");
  const postId = String(env.CODEX_LOCAL_POST_ID ?? "");
  const expectedScheduledFor = String(env.APPROVED_SCHEDULED_FOR ?? "");
  if (!/^[a-f0-9]{24}$/.test(postId)) throw Error("A real Zernio post ID is required for reconciliation.");
  const target = zernioTargetAccount(language, platform, env);
  if (String(env.APPROVED_ACCOUNT_ID ?? "") !== target.accountId)
    throw Error("Reconciliation account differs from the canonical language/platform route.");
  const route = zernioRoute(language, env, platform);
  const account = await verifyAccount(route.secret, { ...target, platform });

  const stopAt = Date.now() + 120_000;
  let receipt;
  while (true) {
    const { data } = await jsonRequest(API_ROOT + "/posts/" + encodeURIComponent(postId), { token: route.secret });
    const post = data?.post ?? data;
    const platforms = Array.isArray(post?.platforms) ? post.platforms : [];
    const entry = platforms.find(item => item?.platform === platform) ?? null;
    const observedAccountId = responseAccountId(entry?.accountId);
    const targetVerified = platforms.length === 1 && observedAccountId === target.accountId;
    const status = entry?.status ?? post?.status ?? "unknown";
    const scheduledFor = entry?.scheduledFor ?? post?.scheduledFor ?? null;
    const scheduleVerified = !expectedScheduledFor ||
      (scheduledFor && Number.isFinite(Date.parse(scheduledFor)) &&
        Date.parse(scheduledFor) === Date.parse(expectedScheduledFor));
    receipt = {
      sourceType: "codex-local-reconcile",
      postId,
      zernioPostId: postId,
      language,
      platform,
      accountId: target.accountId,
      connectedUsername: account.username,
      observedPlatform: entry?.platform ?? null,
      observedAccountId: observedAccountId || null,
      targetVerified,
      state: status,
      platformPostId: entry?.platformPostId ?? null,
      platformPostUrl: entry?.platformPostUrl ?? entry?.publishedUrl ?? null,
      publishedAt: entry?.publishedAt ?? post?.publishedAt ?? null,
      scheduledFor,
      ...(expectedScheduledFor ? { approvedSchedule: expectedScheduledFor, scheduleVerified } : {}),
      resultVerifiedBy: "Zernio GET /v1/posts/{id}",
      updatedAt: new Date().toISOString(),
    };
    await writeReceipt(receipt, env);
    if (!targetVerified) throw Error("Zernio GET readback did not prove the exact target account; do not retry or repost.");
    if (!scheduleVerified) throw Error("Zernio GET readback did not confirm the exact approved schedule; do not retry or repost.");
    if (["published", "scheduled", "failed", "partial"].includes(status) || Date.now() >= stopAt) break;
    await delay(5_000);
  }
  console.log("Zernio existing-post reconciliation: " + receipt.language + "/" + receipt.platform +
    " status=" + receipt.state + " targetVerified=true postId=" + receipt.postId);
  if (receipt.platformPostUrl) console.log(receipt.platformPostUrl);
  return receipt;
}

async function publishLocalUpload(ticketRoot, env = process.env) {
  actionGuard(env);
  if (env.CODEX_LOCAL_PHASE !== "publish") throw Error("Wrong phase for local-media post creation.");
  const values = actionInputs(env);
  const ticketRunId = String(env.CODEX_LOCAL_TICKET_RUN_ID ?? "");
  if (!/^[1-9]\d{6,15}$/.test(ticketRunId)) throw Error("A verified ticket workflow run ID is required.");
  const { approval, approvedEnv } = approvalFrom(env, ticketRunId);
  const meta = JSON.parse(await fs.readFile(path.join(ticketRoot, "metadata.json"), "utf8"));
  if (meta.schemaVersion !== 1 || meta.requestId !== values.requestId ||
      meta.ticketRunId !== ticketRunId || meta.sourceCommit !== env.GITHUB_SHA ||
      meta.episodeId !== values.episodeId || meta.language !== approval.language ||
      meta.platform !== approval.platform || meta.accountId !== approval.target.accountId ||
      meta.videoSha256 !== values.videoSha256 || meta.videoBytes !== values.videoBytes ||
      meta.postSha256 !== approval.postSha256 || meta.contentHash !== values.contentHash ||
      meta.ctaExperimentId !== values.ctaExperimentId || meta.mode !== approval.mode ||
      meta.scheduledFor !== approval.scheduledFor ||
      meta.mediaUrlSecretName !== values.mediaUrlSecretName)
    throw Error("The local file, post preview or target differs from its exact prepared ticket.");

  const origin = await verifyTicketRun(ticketRunId, meta.sourceCommit, env.GITHUB_TOKEN);
  const mediaUrl = safeZernioPublicUrl(env.CODEX_LOCAL_MEDIA_URL ?? "");
  const route = zernioRoute(approval.language, approvedEnv, approval.platform);
  if (!ticketMacMatches(meta, mediaUrl, route.secret))
    throw Error("The temporary Zernio media URL does not match the signed upload ticket.");
  const expiresAt = Date.parse(meta.uploadExpiresAt);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt + 5 * 60 * 1000)
    throw Error("The encrypted Zernio upload ticket expired; prepare a new one before posting.");

  const account = await verifyAccount(route.secret, approval.target);
  const verifiedTikTokSettings = approval.platform === "tiktok"
    ? await verifyTikTokCreatorSettings(route.secret, approval.target, approval.settings.tiktokSettings)
    : null;
  const remote = await hashRemoteMedia(mediaUrl, values.videoBytes);
  if (remote.sha256 !== approval.videoSha256)
    throw Error("Downloaded Zernio media SHA-256 differs from the exact Codex-local preview.");

  const postKey = "codex-" + createHash("sha256").update([
    values.episodeId, approval.language, approval.platform, approval.target.accountId,
    approval.videoSha256, approval.postSha256, approval.content, approval.mode,
    approval.scheduledFor, JSON.stringify(approval.settings),
  ].join("\n")).digest("hex").slice(0, 56);
  const receiptBase = {
    sourceType: "codex-local",
    localRequestId: values.requestId,
    ticketRunId: origin.sourceRunId,
    ticketSourceCommit: origin.sourceCommit,
    ticketSourceUrl: origin.sourceUrl,
    episodeId: values.episodeId,
    localSourceCommit: env.CODEX_LOCAL_SOURCE_COMMIT || null,
    language: approval.language,
    platform: approval.platform,
    accountId: approval.target.accountId,
    connectedUsername: account.username,
    publishRunId: String(env.GITHUB_RUN_ID ?? ""),
    approvedPlatformSettings: approval.settings,
    videoSha256: approval.videoSha256,
    postPreviewSha256: approval.postSha256,
    approvedCaptionSha256: createHash("sha256").update(approval.content).digest("hex"),
    approvedMode: approval.mode,
    approvedSchedule: approval.scheduledFor || null,
    ...(approval.scheduledFor ? { scheduledTimezone: "Asia/Shanghai" } : {}),
    ...(approval.platform === "instagram" ? { likeViewCountVisibility: {
      requested: "hidden", status: "manual_action_required",
    } } : {}),
    approvalConfirmed: approval.ownerExplicitlyConfirmed,
    idempotencyKey: postKey,
    ...(verifiedTikTokSettings ? { verifiedTikTokSettings } : {}),
  };
  await writeReceipt({ ...receiptBase, state: "validated-owner-approval-awaiting-post" }, env);
  const created = await jsonRequest(API_ROOT + "/posts", {
    method: "POST", token: route.secret,
    headers: { "Idempotency-Key": postKey },
    body: publicationBody(approval, mediaUrl),
  });
  const rawId = created.data?.post?._id ?? created.data?.post?.id ?? null;
  if (!/^[a-f0-9]{24}$/.test(rawId ?? ""))
    throw Error("Zernio create response did not return a real post ID. Check Zernio before retrying.");
  await writeReceipt({ ...receiptBase, state: "post-created-awaiting-verification",
    postId: rawId, reportedStatus: created.data?.post?.status ?? null }, env);
  const stopAt = Date.now() + 120_000;
  let readbackPost;
  let readbackStatus = "unknown";
  while (true) {
    const readback = await jsonRequest(API_ROOT + "/posts/" + encodeURIComponent(rawId), { token: route.secret });
    readbackPost = readback.data?.post ?? readback.data;
    const platforms = Array.isArray(readbackPost?.platforms) ? readbackPost.platforms : [];
    const entry = platforms.find(item => item?.platform === approval.platform) ?? null;
    if (platforms.length !== 1 || responseAccountId(entry?.accountId) !== approval.target.accountId)
      throw Error("Zernio GET readback did not prove the exact target account; do not retry or repost.");
    readbackStatus = entry?.status ?? readbackPost?.status ?? "unknown";
    const expectedStatus = approval.mode === "draft" ? "draft"
      : approval.mode === "scheduled" ? ["scheduled", "pending_approval"].includes(readbackStatus)
        : readbackStatus === "published";
    if (expectedStatus || ["failed", "partial", "rejected", "canceled", "cancelled"].includes(readbackStatus)) break;
    if (Date.now() >= stopAt) break;
    await delay(5_000);
  }
  const verified = parseZernioPostReply({
    post: { ...readbackPost, status: readbackPost?.status ?? readbackStatus },
  }, approval);
  const receipt = {
    ...receiptBase, state: verified.status, postId: verified.postId,
    zernioPostId: verified.zernioPostId,
    platformPostId: verified.platformPostId, platformPostUrl: verified.platformPostUrl,
    publishedAt: verified.publishedAt, scheduledFor: verified.scheduledFor,
    resultVerifiedBy: "Zernio GET /v1/posts/{id}", updatedAt: new Date().toISOString(),
  };
  await writeReceipt(receipt, env);
  console.log("Codex-local Zernio readback verified: " + receipt.language + "/" + receipt.platform +
    " status=" + receipt.state + " postId=" + receipt.postId);
  return receipt;
}

async function main() {
  const [phase, ticketRoot] = process.argv.slice(2);
  if (phase === "prepare") return prepareUpload();
  if (phase === "publish") {
    if (!ticketRoot || !path.isAbsolute(ticketRoot))
      throw Error("Usage: node scripts/zernio-codex-local-publish.mjs publish /absolute/ticket-dir");
    return publishLocalUpload(ticketRoot);
  }
  if (phase === "reconcile") return reconcileExistingPost();
  throw Error("Actions usage: zernio-codex-local-publish.mjs prepare|publish|reconcile <ticket-dir>");
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  main().catch((error) => {
    console.error("CODEX_LOCAL_ZERNIO_BLOCKED: " + String(error.message || "error").slice(0, 450));
    process.exitCode = 1;
  });
}
