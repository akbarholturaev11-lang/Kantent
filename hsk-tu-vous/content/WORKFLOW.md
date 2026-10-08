# HSK AI video production — operating procedure

This file describes **the sequence of operations**, not the values of production settings. Start with `AGENTS.md` and `AI_RULES.md`. Read current values from the canonical files listed in `AGENTS.md`; never substitute remembered dates, voice profiles or CTA wording.

## 1. Resolve the requested episode

1. Resolve relative dates in the timezone defined in `content/calendar.json`.
2. Use `list_planned_dates` and `get_production_plan`, or read the calendar/episode JSON directly.
3. **Owner-approved relative command:** for exactly «Бугунги видеони тайёрла» / "prepare today's video", use the calendar's timezone and the MCP `prepare_today_video` tool. If today has no entry, automatically select the **nearest future** entry with `status: planned`, disclose both dates and keep the episode's original calendar date/ID. Never rename the next episode to today, or select an older episode. If no future planned entry exists, stop and report that there is nothing to prepare.
4. **Explicit dates remain strict:** if the owner specifies a particular YYYY-MM-DD, use that exact date; if absent, report it rather than substituting another date. For requests other than the approved "today's video" command, do not silently change dates.
5. Read the current voice profile and Hook/CTA Lab active corrections before drafting.

## 2. Prepare the plan

1. Check the language examples against trustworthy references and record dated evidence. The calendar's reference facts are not independent verification.
2. Apply active Hook Lab rules. Record a dated hypothesis and one dominant opening pattern, without inventing audience-performance results.
3. Read the single `content/cta-lab.json` registry for the requested **platform**. Instagram refers to `offer.canonicalRussian`; TikTok/YouTube are independent variants and remain unavailable while `pending-owner-configuration`. Call `get_platform_cta_status`; never copy Instagram CTA to another platform, promise an unverified keyword DM, or invent a platform link. For an approved variant, register a separate episode/platform CTA snapshot and prepare matching platform-specific voice and word-level cues. Preserve old registrations and do not claim that three platform exports already exist. Then apply active CTA corrections for that platform.
4. Finish the narration, relevant Chinese characters/pinyin/meaning, scene plan, synced visual beats, subtitles, and post text before voice generation.
5. Use the spec/schema and design token sources linked in `AGENTS.md`. An episode-level change affects its working copy; do not rewrite canonical published history.

## 3. Generate and import speech

1. Check `content/voice-profile.json`. Reuse its approved configuration; a new voice/provider decision requires the owner's separate authorization and new sample.
2. Prepare the exact script as the dated `tts-input.txt`.
3. The agent—not the owner—uses its available browser automation to operate the approved website, export audio and word-level subtitle cues, and save them in the matching `review/<episode-id>/incoming/` directory.
4. Import the exact matching audio and VTT/SRT through `import_voice_artifacts`. Validate script fingerprint, cue granularity, start/end timestamps and duration.
5. Stop only for a real external blocker (login, CAPTCHA, permission gate, missing approved voice, missing export) or failed validation. Never change providers silently and never request routine manual file handling from the owner.

## 4. Render and validate

1. Run the existing Remotion renderer on the dated working copy.
2. Build the review package with the rendered MP4, baked-in subtitles, sidecar SRT, episode snapshot, post copy and status metadata.
3. Inspect speech/cue alignment, the last spoken phrase, tone-marked pinyin, visual relevance, shot transitions, safe areas, music/effects and on-screen readability against `content/EDITING_SPEC.md` and `content/visual-system.json`.
4. A narration edit invalidates imported speech/timing and all downstream media; a visual or packaging edit invalidates the video, post preview and approval. Re-render and re-review before presenting as ready.

## 5. Preview, approval and publishing

1. Resolve eligible accounts and platform-specific requirements through the currently authorized publishing integration specified in `AI_RULES.md`.
2. Present the **actual** finished video, exact accounts, captions/hashtags, disclosures, and immediate/scheduled posting time in the configured timezone.
3. Wait for explicit owner approval of **that specific preview**. Production authorization or voice approval is not publishing consent.
4. Only then run the permitted publish/schedule action through the authorized integration and store the returned IDs, statuses and links. Never infer success from an ambiguous tool result or retry without checking.
5. Collect later metrics only from verifiable owner/platform readbacks; do not fabricate engagement outcomes.

## Rule changes and handoffs

Rule changes must update the canonical source and remove conflicting active copies in the same task. Follow `AGENTS.md`, run `npm run check:consistency`, and review code references that may depend on the changed setting. Historical experiment/publication snapshots are immutable evidence; do not rewrite them to appear current.

The current source of episode dates is always `content/calendar.json`. Audio settings are always `content/voice-profile.json`; current CTA wording is always `content/cta-lab.json`.
