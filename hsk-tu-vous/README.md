# HSK AI Content Studio

A local AI-assisted production system for short HSK lesson videos. It plans episodes from a calendar, prepares narration, imports timed voice/captions, renders through Remotion, validates a review package, and prepares an **owner-approved** social publication. This is the content studio, not the HSK AI learner app.

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

A single owner request **«Бугунги видеони тайёрла»** routes through MCP `prepare_today_video`. It first checks the calendar-local date and, when today has no entry, takes the nearest future **planned** entry while disclosing its real date. Explicit YYYY-MM-DD requests remain strict. As before, the TTS website requires agent browser automation and might block on login/CAPTCHA; the tool may return a continuation step rather than a completed MP4. The video review package is the stop point: publication still requires exact-preview approval.

Future canonical `content/episodes/*.json` files intentionally store shared lesson scenes *without* CTA. The normal production loader currently attaches the Instagram ending; `scripts/episode-cta-assembly.mjs` can prepare another approved ending from `content/cta-lab.json` without changing the shared lesson. Instagram and YouTube reuse the canonical offer wording, and YouTube replaces only the two profile/link screenshots. When CTA narration is unchanged, the approved audio and word-level captions are reused. This does not create a separate lesson for each platform. The normal `content:render` / `content:make` / MCP preparation flow now produces both final exports automatically. The shared lesson is rendered once; separate CTA endings are concatenated with those same encoded lesson frames and one continuous audio mix. Instagram stays at `review/<id>/video.mp4`; YouTube is at `review/<id>/youtube/video.mp4`, with its own episode snapshot, SRT and post copy. `status.platformPackages` binds each destination to its video hash and immutable CTA registration. YouTube is published only after an exact preview. TikTok is no longer an authorized publishing destination.

Typical tasks: list dates, read a dated production plan, prepare a video, inspect its review package, and explicitly approve a final publication preview. See `content/WORKFLOW.md` for the process and real external blockers.

## Where each fact lives

Do **not** use this README as a second configuration file. `AGENTS.md` lists every canonical source:

- Global guardrails: `AI_RULES.md`.
- Production procedure: `content/WORKFLOW.md`.
- Dates: `content/calendar.json`; episodes: `content/episodes/`.
- Voice configuration and approval: `content/voice-profile.json`.
- Current CTA: `content/cta-lab.json`; creative/analytics policy: its Lab documentation.
- Hook testing: `content/hook-lab.json` and its Lab documentation.
- Design tokens: `content/visual-system.json`.
- Runtime details: `PROJECT_MEMORY.md`.

## Self-improvement foundation (read-only)

Run `npm run content:buffer` to check the next planned canonical episodes in the calendar timezone; run `npm run content:buffer -- --json` for a machine-readable report. Calendar coverage thresholds are owned by `content/calendar.json#planningBuffer`. A report below minimum exits with code 2. Neither command writes, generates, publishes, edits CTA, nor calls any external API.

`content/feedback/README.md` defines the evidence format and safeguards for future Zernio-to-ChatGPT analysis. Automatic Zernio ingestion, scheduled execution, script rewriting, and new calendar-date generation are **not** implemented in this phase; the owner-preview gate remains unchanged.

## Agent scenario reserve

`npm run content:scenario-buffer -- --json` proposes next publication dates for a shortfall (canonical `calendar.json#planningBuffer`, `planningWeekdays`). It creates **no** empty placeholder lessons and changes **no** repo files. ChatGPT may author the full, evidence-checked CTA-free future lesson JSON and register new dates/IDs in a review PR, subject to the active production rules. This is independent of video publishing.

## GitHub freshness before every video

Before creating a draft, preparing/importing speech, or rendering, the relevant CLI entrypoints and MCP prepare routine fetch both `origin/main` and the current remote branch using regular Git and require the checkout's HEAD to include both. Offline, missing Git auth or stale code means **fail closed**; update the local checkout manually and retry. Each review status captures the verified SHA. This uses existing Git access, **not a new API key**. The validator does not edit working files, force-push, or approve publication.

## Rolling 30-day Hook feedback

`content/hook-lab.json#policy` owns the performance analysis window: the last 30 days by **publication date**, an actual 24-hour provider window as early evidence, and an actual 7-day provider window for primary owner-review decisions. `npm run content:feedback -- --json` reports excluded historical post/windows and whether primary evidence exists. Lifetime metrics are preserved as source history but cannot be relabelled as day-specific. No automatic winner, CTA change or publication is permitted.

## Zernio feedback evidence (no extra API)

`npm run content:feedback` validates snapshots in `content/feedback/observations/` and prints descriptive performance metrics. Add `-- --json` for a machine-readable report. These snapshots come from the connected Zernio service, not from a separate API token or from HSK AI's learner application. `content/feedback/AGENT_PLAYBOOK.md` is the future ChatGPT ↔ Zernio ↔ GitHub execution protocol; unattended scheduling is not deployed yet.

## Changing a rule

Update the **owning file only** for the value itself. Follow the migration procedure in `AGENTS.md`: inspect all affected active references, remove conflicts, run `npm run check:consistency`, and verify relevant production behavior. Previously approved/published snapshots remain historical data.

Review files are local and generally excluded from Git. A GitHub commit alone does not prove a video was rendered or posted.
