# Project memory — current architecture

This file is **not another policy document**. Keep only architecture, current technical state and hard-to-discover implementation constraints. For active behavior, read `AI_RULES.md` and the canonical sources in `AGENTS.md`. Delete superseded architecture notes when the implementation changes.

## Components

- Local Node.js MCP server: `scripts/mcp-server.mjs`; clients are configured in `.codex/config.toml` and `.mcp.json`.
- Planning lives in `content/calendar.json` and `content/episodes/`. These are JSON files, not a database. The review copy is stored under `review/<episode-id>/`.
- Audio preparation/import: `scripts/prepare-online-tts.mjs` and `scripts/import-online-tts.mjs`. The **only authoritative voice settings and approval state** are in `content/voice-profile.json`.
- Rendering: `src/EpisodeComposition.tsx` and `scripts/render-episode.mjs` using Remotion. `scripts/caption-utils.mjs` shares timing/phrase grouping between baked-in subtitles and exported SRT.
- Visual numeric tokens come from `content/visual-system.json`; shot-level editing rules from `content/EDITING_SPEC.md`.
- Hook/CTA experiments, corrections and owner-entered analytics reside in their respective `content/*-lab.json` files; explanatory methodology is in the corresponding `*_LAB.md` files. Preserve historical snapshots rather than rewriting past experiment results.
- The publication integration uses the existing connected social MCP. `mcp-server.mjs` records the approved preview and returned post IDs/status under each episode's review package. It does not store platform credentials or provide direct social-platform API authentication.
- The available local skills and approved hybrid engine-routing policy are indexed in `content/SKILLS.md`. The dated lesson production renderer remains Remotion; standalone special-promo compositions may use HyperFrames without changing the lesson pipeline. HeroUI integrations supply component design references.

## Known implementation details

- Voice labels in older episode snapshots can differ in spelling from the provider ID in `voice-profile.json`. `normalizeVoiceProvider` in `scripts/lib.mjs` handles legacy labels; do not modify historical snapshots solely to make their labels match.
- `Audio.trimAfter` uses an absolute source-frame endpoint. `scripts/import-online-tts.mjs` calculates it from the final timed word plus a natural pause; do not reinterpret it as a number of frames removed from the end.
- `prepare-online-tts.mjs` produces continuous narration text: unintended blank lines can introduce pauses absent from word-level cue timing.
- A voice file itself does not authenticate the identity of the voice chosen in the website UI. Preserve this verification limitation.
- Generated media and review data are intentionally ignored by Git; inspect local `review/<episode-id>/status.json` for actual render/publication state, rather than assuming that a source JSON marked planned means rendered/published.
- No trusted platform analytics ingestion is implemented: the labs store owner-provided results. No automatic cover-generation or platform-specific variant-rendering pipeline is established.

## Maintenance

For changes to active rules, edit their owning files and update this file **only when architecture/state changes**. The documentation and configuration consistency checker is `scripts/check-consistency.mjs`; it does not replace tests, video inspection, or human approval.
