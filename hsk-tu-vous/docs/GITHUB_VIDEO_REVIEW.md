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

## Active language/social destinations (owner clarification)

Only three **publishing destinations** are currently enabled:
- RU / Instagram: Actions variable ZERNIO_RU_INSTAGRAM_ACCOUNT_ID (verified from connected Russian Zernio: 6a411e989d9472faae10a430)
- RU / YouTube: Actions variable ZERNIO_RU_YOUTUBE_ACCOUNT_ID (verified from connected Russian Zernio: 6ac96e053f8f4ffc10b0655f)
- TG / Instagram: Actions variable ZERNIO_TG_INSTAGRAM_ACCOUNT_ID (must be read from the separate Tajik Zernio API connection; not yet verified)

The owner confirmed **there is currently no Tajik YouTube channel**. Do NOT create or require ZERNIO_TG_YOUTUBE_ACCOUNT_ID, do not substitute Russian YouTube for Tajik YouTube, and do not schedule Tajik YouTube posts. VIDEO_PLATFORM_TARGETS in video-credentials.mjs is the review-target allowlist; the review artifact packager requires both RU exports and only TG Instagram. zernioTargetAccount fails closed when a required configured account ID is missing or platform is disabled. The underlying existing content:make Remotion renderer currently still generates platform-specific YouTube exports per language internally; this isolated review adapter does not upload or expose TG YouTube and does not migrate that renderer. Avoid claiming rendering itself is single-platform without a separate renderer change. Future TG YouTube enablement needs owner instruction, a verified real Zernio account ID and corresponding regression tests.

## Protected audio for 26 October 二 / 两

The owner-approved Tajik sample for er-vs-liang-cafe-20261026 has word-cue evidence and the flag audioMustNotBeRegeneratedForTranscription=true. The original MP3 and VTT are inside a Git-ignored review directory, not versioned in GitHub. The fresh GitHub runner therefore cannot recover them from the repository.

Production must block the Tajik version until the exact approved audio/captions and matching imported working copy are independently restored and checked against the saved hashes. Never create a replacement voice take or invent timestamps simply to make CI green. The Russian version has its own approved voice and may be tested separately.

## Production stages

1. Resolve the exact canonical date or episode ID and requested language(s); do not silently change the date.
2. Refuse duplicate verified publications and prohibited regeneration of approved sample audio.
3. Check the API secret and install frozen dependencies.
4. Run existing npm run content:make with the exact episode and language, using real Gemini speech, word-level captions and Remotion exports.
5. Require rendered-pending-owner-approval per language; check both Instagram and YouTube MP4s, SRT, post copy, embedded audio, portrait dimensions, duration, size and SHA-256.
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
