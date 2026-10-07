# HSK AI project memory

## Purpose

Prepare review-ready, Russian-language HSK 1–2 Mandarin lesson videos on a dated calendar. After a final per-post preview and explicit owner confirmation, publish or schedule through the connected Zernio MCP to Instagram Reels and TikTok.

## Architecture

- Local Node.js stdio MCP server: `scripts/mcp-server.mjs`. Project clients are configured through `.codex/config.toml` and `.mcp.json`.
- Content is stored as JSON, not in a database. `content/calendar.json` maps dates to the canonical episode files in `content/episodes/`.
- Record shape and invalidation rules are specified in `content/EPISODE_SCHEMA.md`.
- `content/EDITING_SPEC.md` defines narration-synced beats inside one transparent central stage, caption treatments, motion, sound, and review rules. Keep the stage free of an enclosing card/backplate, generic header chips, `ON AIR` labels/meters, and segmented progress rails. Lesson visuals change on exact spoken object/idea cues and settle on the full phrase; transitions use gentle crossfades or small eased slides with no flash, strobe, bright sweep, glitch, or repeated per-word pulse. The current CTA shows the Instagram profile, the links overlay, then the HSK AI download page, with the relevant row/button highlighted in sync. `scripts/caption-utils.mjs` shares phrase timing and scene styling between Remotion and the sidecar SRT; captions are ink, have no backing, and group no more than two words.
- `scripts/import-online-tts.mjs` imports audio and word-timed SRT/VTT downloaded by the agent from the owner-selected TTS site. `src/EpisodeComposition.tsx` renders a 1080×1920 composition with timed caption overlay; `scripts/render-episode.mjs` writes the review package.
- `content/voice-profile.json` is the canonical voice configuration and one-time approval record.
- `content/hook-lab.json` and `content/HOOK_LAB.md` define distinct per-episode hooks, owner corrections, cautious comparison thresholds, and owner-entered platform readbacks. `record_hook_correction` preserves feedback as append-only active rules; `get_hook_learning_status` returns those rules and learning state; `record_hook_analytics` records metrics. They do not connect to platforms or publish.
- Hook policy now aims for platform-aware discoverability and shareability across Instagram Reels, TikTok, and YouTube Shorts: real beginner situations, quick accurate payoffs, and rotating dialogue, contrast, and challenge formats. This is a testable creative direction, not a viral guarantee. Manual readbacks include YouTube’s “How many chose to view” metric alongside watch-ratio metrics; compare only matched platform cohorts.
- `content/cta-lab.json` and `content/CTA_LAB.md` are the append-only CTA correction and learning service. The current Russian path is HSK AI → Instagram profile → profile link → website download, synchronized to voice and shown with owner-supplied screenshots. Registrations snapshot copy, transitions, placement, and lesson/voice context. Metrics never change the CTA automatically; no DM automation exists.
- The connected Zernio MCP plugin provides account discovery, video upload, Instagram/TikTok publishing, and scheduling. `scripts/mcp-server.mjs` records the owner-approved preview and the returned Zernio result in `review/<id>/approval.json` and `publications.json`; the project calls no direct social API and stores no Zernio keys/tokens. The fixed HSK AI CTA is declared to TikTok as own-brand promotional content, and the synthetic narration is AI-labeled there. Only Instagram and TikTok are allowed by the current owner rule.
- Generated/review data stays in ignored `review/` and `public/generated/` folders. The exact platform copy, account handles, disclosure settings, schedule and returned Zernio post IDs live with the dated review package.

## Data and production flow

- Calendar dates use `Asia/Shanghai`. Each episode has date, ID, Russian-language metadata, ordered scenes, Chinese examples, captions, and one `voiceProfileId`.
- The production voice provider is `text-to-speech.online`, operated through available browser automation; no API credentials are needed. Dmitry – RU, ru-RU, male, speed 0%, pitch 0%, MP3 is the owner-selected, series-wide approved voice. Reuse it without per-episode approval prompts. No fallback voice/provider is allowed.
- Flow: list date → read plan and durable Hook/CTA rules → apply requested edits → prepare TTS text → agent generates/downloads matching MP3+word-timed captions in the browser → import → render and inspect MP4/SRT/post/status → discover eligible Zernio accounts and platform settings → prepare exact captions/hashtags and a final preview → wait for the owner’s “yes” → upload and publish/schedule via Zernio → record IDs/status/links. A clear production command means continue through the review package, but never post before the final preview confirmation. Never ask the owner to operate the TTS page or move files.
- Cross-chat handoff: resolve “today” in `Asia/Shanghai`; if that date is absent, do not invent or silently substitute a calendar episode—report the next planned date/topic and state that no render ran. The approved series voice is not reconfirmed per video. Ask a distinct final confirmation for the exact Instagram/TikTok copy, accounts and publish time. `AI_RULES.md` and `content/WORKFLOW.md` contain the response procedure.
- Duration target is 25–35 seconds. Maintain the rolling content plan at least four weeks ahead, with one audience problem and useful verified lesson per episode across three weekly videos.
- Script edits that alter narration invalidate voice and captions; any content change invalidates the rendered package and prior approval.
- Each episode preregisters a versioned hook hypothesis and one main format. The sample has no measured performance until it is published and dashboard metrics are recorded. Comparisons are stratified by platform, window, metric, HSK level, and 25–29s/30–35s duration band; topic can still confound results. `question` remains a comparison baseline, not a proven best format.

## Brand and references

- HSK AI logo; owner-sourced HSK-AI-Bot paper/ink palette with cinnabar, jade, and gold accents; large high-contrast lesson typography on an open, transparent central layout with no enclosing stage card. The palette source is recorded in `content/reference-sources.md`.
- The Remotion composition supports an episode-local music bed at `content/visual-system.json` volume 0.07 with short fades. There is no cleared music bed in this workspace yet; do not substitute SFX for music.
- `content/visual-system.json` is the visual token source. HeroUI Native MCP informs semantic UI roles. Pinterest and posts.design are candidate references, but the supplied Pinterest screenshot has no saved item and the posts.design screenshot has no selected post.
- HeroUI Native MCP remains the native-app reference. The project-scoped HeroUI React v3 MCP and skill inform small UI details shown inside generated videos (comment field, send button, row, status badge), not the project's own management UI; Remotion remains the animation/runtime tool. The owner selected posts.design as a motion-reference site; `content/reference-sources.md` records the opened “Folder animation” page and its HSK AI adaptation.
- Remotion remains the video runtime. The HeroUI MCP is a reference/design-system tool.
- The owner's 36 local motion/video skills are copied into `.agents/skills/` alongside the existing HeroUI skill (37 skill directories total). `content/SKILLS.md` defines their use in this project: Remotion guidance applies to the current series; generic HyperFrames, voice, intake, publishing, and brand workflows must be reconciled with the established HSK rules before use. Adding the pack does not migrate the renderer or authorize another voice provider.

## Important constraints and open decisions

- No OpenAI/Whisper, Gemini, ElevenLabs, macOS TTS, or other replacement providers. The earlier workflow/docs naming those services were stale and have been replaced or disabled.
- Never post before the owner confirms the exact Zernio preview. Package approval records consent for one exact set of platforms/accounts, captions, settings and time; it does not post by itself.
- The current required CTA is “Попробуй HSK AI. Зайди в профиль, открой ссылку и скачай приложение с сайта.” Show profile → profile links → download page with cue-synced highlights. The previous comment/DM wording remains historical in CTA Lab and is superseded for current and future episodes.
- No database or social credentials are stored in the project. Analytics are still entered by the owner; there is no automatic analytics connection, platform-specific variant rendering, or cover/thumbnail generation. Zernio account handles are resolved from the connected accounts for each publication and are never guessed.
- Current publishing targets are Instagram Reels and TikTok; keep one clean 9:16 master. Do not publish to Telegram or another platform unless the owner explicitly changes the rule.
- The speech site cannot prove the selected voice from MP3 metadata; its exact profile must be selected manually and recorded without overstating verification.
- Chinese-language source URLs and review dates are recorded for the 2026-09-28 sample; the other 11 planned episodes still need source receipts. Calendar referenceFacts are planning notes, not independent language-review receipts.

## Known quality gates

- Verify Russian script, Chinese Simplified characters, tone-marked pinyin, translation, word-level caption timing, burned-in subtitle readability, sidecar SRT, and duration before presenting a package as ready.
- `prepare-online-tts.mjs` writes narration as one continuous paragraph, preserving words and punctuation; blank-line scene breaks can create pauses that a multiline MP3 carries while its VTT timings omit. Still check the last spoken phrase against its cue before trimming trailing audio.
- Canonical episode records may use `voiceProvider: text-to-speech.online` as the site label, while `voice-profile.json` uses `text-to-speech-online` as its provider key. `normalizeVoiceProvider` in `scripts/lib.mjs` maps the legacy label across preparation, import, render, MCP checks, and CTA snapshot comparisons. Keep the canonical episode label and historical CTA snapshots unchanged; this does not change the approved provider, service, or voice settings.
- Remotion `Audio.trimAfter` takes the absolute source-frame endpoint, not the number of frames to remove from the tail. `import-online-tts.mjs` computes that endpoint after the last timed word plus a short pause; confusing it can leave a full-length video with only a few seconds of speech.
- The active schedule and actual outputs may change; inspect the dated JSON and `review/<id>/status.json` rather than inferring from this memory.
