/**
 * Exact owner-approved publication policy. Pure functions; safe to run in CI.
 * This never initiates an API request, uploads a file or publishes a post.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { enabledVideoPlatforms, zernioTargetAccount } from "./video-credentials.mjs";

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
  if (!enabledVideoPlatforms(language).includes(platform))
    throw Error("This language/platform target is disabled.");
  if (!["draft", "scheduled", "now"].includes(mode)) throw Error("Choose draft, scheduled or now.");
  if (confirmation !== APPROVAL_SENTENCES[mode])
    throw Error("Missing the exact mode-specific owner consent text.");
  if (!SHA256.test(videoSha256 ?? "") || !SHA256.test(postSha256 ?? ""))
    throw Error("Owner must supply exact 64-character video and post preview SHA-256 hashes.");
  const content = String(raw.content ?? "");
  if (content !== content.trim() || !content || content.length > (platform === "instagram" ? 2200 : 5000) ||
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

  const target = zernioTargetAccount(language, platform, env);
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
  } else {
    if (!["true", "false"].includes(String(raw.shareToFeed)))
      throw Error("Instagram shareToFeed setting must be explicit.");
    settings.shareToFeed = String(raw.shareToFeed) === "true";
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
      platformSpecificData: approval.settings,
    }],
  };
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
  if (!ID.test(id ?? "")) throw Error("Zernio create response did not return a real post ID. Check Zernio before retrying.");
  if (!Array.isArray(post.platforms) || post.platforms.length !== 1 ||
      post.platforms[0].platform !== approval.platform ||
      post.platforms[0].accountId !== approval.target.accountId)
    throw Error("Zernio response did not confirm the exact target account; manual investigation required.");
  if (approval.mode === "draft" && post.status !== "draft") throw Error("Zernio did not confirm draft-only status.");
  if (approval.mode === "scheduled" && !["scheduled","pending_approval"].includes(post.status))
    throw Error("Zernio did not confirm scheduled/pending status.");
  if (approval.mode === "now" && post.status !== "published")
    throw Error("Zernio did not fully publish this video; inspect the returned post before any retry.");
  return {postId:id,status:post.status,platform:approval.platform,
    accountId:approval.target.accountId,
    platformPostId:post.platforms[0].platformPostId??null,
    platformPostUrl:post.platforms[0].platformPostUrl??post.platforms[0].publishedUrl??null};
}

export function artifactAbsolutePath(root, relative) {
  const allowed = /^[a-z]{2}\/(?:instagram|youtube)\/(?:video\.mp4|post\.md|captions\.srt)$/;
  if (!allowed.test(relative)) throw Error("Unexpected artifact path");
  const resolved=path.resolve(root,relative);
  if (!resolved.startsWith(path.resolve(root)+path.sep))throw Error("Artifact escaped its root");
  return resolved;
}
