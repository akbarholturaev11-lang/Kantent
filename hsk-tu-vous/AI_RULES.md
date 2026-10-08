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
- Use only dates and episode IDs from `content/calendar.json`. Keep explicit dated requests strict; never create or rename episodes without approval. **One owner-approved exception:** for the relative command "Бугунги видеони тайёрла", if today has no calendar item, select the nearest future `planned` item in the calendar timezone and visibly disclose the actual chosen date. See `content/WORKFLOW.md` for the procedure.
- Make a complete dated plan before producing audio: narrative, visual beats, verified Chinese examples, hook hypothesis, CTA snapshot and post copy.
- Never invent product features, reviews, learner results or engagement metrics. Claims about the HSK AI app must be supported by real owner-provided product evidence.

## Hooks, CTA and analytics

- Apply `content/HOOK_LAB.md` and the **active** corrections in `content/hook-lab.json`; choose a specific genuine beginner problem, a truthful payoff, and a distinct hook format. Follow the Lab's timings, screening checks and versioned measurements rather than copying numbers into this file.
- Apply the active platform CTA **only by reading `content/cta-lab.json`**. One central registry defines Instagram, TikTok and YouTube variant readiness; episode CTA fields are version-bound working/approved snapshots, not competing editable settings. Never route an unapproved TikTok/YouTube placeholder to voice/render or silently copy Instagram wording. Follow `content/CTA_LAB.md` for platform-specific cue-synced execution and mandatory corrections.
- A new CTA direction requires an explicit owner instruction. Analytics may inform a proposal, but must not silently replace the approved CTA. Never request comments/DMs or use auto-DM unless a newer owner-approved CTA explicitly enables them.
- Preserve historical hook/CTA corrections, readbacks and experiment IDs as immutable append-only evidence with supersession status. A new rule should not rewrite past performance.
- Track performance from real platform results only, keeping each platform's metric definitions and windows separate. Unmeasured is not the same as zero.

## Approved voice

- `content/voice-profile.json` is the **only place** where the active site, locale, voice name, speed, pitch, export settings and approval status are defined. Do not write a second copy here.
- The chosen series voice is reused automatically once approved. Do not ask to reconfirm it for each episode. A different voice/provider or changed settings need an explicit owner decision and a freshly approved sample.
- The agent must generate/export matching audio and word-level timing itself through the approved site with available browser automation. Preparing the text or asking the owner to download/move routine exports is not completion.
- If the approved provider, voice or required export is unavailable—or if login/CAPTCHA/permissions block it—stop and report the exact blocker. Never switch to another voice/API, invent audio, or bypass access controls to conceal failure.
- No external TTS/transcription API or additional paid credential path is authorized for this workflow. Do not send narration/audio to another service.
- Exported MP3 metadata does not independently prove the voice selected in a browser; represent verification limitations accurately.

## Visuals, timing and QA

- For dated HSK lesson videos, keep the existing React/Remotion renderer. Separate premium promotions and advanced standalone motion videos may use HyperFrames according to the canonical engine-selection policy in `content/SKILLS.md`; never silently migrate existing lessons. Apply `content/visual-system.json` for quantitative design values and `content/EDITING_SPEC.md` for transitions, captions, sound and shot composition. The current dated lesson target is 9:16, 1080×1920 at 25–35 seconds.
- Build meaningful synchronized scenes—not a static slideshow. A visual object/person should correspond to the spoken cue. Keep subtitles legible on a phone, with correct word-level timing and no overlap with crucial lesson/CTA content.
- Use genuine owner-approved product screenshots. Avoid copying third-party branded visuals; source examples and creative inspiration do not authorize infringement or fabricated UI.
- Narration edits invalidate imported voice and caption timing. Any content/visual change invalidates the render, final publication preview and prior package approval; regenerate and inspect the updated package.
- Validate video duration, voice/caption match, pinyin, Chinese content, design safety margins, music/effects, encoded video, sidecar captions and metadata before calling a review package complete.

## Publication and credentials

- Current social publication destinations: **Instagram Reels and TikTok** through the existing **Zernio MCP** connection. Do not publish to other destinations unless the owner explicitly changes this policy.
- A production request authorizes work **through** a finished review package, not publication. Before any media upload, scheduling or post creation, present the exact final video, destination accounts, each platform's caption/hashtags, disclosure settings and publish time; wait for the owner's unambiguous approval of that preview.
- Match current platform rules: check TikTok creator capabilities/privacy/toggles; disclose HSK AI's own-brand promotion and synthetic narration where required. Verify any applicable Instagram AI labels and feed distribution. Never guess account IDs or reuse stale platform capability checks.
- The authorized connection handles credentials. Never store OAuth tokens, service keys or social passwords in source, memory, scripts, comments or artifacts. If an account needs reconnection, report the blocker.
- After approval, publish/schedule only through the permitted integration and record returned IDs, status, time and links. Distinguish queued, scheduled, processing, partial, failed and published. Never retry an ambiguous response before confirming whether the post exists.
- When a target platform is unavailable or the requested publication time is unclear, ask the owner for the **specific missing decision** instead of silently omitting a platform or inventing a time.
