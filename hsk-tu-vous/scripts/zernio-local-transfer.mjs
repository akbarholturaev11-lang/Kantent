import {
  constants, createCipheriv, createDecipheriv, createHash, createHmac,
  createPublicKey, generateKeyPairSync, privateDecrypt, publicEncrypt,
  randomBytes, timingSafeEqual,
} from "node:crypto";

export const CODEX_LOCAL_TICKET_SCHEMA = 1;
export const MAX_LOCAL_VIDEO_BYTES = 350 * 1024 * 1024;

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isSha256(value) {
  return /^[a-f0-9]{64}$/.test(value ?? "");
}

export function safeRequestId(value) {
  if (!/^[a-f0-9]{24}$/.test(value ?? ""))
    throw Error("Codex-local request ID must be 24 lowercase hexadecimal characters.");
  return value;
}

export function localMediaSecretName(requestId) {
  return "CODEX_ZERNIO_MEDIA_URL_" + safeRequestId(requestId).toUpperCase();
}

export function safeZernioPublicUrl(raw) {
  let url;
  try { url = new URL(raw); }
  catch { throw Error("Zernio returned an invalid public media URL."); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "media.zernio.com" ||
      url.username || url.password || url.hash || !url.pathname.startsWith("/temp/"))
    throw Error("Zernio returned an unexpected public media URL.");
  return url.toString();
}

export function safeTicketPublicKey(base64) {
  if (typeof base64 !== "string" || base64.length > 4096 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
    throw Error("Invalid ephemeral Codex public key.");
  let key;
  try { key = createPublicKey({ key: Buffer.from(base64, "base64"), format: "der", type: "spki" }); }
  catch { throw Error("Invalid ephemeral Codex public key."); }
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
    throw Error("Codex ticket public key must be RSA-2048 or stronger.");
  return key;
}

export function makeEphemeralTicketKeys() {
  const pair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyBase64: pair.publicKey.toString("base64"), privateKeyPem: pair.privateKey };
}

export function encryptTicket(payload, recipientPublicKeyBase64) {
  const publicKey = safeTicketPublicKey(recipientPublicKeyBase64);
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const requestId = safeRequestId(payload.requestId);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(requestId, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), "utf8")), cipher.final(),
  ]);
  const wrappedKey = publicEncrypt({
    key: publicKey,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: "sha256",
  }, key);
  key.fill(0);
  return {
    schemaVersion: CODEX_LOCAL_TICKET_SCHEMA,
    requestId,
    wrappedKey: wrappedKey.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decodeBase64(value, label, maxLength) {
  if (typeof value !== "string" || value.length > maxLength ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw Error("Invalid encrypted ticket " + label + ".");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw Error("Invalid encrypted ticket " + label + ".");
  return bytes;
}

export function decryptTicket(envelope, privateKeyPem) {
  if (envelope?.schemaVersion !== CODEX_LOCAL_TICKET_SCHEMA ||
      safeRequestId(envelope?.requestId) !== envelope.requestId)
    throw Error("Invalid encrypted Codex upload ticket.");
  let key;
  try {
    key = privateDecrypt({
      key: privateKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    }, decodeBase64(envelope.wrappedKey, "key", 1024));
  } catch {
    throw Error("Could not decrypt the one-time Zernio upload ticket.");
  }
  if (key.length !== 32) throw Error("Invalid encrypted ticket key length.");
  try {
    const iv = decodeBase64(envelope.iv, "IV", 64);
    const tag = decodeBase64(envelope.tag, "authentication tag", 64);
    const ciphertext = decodeBase64(envelope.ciphertext, "payload", 16_384);
    if (iv.length !== 12 || tag.length !== 16) throw Error("Invalid encrypted ticket parameters.");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(envelope.requestId, "utf8"));
    decipher.setAuthTag(tag);
    const clear = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const payload = JSON.parse(clear.toString("utf8"));
    if (payload?.requestId !== envelope.requestId) throw Error("Upload ticket request ID mismatch.");
    return payload;
  } catch {
    throw Error("Encrypted Zernio upload ticket failed integrity verification.");
  } finally {
    key.fill(0);
  }
}

function ticketMacFields(meta, mediaUrl) {
  return {
    schemaVersion: meta.schemaVersion,
    requestId: meta.requestId,
    ticketRunId: meta.ticketRunId,
    sourceCommit: meta.sourceCommit,
    episodeId: meta.episodeId,
    language: meta.language,
    platform: meta.platform,
    accountId: meta.accountId,
    expectedUsername: meta.expectedUsername,
    credentialGroup: meta.credentialGroup,
    videoSha256: meta.videoSha256,
    videoBytes: meta.videoBytes,
    postSha256: meta.postSha256,
    contentHash: meta.contentHash,
    ctaExperimentId: meta.ctaExperimentId,
    mode: meta.mode,
    scheduledFor: meta.scheduledFor,
    mediaUrlSecretName: meta.mediaUrlSecretName,
    createdAt: meta.createdAt,
    uploadExpiresAt: meta.uploadExpiresAt,
    mediaUrl,
  };
}

export function signLocalTicket(meta, mediaUrl, connectionKey) {
  const payload = ticketMacFields(meta, safeZernioPublicUrl(mediaUrl));
  return createHmac("sha256", connectionKey).update(JSON.stringify(payload)).digest("hex");
}

export function ticketMacMatches(meta, mediaUrl, connectionKey) {
  if (!/^[a-f0-9]{64}$/.test(meta?.ticketMac ?? "")) return false;
  const expected = signLocalTicket(meta, mediaUrl, connectionKey);
  const actual = Buffer.from(meta.ticketMac, "hex");
  const wanted = Buffer.from(expected, "hex");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function buildLocalTicketMetadata(fields) {
  const meta = {
    schemaVersion: CODEX_LOCAL_TICKET_SCHEMA,
    requestId: safeRequestId(fields.requestId),
    ticketRunId: String(fields.ticketRunId),
    sourceCommit: String(fields.sourceCommit),
    episodeId: String(fields.episodeId),
    language: String(fields.language),
    platform: String(fields.platform),
    accountId: String(fields.accountId),
    expectedUsername: String(fields.expectedUsername),
    credentialGroup: String(fields.credentialGroup),
    videoSha256: String(fields.videoSha256),
    videoBytes: Number(fields.videoBytes),
    postSha256: String(fields.postSha256),
    contentHash: String(fields.contentHash),
    ctaExperimentId: String(fields.ctaExperimentId),
    mode: String(fields.mode),
    scheduledFor: String(fields.scheduledFor ?? ""),
    mediaUrlSecretName: String(fields.mediaUrlSecretName),
    createdAt: String(fields.createdAt),
    uploadExpiresAt: String(fields.uploadExpiresAt),
  };
  if (!/^[1-9]\d{6,15}$/.test(meta.ticketRunId) || !/^[0-9a-f]{40}$/.test(meta.sourceCommit) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.episodeId) ||
      !["ru", "tg"].includes(meta.language) ||
      !["instagram", "youtube", "tiktok", "facebook"].includes(meta.platform) ||
      !/^[a-f0-9]{24}$/.test(meta.accountId) || !isSha256(meta.videoSha256) ||
      !isSha256(meta.postSha256) || !isSha256(meta.contentHash) || !meta.ctaExperimentId ||
      !Number.isInteger(meta.videoBytes) || meta.videoBytes < 8_000 ||
      meta.videoBytes > MAX_LOCAL_VIDEO_BYTES ||
      !/^CODEX_ZERNIO_MEDIA_URL_[A-F0-9]{24}$/.test(meta.mediaUrlSecretName) ||
      !Number.isFinite(Date.parse(meta.createdAt)) ||
      !Number.isFinite(Date.parse(meta.uploadExpiresAt)))
    throw Error("Invalid local video upload ticket metadata.");
  return meta;
}

export function verifyPostPreview({ postPreviewBase64, postSha256, approvedPostJson, extractCaption }) {
  if (typeof postPreviewBase64 !== "string" || postPreviewBase64.length > 48_000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(postPreviewBase64))
    throw Error("Post preview must be supplied as a short base64-encoded UTF-8 file.");
  const bytes = Buffer.from(postPreviewBase64, "base64");
  if (bytes.toString("base64") !== postPreviewBase64 || sha256(bytes) !== postSha256)
    throw Error("Post preview bytes do not match the approved SHA-256.");
  const details = typeof approvedPostJson === "string" ? JSON.parse(approvedPostJson) : approvedPostJson;
  if (!details || typeof details !== "object" || Array.isArray(details))
    throw Error("Approved post JSON must be one object.");
  if (extractCaption(bytes) !== details.content)
    throw Error("Approved post caption does not exactly match the local post preview.");
  return { bytes, details };
}
