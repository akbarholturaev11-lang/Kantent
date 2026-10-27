# HSK AI Content Studio

A local AI-assisted production system for short HSK lesson videos. It plans episodes from a calendar, prepares narration, imports timed voice/captions, renders through Remotion, validates a review package, and prepares an **owner-approved** social publication. This is the content studio, not the HSK AI learner app.

New standalone advertisements follow [PROMO_WORKFLOW.md](content/PROMO_WORKFLOW.md): an original life situation, a supported product demonstration and a minimalist frame. `npm run content:promo-plan -- speaking-cafe-example` (MCP `get_promo_plan`) defaults to every production language in `content/languages.json` and validates each source-bound story, sources and outstanding artwork/media work. Use `--language tg` only for an explicit one-language request. Missing/stale translations are reported per language without fallback. Shared promos live in `content/promos/`; translations live in each configured content root's `promos/` folder. This planning command does not generate or publish a video; the selected existing engine, approved voice, central CTA and exact final-preview process still apply.

## Start locally

Requires Node.js 20+.

```bash
npm install
npm run check:consistency
npm run dev
```

Open this `hsk-tu-vous/` directory in your coding agent. The local MCP server is declared in `.mcp.json` and can also be launched with:

```bash
npm run mcp
```

A single owner request **«Бугунги видеони тайёрла»** routes through MCP `prepare_today_video` and prepares every default language from `content/languages.json` for **one shared lesson**. An explicit dated request uses the same language set and keeps its exact date. If today has no eligible slot, select the nearest future planned slot and disclose its date. Each language returns its own review package or a concrete blocker; partial output is never reported as a completed multilingual job. Voice/model and exact publication-preview approval remain separate owner gates.

```bash
npm run content:make -- today
npm run content:make -- YYYY-MM-DD
npm run content:make -- YYYY-MM-DD --language ru
npm run content:make -- YYYY-MM-DD --language tg
```

Production MCP tools accept `language: "all"` by default, or a specific language. The batch ad planner `get_promo_plan` also defaults to `language: "all"`. Other per-language MCP read/edit/status/registration/approval tools accept `language: "ru"` or `"tg"`, defaulting to the legacy series. Individual voice/render CLIs use `HSK_CONTENT_LANGUAGE=tg`; this setting is inherited by child processes. Never reuse audio, word cues, CTA registration or approval from another language. A new locale profile may need an explicit model decision before generating its designated voice sample; read the selected profile and use `approve_voice_model_for_sample` only after the owner's exact decision.

Future canonical `content/episodes/*.json` files intentionally store shared lesson scenes *without* CTA. The normal production loader currently attaches the Instagram ending; `scripts/episode-cta-assembly.mjs` can prepare another approved ending from `content/cta-lab.json` without changing the shared lesson. Instagram and YouTube reuse the canonical offer wording, and YouTube replaces only the two profile/link screenshots. When CTA narration is unchanged, the approved audio and word-level captions are reused. This does not create a separate lesson for each platform. The normal `content:render` / `content:make` / MCP preparation flow now produces both final exports automatically. The shared lesson is rendered once; separate CTA endings are concatenated with those same encoded lesson frames and one continuous audio mix. Within the original series Instagram stays at `review/<id>/video.mp4`; YouTube is at `review/<id>/youtube/video.mp4`. The translated series has its own root at `review/<id>/tg/` with the same platform layout, with its own episode snapshot, SRT and post copy. `status.platformPackages` binds each destination to its video hash and immutable CTA registration. YouTube is published only after an exact preview. TikTok is no longer an authorized publishing destination.

Typical tasks: list dates, read a dated production plan, prepare a video, inspect its review package, and explicitly approve a final publication preview. See `content/WORKFLOW.md` for the process and real external blockers.

## Where each fact lives

Do **not** use this README as a second configuration file. `AGENTS.md` lists every canonical source:

- Global guardrails: `AI_RULES.md`.
- Production procedure: `content/WORKFLOW.md`.
- Shared dates and lesson identity: `content/calendar.json`; canonical lesson: `content/episodes/`; localized scripts under each content root in `content/languages.json`.
- Voice configuration and approval: the selected content root’s `voice-profile.json`.
- Current CTA: the selected content root’s `cta-lab.json`; creative/analytics policy: its Lab documentation.
- Hook testing: the selected content root’s `hook-lab.json` and shared Lab documentation.
- Design tokens: `content/visual-system.json`.
- Runtime details: `PROJECT_MEMORY.md`.
- Registered skills and stage selection: `content/skill-catalog.json`, `content/SKILLS.md` and MCP `recommend_skills`. Instagram lesson-hook, post-copy and competitor-research advisors are intentionally phase-specific.

## Automatic cinematic formats for upcoming video commands

The runtime now selects a hook-compatible visual format for every eligible future planned video and attaches storyboard fields before central CTA assembly. `prepare_today_video` uses this runtime path, as do `getPlannedEpisode`, `getEpisode` and the local production CLI; no need to manually add `storyboard` to upcoming canonical lesson files. Old clean plan-ready review copies are synced; voice-prepared, published, approved, and owner-edited copies fail closed instead of silently reverting to the old renderer. The calendar controls dates, `content/creative-formats.json` owns format assignment, and the selected language’s `cta-lab.json` remains its only CTA source. Gemini automatically generates narration and word-timed captions in the ordinary video workflow; voice profile approval, final MP4 approval and social publication remain owner gates. Test: `node --test scripts/auto-storyboard.test.mjs`.

## Cinematic story renderer — first pilot

The 12 October `zai-location` recut opts into a per-scene procedural cinematic illustration using `scene.storyboard`. The Remotion `CinematicStoryScene` produces original campus/street/home context motion, while the existing Chinese/pinyin/Russian teaching point and global captions remain. This review sample now includes Gemini-generated narration and word-timed captions, and is awaiting owner approval; it has not been published. CTA and older lessons do not opt in. Validate metadata with `node --test scripts/storyboard-validation.test.mjs`; TypeScript checks are run in the PR CI.

## Creative format pilot (read-only)

`npm run content:viral-plan` (or `npm run content:viral-plan -- --json` / `--date YYYY-MM-DD`) allocates compatible packaging hypotheses to upcoming *planned* episodes, using four formats in `content/creative-formats.json`: real-life situation, three-second quiz, self-contained serial, and mistake-to-fix. This is a **proposal**, not a script rewrite or automatic production: canonical episode hooks, voice, central platform CTA, dates, publication and approval stay unchanged. Only real source-verified, matched 7d creative observations may create an owner-comparison candidate; lifetime readbacks are insufficient. New format attribution must be verified and entered as `creativeFormatId` alongside the matching `episodeId`, `hookFormat` and `hskLevel` in observation snapshots. App activations are currently unmeasured, so 50–90K is an aspiration and never a forecast. Tests: `node --test scripts/viral-plan.test.mjs scripts/feedback-analyzer.test.mjs`.

## Self-improvement foundation (read-only)

Run `npm run content:buffer` to check the next planned canonical episodes in the calendar timezone; run `npm run content:buffer -- --json` for a machine-readable report. Calendar coverage thresholds are owned by `content/calendar.json#planningBuffer`. A report below minimum exits with code 2. Neither command writes, generates, publishes, edits CTA, nor calls any external API.

`content/feedback/README.md` defines the evidence format and safeguards for future Zernio-to-ChatGPT analysis. Repository-local automatic Zernio ingestion and unattended scheduling are **not** implemented in this Node.js package. Separate **ChatGPT scheduled agents** perform the daily scenario reserve and Monday/Wednesday/Friday feedback, when enabled, through the existing GitHub/Zernio connectors under `content/WORKFLOW.md` and `content/feedback/AGENT_PLAYBOOK.md`. These external agent schedules are not automatic social posting; the owner-preview gate remains unchanged.

## Agent scenario reserve

`npm run content:scenario-buffer -- --json` proposes next publication dates for a shortfall (canonical `calendar.json#planningBuffer`, `planningWeekdays`). It creates **no** empty placeholder lessons and changes **no** repo files. Under the owner-approved daily Calendar Reserve procedure, ChatGPT can author a full, source-checked future CTA-free lesson and register dates/IDs **directly in `main` via the GitHub connector** after all checks in `content/WORKFLOW.md`. New shared Instagram/YouTube lesson drafting consults the registered `ig-reel-planning` advisor for hook/storyboard suggestions only; the Hook Lab remains authoritative. This is independent of video rendering and publishing.

## GitHub freshness before every video

Before creating a draft, preparing/importing speech, or rendering, the relevant CLI entrypoints and MCP prepare routine fetch both `origin/main` and the current remote branch using regular Git and require the checkout's HEAD to include both. Offline, missing Git auth or stale code means **fail closed**; update the local checkout manually and retry. Each review status captures the verified SHA. This uses existing Git access, **not a new API key**. The validator does not edit working files, force-push, or approve publication.

## Rolling 30-day Hook feedback

`content/hook-lab.json#policy` owns the performance analysis window: the last 30 days by **publication date**, an actual 24-hour provider window as early evidence, and an actual 7-day provider window for primary owner-review decisions. `npm run content:feedback -- --json` reports excluded historical post/windows and whether primary evidence exists. Lifetime metrics are preserved as source history but cannot be relabelled as day-specific. No automatic winner, CTA change or publication is permitted.

## Zernio feedback evidence (no extra API)

`npm run content:feedback` validates snapshots in `content/feedback/observations/` and prints descriptive performance metrics. Add `-- --json` for a machine-readable report. These snapshots come from the connected Zernio service, not from a separate API token or from HSK AI's learner application. `content/feedback/AGENT_PLAYBOOK.md` is the separate ChatGPT ↔ Zernio ↔ GitHub feedback protocol, scheduled for Monday/Wednesday/Friday by an external ChatGPT automation when enabled. The code itself does not provide a headless scheduler or posting daemon.

## Changing a rule

Update the **owning file only** for the value itself. Follow the migration procedure in `AGENTS.md`: inspect all affected active references, remove conflicts, run `npm run check:consistency`, and verify relevant production behavior. Previously approved/published snapshots remain historical data.

Review files are local and generally excluded from Git. A GitHub commit alone does not prove a video was rendered or posted.
