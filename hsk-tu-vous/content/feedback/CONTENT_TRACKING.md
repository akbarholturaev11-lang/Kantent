# Content identity and feedback handoffs

This contract applies to all default production languages and all calendar content types. It does not authorize social publishing or replace the current Hook/CTA Labs.

## Stable identity

`calendar.json` owns the stable content ID and source path. Ordinary lessons use `lesson` (legacy rows may omit it); advertisements use `advertisement`; serial parts use `series-part` and their own content ID plus a common `series:{id,part,totalParts}`. Preserve existing IDs and history. A translation shares the content ID, but has its own language, source hash, voice/cues, video and approval. A platform export has its own exact video hash and publication result.

`scripts/content-attribution.mjs#contentIdentity` builds `{id,type,language,sourceHash,series?}` from the actual calendar item and exact localized CTA-free source. The SHA-256 covers `JSON.stringify(source)`; regenerate identity after any source change. Renderer output identities and hashes are candidates for review, never evidence of a publication.

## Zernio operator duties

1. Read latest `main`, typed calendar, language sources and current account connections. Use `WORKFLOW.md` for real account/platform time evidence and the exact-preview approval gate. Keep serial dates consecutive; a missing/failing part requires an explicit repair decision, never a fabricated post or an unapproved shifted date.
2. Present each final language/platform video, copy, destination, time and settings. Only after exact owner approval may the existing Zernio connection upload/create/schedule it. Check an ambiguous response before retrying.
3. Record returned platform/native post ID, account ID/username, status, time, link and exact approved video hash in the local publication package. Do not equate a Zernio container ID with a native platform post ID. When native identity is unavailable, leave mapping pending.
4. Preserve a durable, independently checked record in `content/feedback/publications.json#records` using the existing feedback data review/delivery process. Each mapping is `{content,platform,accountId,accountUsername,platformPostId,status,videoSha256,approvedVideoSha256,approvedAt,verifiedAt,source:{provider:"Zernio",endpoint}}`. The media hashes must match the reviewed/approved package, and `content` must match that package's exact source identity. Structural validation cannot prove a provider response or owner approval; inspect the actual receipts. Update only the same verified mapping's returned status; never reassign a published native ID to different content/media. Empty registry means no new verified mappings, not zero performance.

## Feedback analyst duties

Use the existing Mon/Wed/Fri agent and its source/PR/CI process in `AGENT_PLAYBOOK.md`. Read the durable mapping plus raw immutable observations; `loadObservations()` joins them without rewriting raw history. Unknown old mappings stay unknown. Untagged legacy language belongs only to the original series and remains separate from newly typed content. Never infer attribution from matching dates, themes, titles or similar thumbnails.

Keep comparisons separate by platform, account, language, content type, serial part number, duration band, creative format, hook/storytelling treatment and actual metric window. Ads use their authored creative format without inventing an HSK level or teaching hook. Record available retention/watch, saves, shares and relevant sourced click/conversion metrics; unavailable metrics stay null. A next-part view count is not a measured part-to-part conversion without real viewer attribution. Compare part 1 against comparable part 1, and part 2 against comparable part 2; report series-level totals separately without double-counting people.

Preserve the exact provider-backed fixed-window gate: an old lifetime total is not 7d. Sparse, missing or mixed-attribution evidence means **unproven/keep testing**. No automatic winner or silent Hook/CTA/voice policy replacement.

## Improvement loop

For each proposed test, save in an analytical report: test ID, owner (Calendar Reserve for source authoring), content IDs/type/language/series, baseline and candidate windows, actual sources, primary/secondary metrics, observed difference, confounders, decision (`promote`, `keep-testing`, `rollback`, `unproven`), next concrete source patch and next readback date. Missing provider windows or attribution must be named.

Feedback proposes the change; Calendar Reserve applies an owner-reviewed test to a future unapproved source under `WORKFLOW.md`, preserving the test ID in authored planning metadata. After publication the operator records exact new IDs/media; Feedback reads the next real results. Only adequate comparable primary-window evidence plus explicit owner approval can promote a policy. Keep unchanged/no-action runs quiet in external task prompts; surface a meaningful result, failure or required decision. No extra cron, automatic script rewriting or autonomous publishing is added.
