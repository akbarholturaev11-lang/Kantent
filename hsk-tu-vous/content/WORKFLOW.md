# HSK AI video production — operating procedure

This file describes **the sequence of operations**, not the values of production settings. Start with `AGENTS.md` and `AI_RULES.md`. Read current values from the canonical files listed in `AGENTS.md`; never substitute remembered dates, voice profiles or CTA wording.

## Owner-authorized independent cinematic pilot

The older `zai-location` calendar episode remains at its original date and its verified Instagram/YouTube published post IDs remain untouched. Its video was made before the new creative renderer was confirmed; it must **never** be counted as a Cinematic format result (a user-reported old view count is not a comparable 7d platform measurement). The owner separately authorized redoing the **same learning topic** as a first real cinematic pilot.

The canonical calendar permits only one episode per date, so the recut is a new additional review slot `2026-10-13` named `zai-location-cinematic-v2`. This deliberately uses the original lesson's verified Chinese learning facts but a new situation-driven hook and narration, a new independent Hook Lab identifier, the existing approved voice profile, original illustrated Street Situation storyboard, and a fresh immutable CTA registration against the unchanged central profile-to-website message. No MP3 or final MP4 is falsely claimed. The original episode's publication ledger remains as historical evidence, not an eligible pilot outcome.

`prepare_today_video` skips the externally verified published old episode and selects this new unpublished slot before the regular upcoming videos; `content:make -- 2026-10-13` targets the new episode only. The exceptional recut **does not advance** the four-format rotation, so the following regular Speed Quiz stays a Speed Quiz. Do not reuse the original post ID, edit its published snapshot, clone its rendered preview approval, treat its lifetime views as new-format data or post the recut without exact owner preview approval.

## Published-video deduplication (verified Zernio evidence)

`content/published-posts.json` holds narrowly scoped verification records keyed by the **calendar episode ID**, platform and real Zernio post ID. Records must come from an actual connected Zernio `posts_get` readback showing `published`; a scheduled timestamp or owner-approved local package alone is never publication evidence. The schedule time does not redefine the canonical calendar date. Publication evidence **does not prove** the post was generated with the current renderer; `creativeFormatVerified:false` is intentional until an audited exported MP4 is matched.

For exactly `prepare_today_video`, resolve the calendar-local date then skip all episodes with verified published evidence. The nearest still-unpublished future `planned` entry is selected. For explicit dated production, return an already-published report rather than rerendering or overwriting the prior video. The `content:draft`, `content:make`, `content:voice` and `content:render` CLI paths also refuse duplicate generation. If a completely new cinematic edition is wanted, create a separately dated episode ID and obtain owner approval; **never change or delete published historical render/CTA/analytics versions**. The publication snapshot is not real-time and requires new Zernio verification when new posts publish.

## Automatic creative storyboard for upcoming videos

The command `prepare_today_video` resolves the calendar slot first and loads its **CTA-free** canonical lesson. `scripts/auto-storyboard.mjs` now deterministically selects the matching creative treatment from `content/creative-formats.json`, anchored at `automaticStoryboard.fromDate`, and writes the chosen `creativeFormatId` and per-scene storyboard **only into the working review copy**. The same date always gets the same compatible format, even when run another day. Already preselected compatible source formats are preserved. The CTA is then composed from the central CTA Lab. No published episode, voice profile, spoken narration, hook experiment or calendar slot is rewritten. Quiz option text must consist of genuinely authored vocabulary terms; when two suitable alternatives cannot be sourced from the lesson, the system uses compatible `problem-fix` visuals rather than inventing a question or answer. Each of the four treatments has a distinct Remotion appearance.

For existing `review/<id>/episode.json` files, an old storyboard may be migrated **only** if the saved copy exactly matches the current canonical lesson on all non-format fields, stage is `planned`/`plan-ready`, and no voice or timed captions have been produced. Modified, rendered, approved and voice-prepared copies are never silently overwritten; the command reports an actionable conflict. A new script or voice export still requires the existing MP3 + word-timed VTT/SRT procedure and preview approval; this change does not autonomously generate sound, render publishable MP4s or post anything.

`npm run content:viral-plan -- --json` continues to be a **read-only** reporting and experiment-planning command. It reads `content/creative-formats.json`, existing future calendar episodes and the validated Zernio feedback snapshots; it does **not** modify episodes, scripts, voice, CTA, media or publication. The hook experiment ID/format already registered on an episode remains authoritative: no automatic hook migration is authorized. The 12-post pilot is a goal, not a second calendar or an instruction to invent dates. Integrate relevant shot/beat guidance into **new or unapproved** source drafts only after genuine teaching-source verification; preserve the single learning point, current hook controls and current central platform CTA. For evidence-based decisions require same-platform/level/duration actual 7d readbacks with verified post-to-episode-to-format attribution. Never use cumulative lifetime views to claim a winning format.

## Automated scenario buffer — planning only

The owner authorizes creating **new future** dates and full CTA-free lesson plans when the canonical `content/calendar.json#planningBuffer` is below target. Use `npm run content:scenario-buffer -- --json` (or `--date YYYY-MM-DD` in tests) for a read-only shortlist of dates/needed repairs, respecting `planningWeekdays` and the existing publishing cadence. Write complete teaching scenarios with real language-source verification and unique hook hypotheses in `content/episodes/`, then register their IDs/dates in the canonical calendar **in the same PR**. Do not count a blank template as a prepared scenario. Keep approved/published history, voice and central CTA unchanged; generated scenarios require the usual production QA and owner approval before publication. A missing future slot in an explicit dated video request is still an error; do not silently synthesize one.

## 1. Resolve the requested episode

1. Resolve relative dates in the timezone defined in `content/calendar.json`.
2. Use `list_planned_dates` and `get_production_plan`. New `content/episodes/*.json` source lessons deliberately exclude CTA. The plan/draft loader runs `composeLessonCta` against the currently approved `content/cta-lab.json` template, creating the **working** CTA snapshot. If you inspect raw lesson JSON directly, do not treat a missing CTA as a missing lesson.
3. **Owner-approved relative command:** for exactly «Бугунги видеони тайёрла» / "prepare today's video", use the calendar's timezone and the MCP `prepare_today_video` tool. If today has no entry, automatically select the **nearest future** entry with `status: planned`, disclose both dates and keep the episode's original calendar date/ID. Never rename the next episode to today, or select an older episode. If no future planned entry exists, stop and report that there is nothing to prepare.
4. **Explicit dates remain strict:** if the owner specifies a particular YYYY-MM-DD, use that exact date; if absent, report it rather than substituting another date. For requests other than the approved "today's video" command, do not silently change dates.
5. Read the current voice profile and Hook/CTA Lab active corrections before drafting.

## 2. Prepare the plan

1. Check the language examples against trustworthy references and record dated evidence. The calendar's reference facts are not independent verification.
2. Apply active Hook Lab rules. Record a dated hypothesis and one dominant opening pattern, without inventing audience-performance results.
3. Read the single `content/cta-lab.json` registry for the requested **platform**. Instagram and YouTube use `offer.canonicalRussian`; the lesson body is shared, and YouTube changes only the two supplied screenshots in the final CTA scene. Since the spoken CTA is identical, reuse the approved audio and word-level cues. A changed CTA scene needs a fresh CTA registration, final export and review; it does not need a separately written or generated lesson. TikTok CTA remains pending and TikTok is not an authorized publishing destination. Call `get_platform_cta_status`; never promise an unverified keyword DM or invent a platform link. Normal make/render/MCP preparation automatically includes the approved YouTube ending. Its baseline registration inherits only the current correction acknowledgements already explicitly reviewed for the base; a new or missing correction blocks the derivation. A changed spoken CTA blocks shared export until matching voice/cues exist. Preserve old registrations and published snapshots.
4. Finish the narration, relevant Chinese characters/pinyin/meaning, scene plan, synced visual beats, subtitles, and post text before voice generation.
5. Use the spec/schema and design token sources linked in `AGENTS.md`. An episode-level change affects its working copy; do not rewrite canonical published history.

## 3. Generate and import speech

1. Check `content/voice-profile.json`. Reuse its approved configuration; a new voice/provider decision requires the owner's separate authorization and new sample.
2. Prepare the exact script as the dated `tts-input.txt`.
3. The agent—not the owner—uses its available browser automation to operate the approved website, export audio and word-level subtitle cues, and save them in the matching `review/<episode-id>/incoming/` directory.
4. Import the exact matching audio and VTT/SRT through `import_voice_artifacts`. Validate script fingerprint, cue granularity, start/end timestamps and duration.
5. Stop only for a real external blocker (login, CAPTCHA, permission gate, missing approved voice, missing export) or failed validation. Never change providers silently and never request routine manual file handling from the owner.

## 4. Render and validate

1. Run the existing Remotion renderer on the dated working copy. It automatically renders the shared lesson once, each approved CTA ending, and one continuous voice/sound mix. Both final MP4s reuse identical encoded lesson frames; the join does not split the speech audio.
2. The renderer writes the Instagram package to the existing review root and the YouTube package under `review/<id>/youtube/`, each with MP4, baked-in subtitles, sidecar SRT, episode snapshot and post copy. `status.platformPackages` lists exact files, content hashes, video hashes and CTA registrations. A failed output keeps the whole job in a failed stage; do not silently omit YouTube.
3. Inspect speech/cue alignment, the last spoken phrase, tone-marked pinyin, visual relevance, shot transitions, safe areas, music/effects and on-screen readability against `content/EDITING_SPEC.md` and `content/visual-system.json`.
4. A narration edit invalidates imported speech/timing and all downstream media; a visual or packaging edit invalidates the video, post preview and approval. Re-render and re-review before presenting as ready.

## 5. Preview, approval and publishing

1. Resolve the connected Instagram Reels or YouTube Shorts account and its platform-specific requirements through the currently authorized publishing integration specified in `AI_RULES.md`. For YouTube, include the exact title, visibility, audience selection and synthetic-media disclosure in the owner preview.
2. Present each destination’s **actual** video from `status.platformPackages`, exact accounts, captions/hashtags, disclosures, and immediate/scheduled posting time in the configured timezone. Instagram must use its root export; YouTube must use its YouTube export. Approval verifies the current snapshot/CTA and media hash for each selected target, and returned post records retain that binding.
3. Wait for explicit owner approval of **that specific preview**. Production authorization or voice approval is not publishing consent.
4. Only then upload/publish or schedule each platform's corresponding video through the authorized integration as a separate platform post; a single shared media file must not be sent to both accounts. Store each returned ID, status and link with its approved platform video/CTA binding. Never infer success from an ambiguous tool result or retry without checking.
5. Collect later metrics only from verifiable owner/platform readbacks; do not fabricate engagement outcomes.

## Rule changes and handoffs

Rule changes must update the canonical source and remove conflicting active copies in the same task. Follow `AGENTS.md`, run `npm run check:consistency`, and review code references that may depend on the changed setting. Historical experiment/publication snapshots are immutable evidence; do not rewrite them to appear current.

The current source of episode dates is always `content/calendar.json`. Audio settings are always `content/voice-profile.json`; current CTA wording is always `content/cta-lab.json`.
