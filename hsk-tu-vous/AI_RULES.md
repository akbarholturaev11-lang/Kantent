# HSK AI — active production guardrails

These are the **current global policies** for every agent and chat. They are deliberately not a copy of settings, calendar entries, creative Lab procedures or technical implementation details.

## Ownership and precedence

Read `AGENTS.md` for the ownership map and migration protocol. In case of conflict, the latest explicit owner instruction authorizes a **migration of the owning source**, not a silent override in one chat. Stop and reconcile inconsistent active files before production or publication.

- `AI_RULES.md`: global behavior, editorial limits, publishing authorization and safety.
- `content/voice-profile.json`: sole source of approved provider/voice/settings.
- `content/cta-lab.json`: sole source of current CTA wording/offer and correction state; `content/CTA_LAB.md` describes its use.
- `content/hook-lab.json` and `content/HOOK_LAB.md`: hook experiments, corrections, readback policy and editorial criteria.
- `content/calendar.json`: dates, IDs, schedule and timezone.
- `content/visual-system.json`: numeric design and caption settings; `content/EDITING_SPEC.md` explains editing technique.
- `content/EPISODE_SCHEMA.md`: persisted episode/review record shape.
- `content/WORKFLOW.md`: operational order, error handling and preview process.

**Rule changes are migrations.** Update the owning source, search active documents/configuration/code for all dependent copies, remove or reconcile superseded active statements, run `npm run check:consistency` and test the affected flow. Preserve historical experiment data and already approved/published snapshots as historical evidence; never relabel old content as current. No automated check can detect all semantic contradictions, so agent review remains mandatory.

## Teaching and scripts

- The current production series teaches Mandarin to **Russian-speaking HSK 1–2 beginners**. Write explanation, voice and platform copy in Russian Cyrillic. Present Simplified Chinese characters, tone-marked pinyin and a concise Russian meaning for each teaching example.
- One useful, well-explained point per episode. Verify tones, grammar, word order, meaning and examples from trustworthy references; preserve source URLs/review dates in the episode record. Calendar planning notes are not proof of language verification.
- Use only dates and episode IDs from `content/calendar.json`. Keep explicit dated video requests strict; never silently retarget an existing date. **Owner-authorized daily Calendar Reserve (2026-10-15):** the reserve agent may repair unapproved future CTA-free lesson drafts and add NEW future calendar dates and complete CTA-free episode drafts **directly to `main` via the connected GitHub connector**, after validating current `main`, source evidence, lesson completeness, date/ID uniqueness and relevant tests; see `content/WORKFLOW.md`. This permission applies only to future planning and lesson JSON, not social media production or publication, and operates when `content/calendar.json#planningBuffer` is below target; follow `planningWeekdays`, verify Chinese sources and comply with `content/EPISODE_SCHEMA.md`. Do not create empty placeholder scripts, rename existing IDs, or edit approved/published history. This drafting permission is not voice, rendering or publication permission. For "Бугунги видеони тайёрла", use the nearest future planned item if today's slot is absent and disclose its date; see `content/WORKFLOW.md`.
- Make a complete dated plan before producing audio: narrative, visual beats, verified Chinese examples, hook hypothesis, CTA snapshot and post copy.
- Never invent product features, reviews, learner results or engagement metrics. Claims about the HSK AI app must be supported by real owner-provided product evidence.

## Hooks, CTA and analytics

- Apply `content/HOOK_LAB.md` and the **active** corrections in `content/hook-lab.json`; choose a specific genuine beginner problem, a truthful payoff, and a distinct hook format. Follow the Lab's timings, screening checks and versioned measurements rather than copying numbers into this file.
- Apply the active platform CTA **only by reading `content/cta-lab.json`**. One central registry defines Instagram, TikTok and YouTube variant readiness; episode CTA fields are version-bound working/approved snapshots, not competing editable settings. For Instagram and YouTube, reuse the same lesson body; only the final CTA scene changes. If CTA narration is identical, reuse the approved audio and word cues. Do not create or regenerate a separate lesson for each platform. Never route an unapproved TikTok/YouTube placeholder to voice/render or silently copy Instagram wording. Follow `content/CTA_LAB.md` for platform-specific cue-synced execution and mandatory corrections.
- A new CTA direction requires an explicit owner instruction. Analytics may inform a proposal, but must not silently replace the approved CTA. Never request comments/DMs or use auto-DM unless a newer owner-approved CTA explicitly enables them.
- The owner-approved TikTok manual-DM variant may be prepared as a separate local review package with a fresh matching voice and word cues; this does not authorize TikTok publishing or automated DM delivery.
- Preserve historical hook/CTA corrections, readbacks and experiment IDs as immutable append-only evidence with supersession status. A new rule should not rewrite past performance.
- Track performance from real platform results only, keeping each platform's metric definitions and windows separate. Unmeasured is not the same as zero.

## Approved voice

- `content/voice-profile.json` is the **only place** where the active provider, Gemini models, locale, voice, spoken style, audio format and approval status are defined. Do not duplicate those settings here.
- Gemini API is the production path for Russian narration and word-level transcription. `content:voice` generates MP3 and word timestamps, checks that normalized words match the exact script, and imports both into the dated review package. The ordinary video workflow runs this automatically.
- The chosen series voice is reused automatically once approved. Do not ask to reconfirm it for each episode. A different voice/provider or changed settings need an explicit owner decision and a freshly approved sample. While a new profile is `pending-owner-approval`, production is limited to the sample episode named in `content/voice-profile.json`.
- Gemini receives the episode narration and generated audio for transcription. Keep `GEMINI_API_KEY` in local `.env.local`; never put credentials in source, logs or review artifacts. The generated audio upload is deleted from Gemini after transcription; record and surface a cleanup failure.
- If the Gemini profile, API or required word timestamps are unavailable, report the exact error. Never switch providers, invent audio, or bypass access controls to conceal failure.
- Treat the voice name in the Gemini request as the requested voice identity; still listen to the generated voice in the rendered sample before approving the profile.

## Visuals, timing and QA

- For dated HSK lesson videos, keep the existing React/Remotion renderer. Separate premium promotions and advanced standalone motion videos may use HyperFrames according to the canonical engine-selection policy in `content/SKILLS.md`; never silently migrate existing lessons. Apply `content/visual-system.json` for quantitative design values and `content/EDITING_SPEC.md` for transitions, captions, sound and shot composition. The dated lesson format is 9:16 at 1080×1920. Set duration from the complete scenario and synchronized narration; there is no fixed duration cap.
- Build meaningful synchronized scenes—not a static slideshow. A visual object/person should correspond to the spoken cue. Keep subtitles legible on a phone, with correct word-level timing and no overlap with crucial lesson/CTA content.
- Use genuine owner-approved product screenshots. Avoid copying third-party branded visuals; source examples and creative inspiration do not authorize infringement or fabricated UI.
- Narration edits invalidate imported voice and caption timing. Any content/visual change invalidates the render, final publication preview and prior package approval; regenerate and inspect the updated package.
- Validate video duration, voice/caption match, pinyin, Chinese content, design safety margins, music/effects, encoded video, sidecar captions and metadata before calling a review package complete.

## Publication and credentials

- Current social publication destinations: **Instagram Reels and YouTube Shorts** through the existing **Zernio MCP** connection. TikTok is not an authorized destination. Do not publish elsewhere unless the owner explicitly changes this policy.
- A production request authorizes work **through** a finished review package, not publication. Before any media upload, scheduling or post creation, present the exact final video, destination accounts, each platform's caption/description and hashtags, disclosure/settings, and publish time; wait for the owner's unambiguous approval of that preview. YouTube previews must include an exact title (up to 100 characters), visibility, made-for-kids selection and synthetic-media disclosure.
- Match current platform rules: choose YouTube audience and altered/synthetic-content settings for each video based on its actual content; never silently default or copy them between videos. Verify any applicable Instagram AI labels and feed distribution. Never guess account IDs or reuse stale platform capability checks.
- The authorized connection handles credentials. Never store OAuth tokens, service keys or social passwords in source, memory, scripts, comments or artifacts. If an account needs reconnection, report the blocker.
- After approval, publish/schedule only through the permitted integration and record returned IDs, status, time and links. Distinguish queued, scheduled, processing, partial, failed and published. Never retry an ambiguous response before confirming whether the post exists.
- When a target platform is unavailable or the requested publication time is unclear, ask the owner for the **specific missing decision** instead of silently omitting a platform or inventing a time.
