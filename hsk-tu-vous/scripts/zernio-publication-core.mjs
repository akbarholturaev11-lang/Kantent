/**
 * Exact owner-approved publication policy. Pure functions; safe to run in CI.
 * This never initiates an API request, uploads a file or publishes a post.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { zernioTargetAccount, assertZernioPublishingAuthorized } from "./video-credentials.mjs";

const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[a-f0-9]{24}$/;
const INT = /^[1-9]\d{6,15}$/;
const LOCAL_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\+08:00)$/;

export const APPROVAL_SENTENCES = Object.freeze({
  draft: "SAVE_EXACT_VIDEO_AS_DRAFT",
  scheduled: "APPROVE_EXACT_VIDEO_AND_SCHEDULE",
  now: "APPROVE_EXACT_VIDEO_AND_PUBLISH_NOW",
});

export function validateApprovedIntent(raw, env = process.env, now = Date.now()) {
  if (!raw || typeof raw !== "object") throw Error("Missing publication approval intent.");
  const { runId, language, platform, mode, videoSha256, postSha256, confirmation } = raw;
  if (!INT.test(String(runId ?? ""))) throw Error("Review run_id must be a numeric GitHub Actions run ID.");
  let target;
  try {
    target = zernioTargetAccount(language, platform, env);
    assertZernioPublishingAuthorized(language, platform);
  }
  catch (error) { throw Error("This language/platform target is disabled: " + error.message); }
  if (!["draft", "scheduled", "now"].includes(mode)) throw Error("Choose draft, scheduled or now.");
  if (confirmation !== APPROVAL_SENTENCES[mode])
    throw Error("Missing the exact mode-specific owner consent text.");
  if (!SHA256.test(videoSha256 ?? "") || !SHA256.test(postSha256 ?? ""))
    throw Error("Owner must supply exact 64-character video and post preview SHA-256 hashes.");
  const content = String(raw.content ?? "");
  if (content !== content.trim() || !content || content.length > (platform === "youtube" ? 5000 : 2200) ||
      /пакет готов к ручной проверке|баста барои баррасии дастӣ|package ready for manual review/iu.test(content)) {
    throw Error("Approved post caption is empty, contains internal review labels or exceeds target length.");
  }
  const scheduledFor = String(raw.scheduledFor ?? "");
  if (mode === "scheduled") {
    if (!LOCAL_TIME.test(scheduledFor) || !Number.isFinite(Date.parse(scheduledFor)) ||
        Date.parse(scheduledFor) <= now + 20 * 60 * 1000)
      throw Error("Scheduled approval needs exact future Asia/Shanghai YYYY-MM-DDTHH:mm:ss+08:00, 20+ min ahead.");
    if (new Date(Date.parse(scheduledFor)).toLocaleString("sv-SE", { timeZone: "Asia/Shanghai", hour12: false }).replace(" ", "T") !== scheduledFor.slice(0,19))
      throw Error("Scheduled timestamp must match Asia/Shanghai local time.");
  } else if (scheduledFor) throw Error("scheduledFor must be empty except for scheduled mode.");

  const previewAccountId = String(raw.accountId ?? "");
  if (!ID.test(previewAccountId) || previewAccountId !== target.accountId)
    throw Error("Owner-approved account ID must exactly match this language/platform Actions variable.");
  const settings = {};
  if (platform === "youtube") {
    const title = String(raw.title ?? "");
    if (!title || title.trim() !== title || title.length > 100) throw Error("YouTube needs an exact approved title <=100 chars.");
    if (!["private", "unlisted", "public"].includes(raw.visibility)) throw Error("YouTube visibility must be explicitly selected.");
    if (!["true", "false"].includes(String(raw.madeForKids)) ||
        !["true", "false"].includes(String(raw.containsSyntheticMedia)))
      throw Error("YouTube audience and synthetic-media declarations must be explicitly supplied.");
    settings.title = title;
    settings.visibility = raw.visibility;
    settings.madeForKids = String(raw.madeForKids) === "true";
    settings.containsSyntheticMedia = String(raw.containsSyntheticMedia) === "true";
    settings.categoryId = "27";
  } else if (platform === "instagram") {
    if (!["true", "false"].includes(String(raw.shareToFeed)))
      throw Error("Instagram shareToFeed setting must be explicit.");
    if (!["true", "false"].includes(String(raw.isAiGenerated)))
      throw Error("Instagram AI-generated media disclosure must be explicit.");
    settings.shareToFeed = String(raw.shareToFeed) === "true";
    settings.isAiGenerated = String(raw.isAiGenerated) === "true";
  } else if (platform === "tiktok") {
    const tiktok = raw.tiktokSettings;
    const privacyLevels = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"];
    const commercialContentTypes = ["none", "brand_organic", "brand_content"];
    if (!tiktok || typeof tiktok !== "object" || Array.isArray(tiktok))
      throw Error("TikTok preview must include explicit tiktokSettings.");
    const expectedKeys = ["privacy_level", "allow_comment", "allow_duet", "allow_stitch",
      "content_preview_confirmed", "express_consent_given", "video_made_with_ai", "commercialContentType"];
    if (Object.keys(tiktok).some((key) => !expectedKeys.includes(key)) ||
        expectedKeys.some((key) => !Object.hasOwn(tiktok, key)))
      throw Error("TikTok settings must contain only the complete approved settings set.");
    if (!privacyLevels.includes(tiktok.privacy_level))
      throw Error("TikTok privacy_level must be one of the supported creator visibility values.");
    for (const key of ["allow_comment", "allow_duet", "allow_stitch", "video_made_with_ai"])
      if (typeof tiktok[key] !== "boolean") throw Error("TikTok " + key + " must be explicitly true or false.");
    if (tiktok.content_preview_confirmed !== true || tiktok.express_consent_given !== true)
      throw Error("TikTok requires explicit content preview confirmation and express consent.");
    if (!commercialContentTypes.includes(tiktok.commercialContentType))
      throw Error("TikTok commercialContentType must be explicitly none, brand_organic or brand_content.");
    settings.tiktokSettings = structuredClone(tiktok);
  }
  return { runId: String(runId), language, platform, mode, target, content, settings,
    videoSha256, postSha256, scheduledFor,
    // Never put an unverified untrusted publication mode in a render job.
    publicationAuthorized: true, ownerExplicitlyConfirmed: true };
}

export function selectApprovedArtifact(manifest, approval) {
  if (manifest?.schemaVersion !== 1 || manifest?.published !== false ||
      manifest?.publicationAuthorized !== false ||
      manifest?.state !== "rendered-pending-owner-approval" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest?.episodeId ?? "") ||
      !/^[0-9a-f]{40}$/.test(manifest?.sourceCommit ?? "")) {
    throw Error("Untrusted or altered review manifest.");
  }
  const artifact = manifest.languages?.[approval.language]?.[approval.platform];
  if (!artifact || artifact.video !== approval.language + "/" + approval.platform + "/video.mp4" ||
      artifact.sha256 !== approval.videoSha256 ||
      artifact.postSha256 !== approval.postSha256 ||
      !SHA256.test(artifact.contentHash ?? "") ||
      typeof artifact.ctaExperimentId !== "string" || !artifact.ctaExperimentId)
    throw Error("Owner-approved hashes do not match an exact verified language/platform review package.");
  return {
    episodeId: manifest.episodeId, sourceCommit: manifest.sourceCommit,
    videoRel: artifact.video,
    postRel: approval.language + "/" + approval.platform + "/post.md",
    contentHash: artifact.contentHash, ctaExperimentId: artifact.ctaExperimentId,
  };
}

export function publicationBody(approval, publicUrl) {
  if (!/^https:\/\/media\.zernio\.com\/[^\s?#]+(?:\?[^\s#]+)?$/i.test(publicUrl))
    throw Error("Invalid Zernio public media URL; refuse post.");
  const body = {
    content: approval.content,
    mediaItems: [{type:"video",url:publicUrl}],
    platforms: [{
      platform: approval.platform, accountId: approval.target.accountId,
      ...(["instagram", "youtube"].includes(approval.platform)
        ? { platformSpecificData: approval.settings } : {}),
    }],
  };
  if (approval.platform === "tiktok") body.tiktokSettings = approval.settings.tiktokSettings;
  if (approval.mode === "draft") body.isDraft = true;
  else if (approval.mode === "now") body.publishNow = true;
  else { body.scheduledFor = approval.scheduledFor; body.timezone = "Asia/Shanghai"; }
  return body;
}

export function deterministicPostKey(manifest, approval) {
  const data = [manifest.episodeId, approval.runId, approval.language, approval.platform,
    approval.videoSha256, approval.postSha256, approval.content, approval.mode, approval.scheduledFor,JSON.stringify(approval.settings)].join("\n");
  return "hsk-" + createHash("sha256").update(data).digest("hex").slice(0,56);
}

export function safeSignedUploadUrl(url) {
  const value = new URL(url);
  if (value.protocol !== "https:" || value.username || value.password ||
      !/^[a-z0-9.-]+\.r2\.cloudflarestorage\.com$/i.test(value.hostname))
    throw Error("Zernio presign response had an untrusted upload host.");
  return value.toString();
}

export function parseZernioPostReply(value, approval) {
  const post = value?.post;
  const id = post?._id ?? post?.id;
  const reportedAccountId = post?.platforms?.[0]?.accountId;
  const accountId = typeof reportedAccountId === "string" ? reportedAccountId
    : reportedAccountId && typeof reportedAccountId === "object"
      ? String(reportedAccountId._id ?? reportedAccountId.id ?? "") : "";
  if (!ID.test(id ?? "")) throw Error("Zernio create response did not return a real post ID. Check Zernio before retrying.");
  if (!Array.isArray(post.platforms) || post.platforms.length !== 1 ||
      post.platforms[0].platform !== approval.platform ||
      accountId !== approval.target.accountId)
    throw Error("Zernio response did not confirm the exact target account; manual investigation required.");
  const platformResult = post.platforms[0];
  // Zernio's lifecycle status is on the post; a scheduled platform row may
  // correctly remain `pending` until its scheduled time.
  const status = post.status ?? platformResult.status;
  if (approval.mode === "draft" && status !== "draft") throw Error("Zernio did not confirm draft-only status.");
  const scheduledFor = platformResult.scheduledFor ?? post.scheduledFor ?? null;
  if (approval.mode === "scheduled") {
    if (!["scheduled","pending_approval"].includes(status))
      throw Error("Zernio did not confirm scheduled/pending status.");
    if (!scheduledFor || !Number.isFinite(Date.parse(scheduledFor)) ||
        Date.parse(scheduledFor) !== Date.parse(approval.scheduledFor))
      throw Error("Zernio readback did not confirm the exact approved scheduled time.");
  }
  if (approval.mode === "now" && status !== "published")
    throw Error("Zernio did not fully publish this video; inspect the returned post before any retry.");
  return {postId:id,zernioPostId:id,status,platformStatus:platformResult.status??null,platform:approval.platform,
    accountId:approval.target.accountId,
    platformPostId:platformResult.platformPostId??null,
    platformPostUrl:platformResult.platformPostUrl??platformResult.publishedUrl??null,
    publishedAt:platformResult.publishedAt??post.publishedAt??null,
    scheduledFor};
}

export function artifactAbsolutePath(root, relative) {
  const allowed = /^[a-z]{2}\/(?:instagram|youtube|tiktok|facebook)\/(?:video\.mp4|post\.md|captions\.srt)$/;
  if (!allowed.test(relative)) throw Error("Unexpected artifact path");
  const resolved=path.resolve(root,relative);
  if (!resolved.startsWith(path.resolve(root)+path.sep))throw Error("Artifact escaped its root");
  return resolved;
}
