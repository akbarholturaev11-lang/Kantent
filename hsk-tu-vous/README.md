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

Future canonical `content/episodes/*.json` files intentionally store lesson scenes *without* CTA. The working plan/draft loader attaches the approved platform CTA from `content/cta-lab.json`; old approved and published snapshots stay unchanged. `get_platform_cta_status` reports which variants can be prepared; Instagram is currently approved while TikTok/YouTube still require the owner to finish the content and flow.\n\nTypical tasks: list dates, read a dated production plan, prepare a video, inspect its review package, and explicitly approve a final publication preview. See `content/WORKFLOW.md` for the process and real external blockers.

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

## Zernio feedback evidence (no extra API)

`npm run content:feedback` validates snapshots in `content/feedback/observations/` and prints descriptive performance metrics. Add `-- --json` for a machine-readable report. These snapshots come from the connected Zernio service, not from a separate API token or from HSK AI's learner application. `content/feedback/AGENT_PLAYBOOK.md` is the future ChatGPT ↔ Zernio ↔ GitHub execution protocol; unattended scheduling is not deployed yet.

## Changing a rule

Update the **owning file only** for the value itself. Follow the migration procedure in `AGENTS.md`: inspect all affected active references, remove conflicts, run `npm run check:consistency`, and verify relevant production behavior. Previously approved/published snapshots remain historical data.

Review files are local and generally excluded from Git. A GitHub commit alone does not prove a video was rendered or posted.
