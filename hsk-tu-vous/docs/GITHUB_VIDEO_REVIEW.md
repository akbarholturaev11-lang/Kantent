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

The Gemini helper switches to another candidate on certain credential rejection errors at **a standalone TTS or upload request boundary**, never after a successful voice take. HTTP 429 exhausted quota is **NOT automatically bypassed** with another key, since keys in the same Google project share quotas. The repository Actions **variable** GEMINI_DISTINCT_PROJECTS_VERIFIED (default false) may be set to true **only after** independent project ownership and quota isolation have actually been established. It then permits one bounded attempt on the next configured distinct-project credential at a failed standalone TTS or upload request. For transcription failures after a file has already been uploaded, the script retains its existing fail-closed matching-audio safeguards; it does not silently regenerate audio or invent timestamps. The helper does not turn quotas into unlimited usage.

The GitHub UI lists only secret names, not validity; branch/PR CI uses synthetic fake keys and must not consume real Gemini quota. Real API availability will require a separate owner-authorized production run after default-branch workflow activation.

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
