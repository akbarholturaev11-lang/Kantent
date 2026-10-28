# GitHub Actions: protected HSK AI video-review pipeline

This opt-in pipeline uses the existing Gemini + Remotion lesson renderer. It does not replace Calendar Reserve, bilingual source schema, approved voice profiles, platform CTA registration, analytics or owner approval.

## Branch and rollout

- Initial implementation lives only on branch feat/github-automated-video-review-20261028. No main source lesson or active rule was changed.
- Branch pushes and pull requests run only secret-free tests, including an actual **synthetic-test-audio** MP4 verification. This does not prove a real Gemini video was generated.
- GitHub workflow_dispatch appears in the Actions UI only when the workflow file is on the default branch. Until merged, a production Gemini run cannot be claimed to have executed through this new workflow.
- Scheduled runs are disabled until repository Actions variable HSK_VIDEO_SCHEDULE_ENABLED=true is deliberately set after owner review and merge. If enabled, the schedule is Mon/Wed/Fri 08:00 Asia/Shanghai, and it generates review media only, never social posts.
- Before enabling this schedule, check real-run cost, exact narration/timestamps and delivery to the owner.

## Required configuration

1. GitHub repository Settings → Secrets and variables → Actions: create encrypted secret GEMINI_API_KEY with an appropriately capped Gemini API key. Never put it in code, PRs or logs.
2. Confirm GitHub Actions minutes, artifact storage, Node.js 22, FFmpeg and FFprobe.
3. Keep both existing approved language voice profiles unchanged.
4. After this feature is merged to default branch, open Actions → HSK AI video review automation → Run workflow. Enter episode ID er-vs-liang-cafe-20261026 and choose language ru for an initial independent test. Later use all after the protected Tajik audio issue is resolved; other input forms are today or exact YYYY-MM-DD.

## Current GitHub Secrets: two distinct Zernio accounts, four Gemini candidates

The current owner-provided repository secret names (never values) are:
- GEMINI_API_KEY, GEMINI_API_KEY_BACKUP_1, GEMINI_API_KEY_BACKUP_2, GEMINI_API_KEY_BACKUP_3.
- ZERNIO_API_KEY is the legacy **Russian Zernio** key. ZERNIO_TG_API_KEY is the separate **Tajik Zernio** key. No renaming is required.
- Optional ZERNIO_RU_API_KEY takes precedence only if equal to the legacy credential. Conflicting RU keys block the routing helper; never silently mix accounts.
- The new video-credentials module guarantees no RU-to-TG fallback and never displays credential contents.
- Existing Zernio RU connector lists Instagram hskai.app and YouTube hskai_app; the **Tajik account IDs must be independently verified** from the actual Tajik Zernio connection before any target preview. Secret name alone does not establish the connected account.

The review workflow consumes the four Gemini secret variables **only in the explicitly authorized render job**. It never consumes Zernio publishing credentials or initiates Zernio upload, draft, schedule or post. The preview's exact language, platform, account ID, CTA and video hash are still approval prerequisites.

The Gemini helper switches to another candidate only for certain credential rejection errors, at a **standalone TTS or upload request boundary**. It never replaces a successful voice take. **HTTP 429 never rotates to another Google account or project to bypass quota**: Google's API Terms forbid circumventing documented rate limits, including through separate accounts. Respect provider reset/backoff guidance or request authorized quota increases or an appropriate billing tier instead. For transcription failures after an audio file has already been uploaded, the script retains fail-closed matching-audio safeguards. Synthetic CI tests use fake secrets and cannot verify production API availability.

The GitHub UI lists only secret names, not validity; branch/PR CI uses synthetic fake keys and must not consume real Gemini quota. Real API availability will require a separate owner-authorized production run after default-branch workflow activation.

## Active language/social destinations

The live Zernio connector currently returns eight connected accounts. Video routing is language-scoped in `content/publication-destinations.json`:
- RU: Instagram `@hskai.app`, YouTube `@hskai_app`, TikTok `@hskai.app`, Facebook `Akbarholturaev`.
- TJ: Instagram `@hskai.apptj`, YouTube `@hskaiapp-tj`, TikTok `@hskai.ru`, Facebook `Akbarholturaev`.
- Telegram `@aibotsakbar` is TJ text updates only, every three days; it never receives video.

Facebook is one shared page and receives separate Russian and Tajik videos. For the manual GitHub REST workflow, configure the corresponding `ZERNIO_RU_*_ACCOUNT_ID` and `ZERNIO_TG_*_ACCOUNT_ID` Actions variables; Facebook's live account ID is the same destination for both languages. Never store API keys or tokens in these variables. `VIDEO_PLATFORM_TARGETS` is derived from the canonical destination file, while `zernioTargetAccount` still requires exact account IDs and verifies the active username through the selected language's Zernio credential before upload. The live connector check does not imply that GitHub Actions variables or REST credentials are configured.

## Protected audio for 26 October 二 / 两

The owner-approved Tajik sample for er-vs-liang-cafe-20261026 has word-cue evidence and the flag audioMustNotBeRegeneratedForTranscription=true. The original MP3 and VTT are inside a Git-ignored review directory, not versioned in GitHub. The fresh GitHub runner therefore cannot recover them from the repository.

Production must block the Tajik version until the exact approved audio/captions and matching imported working copy are independently restored and checked against the saved hashes. Never create a replacement voice take or invent timestamps simply to make CI green. The Russian version has its own approved voice and may be tested separately.

## Production stages

1. Resolve the exact canonical date or episode ID and requested language(s); do not silently change the date.
2. Refuse duplicate verified publications and prohibited regeneration of approved sample audio.
3. Check the API secret and install frozen dependencies.
4. Run existing npm run content:make with the exact episode and language, using real Gemini speech, word-level captions and Remotion exports.
5. Require rendered-pending-owner-approval per language; check Instagram, YouTube, TikTok and Facebook MP4s, SRT, post copy, embedded audio, portrait dimensions, duration, size and SHA-256. Telegram is not a video destination.
6. Upload only MP4s, SRTs, post copy and a limited hash manifest in a 7-day GitHub Actions artifact. Never upload model request dumps, unfiltered review folders, .env files, transcription diagnostics or approvals.
7. The owner examines the actual video, voice, Mandarin accuracy, pinyin, animations, caption timing, CTA, disclosures, exact account, time and final post preview. Each platform/language needs its own approval.
8. Zernio publication happens separately, only after exact preview approval. This workflow has no Zernio credential and no social-publishing actions.

Local tests from the hsk-tu-vous directory:

    npm ci --no-audit --no-fund
    node --test scripts/github-video-pipeline.test.mjs
    npm run check:consistency

## Limits

- The repository is currently public: do NOT treat GitHub Actions artifacts as confidential storage for unreleased media. Control repository and artifact access separately before generating private content.
- Branch CI green means synthetic technical test success, not successful real Gemini narration.
- MP4 hash and ffprobe checks verify an encoded package, not educational or visual quality. Owner review is still compulsory.
- Merging the feature does not authorize any social post. Keep the calendar reserve automation unchanged.
- Running or repeating real production may incur Gemini/API and Actions costs.


## Zernio upload, owner approval and posting (manual, no automatic posting)

A separate GitHub Actions workflow now exists on this feature branch:
.github/workflows/zernio-approved-publish.yml.

It is ONLY launched by workflow_dispatch and ONLY by the repository owner akbarholturaev11-lang from main. It cannot run on push, cron, a passing CI job or routine scenario creation. The GitHub Environment hsk-zernio-publishing can optionally have required reviewers configured as an additional human gate.

### Owner procedure after feature is merged and a real video was rendered

1. Run Actions -> HSK AI video review automation -> Run workflow on main, select episode and language. Open the resulting review artifact, watch exact platform MP4, inspect audio, Mandarin, captions, graphics and CTA. Read manifest.json and post.md.
2. The generated post.md has INTERNAL REVIEW-STATUS LABELS and must not be uploaded verbatim. Compose an accurate CLEAN final caption separately.
3. Open Actions -> HSK AI Zernio owner-approved posting -> Run workflow. Enter the exact source review run ID, language, platform, target Account ID, exact sha256 and postSha256 from manifest, posting mode and approved_post_json. Add the exact mode-specific approval_confirmation.
4. Instagram, YouTube and TikTok each require the exact platform settings captured in the preview. Facebook uses the exact reviewed caption and connected page account.
5. JSON for RU Instagram: {"content":"Узнайте разницу между 二 и 两. #HSKAI","shareToFeed":true}
6. JSON for TJ Instagram: {"content":"Фарқи 二 ва 两-ро омӯзед. #HSKAI","shareToFeed":true}
7. JSON for RU YouTube: {"content":"Почему 二 и 两 не взаимозаменяемы? #Shorts","title":"二 vs 两 — HSK 1","visibility":"unlisted","madeForKids":false,"containsSyntheticMedia":true}
8. For scheduled mode also supply a future Asia/Shanghai time in JSON, example "scheduledFor":"2026-11-01T18:30:00+08:00". It must be 20+ minutes in the future.
9. Type one of these EXACT approval confirmations: SAVE_EXACT_VIDEO_AS_DRAFT, APPROVE_EXACT_VIDEO_AND_SCHEDULE or APPROVE_EXACT_VIDEO_AND_PUBLISH_NOW. This action itself is the explicit owner authorization of the selected MP4, final caption, account and mode.

The workflow validates that the downloaded artifact came from a successful manual real review run on main and checks both SHA-256 hashes and the selected account. It performs a read-only live Zernio GET /v1/accounts to verify the exact target, then POST /v1/media/presign + unauthenticated PUT to its presigned Cloudflare upload URL, and POST /v1/posts with one stable Idempotency-Key and explicit draft/scheduled/now. It finally reads GET /v1/posts/{id} and saves an audit receipt artifact. GitHub does not announce a live publication without verified readback. Telegram is never part of the video route.

A draft stays unpublished. A scheduled post is not live until its scheduled time and later needs a fresh published readback. A partial/failed/ambiguous result requires owner investigation, not blind re-posting. Never equate a successful upload with a published video.

The current review artifacts expire after 7 days. Zernio pre-signed uploads are created only after owner approval and are immediately followed by post creation. The repo is currently public, so review GitHub artifact access before using this flow for confidential videos. The workflow retains sanitized receipts 90 days and does not guarantee permanent exactly-once protection after Zernio's 24-hour idempotency window. Inspect existing posts/receipts before repeating manual dispatches.

Offline/synthetic CI does not prove Zernio account permissions, live upload success or actual publication. No Zernio publication was authorized or executed as part of building these files.

