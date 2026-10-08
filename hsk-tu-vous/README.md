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

## Changing a rule

Update the **owning file only** for the value itself. Follow the migration procedure in `AGENTS.md`: inspect all affected active references, remove conflicts, run `npm run check:consistency`, and verify relevant production behavior. Previously approved/published snapshots remain historical data.

Review files are local and generally excluded from Git. A GitHub commit alone does not prove a video was rendered or posted.
