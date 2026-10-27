# HSK AI Content System — current overview

This file is an architecture overview, not a second copy of live production policy.

## Canonical sources

- `hsk-tu-vous/AI_RULES.md` — the single source of truth for active, changeable production rules.
- `hsk-tu-vous/AGENTS.md` — agent operating and rule-maintenance procedure.
- `hsk-tu-vous/PROJECT_MEMORY.md` — current architecture/state only; it must not preserve superseded active rules.
- `hsk-tu-vous/content/calendar.json` — the only source of shared production dates and lesson IDs.
- `hsk-tu-vous/content/languages.json` — default production languages and per-language content roots.
- `hsk-tu-vous/content/episodes/` — canonical episode plans.
- Each configured content root’s `voice-profile.json` — its voice/model configuration and approval state.
- `hsk-tu-vous/content/HOOK_LAB.md` and `CTA_LAB.md` — hook/CTA learning rules and history.
- `hsk-tu-vous/content/visual-system.json` and `EDITING_SPEC.md` — visual/render rules.

Do not copy mutable values such as language, audience, provider, platform targets, cadence, episode count, CTA wording, or voice settings into this overview. Read them from the canonical files above.

## What the system does

HSK AI Content Studio is a local content-production pipeline for short HSK videos. Its job is to turn a planned episode into a review-ready vertical video and, only after explicit owner approval of the exact publication preview, publish or schedule it through the connected social-publishing integration.

High-level flow:

1. Resolve the requested date from `content/calendar.json`.
2. Load the canonical episode and current hook/CTA rules.
3. Prepare independent dated working copies and narration for every configured production language.
4. Produce/import the approved voice artifacts and word-level timing.
5. Render the video with Remotion.
6. Validate language, timing, captions, visuals, duration, and package files.
7. Build the exact platform publication preview.
8. Wait for explicit owner approval.
9. Publish/schedule through the connected publishing integration and record the result.
10. Store analytics/readbacks separately from production rules.

## Architecture

- **Node.js + MCP:** `scripts/mcp-server.mjs` exposes project actions to an AI coding agent.
- **Content as files:** calendar, episodes, hook/CTA data, voice state, and visual rules are stored in versioned files rather than a database.
- **Remotion + React/TypeScript:** `src/` renders the timed 9:16 video.
- **Production scripts:** `scripts/` prepares, imports, validates, renders, approves, and records publication state.
- **Review packages:** generated outputs use an independent root for each language under `review/<episode-id>/` and are not treated as canonical planning data.
- **Publishing:** publishing is a separate final step and always requires the owner’s approval of the exact preview.

## Rule-change policy

When the owner changes an established rule, the change is a **rule migration**, not an additional note.

In the same task, the agent must:

1. update the new active rule in `AI_RULES.md`;
2. search active docs/config for the old rule and equivalent wording;
3. replace or delete every superseded active statement;
4. update `PROJECT_MEMORY.md`, `WORKFLOW.md`, README/config files when they describe the changed rule;
5. preserve old values only inside clearly historical/append-only analytics or correction logs, where they must remain marked as superseded/history;
6. verify that no active contradictory rule remains.

A newer active rule must never coexist with an older contradictory active rule “for context”.
