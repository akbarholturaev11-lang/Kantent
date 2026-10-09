# Project memory — current architecture

This file is **not another policy document**. Keep only architecture, current technical state and hard-to-discover implementation constraints. For active behavior, read `AI_RULES.md` and the canonical sources in `AGENTS.md`. Delete superseded architecture notes when the implementation changes.

## Components

- Local Node.js MCP server: `scripts/mcp-server.mjs`; clients are configured in `.codex/config.toml` and `.mcp.json`.
- Planning lives in `content/calendar.json` and `content/episodes/`. These are JSON files, not a database. The review copy is stored under `review/<episode-id>/`.
- Audio preparation/import: `scripts/prepare-online-tts.mjs` and `scripts/import-online-tts.mjs`. The **only authoritative voice settings and approval state** are in `content/voice-profile.json`.
- Rendering: `src/EpisodeComposition.tsx` and `scripts/render-episode.mjs` using Remotion. `scripts/caption-utils.mjs` shares timing/phrase grouping between baked-in subtitles and exported SRT.
- Visual numeric tokens come from `content/visual-system.json`; shot-level editing rules from `content/EDITING_SPEC.md`.
- Hook/CTA experiments, corrections and owner-entered analytics reside in their respective `content/*-lab.json` files; explanatory methodology is in the corresponding `*_LAB.md` files. `content/cta-lab.json#platformVariants` now provides Instagram/TikTok/YouTube readiness; `scripts/platform-cta.mjs` builds safe platform-specific drafts. New planned source episodes contain *only* the lesson scenes; `scripts/episode-cta-assembly.mjs` pulls Instagram's canonical narration and CTA scene template from the Lab when the loader materializes an episode for the review copy. It reuses immutable CTA registration metadata only on an exact validation match and requires a new registration otherwise. These drafts are not three rendered MP4s: TikTok and YouTube still need owner-approved CTA copy/screenshots and isolated TTS/render plumbing. Preserve historical snapshots rather than rewriting past experiment results.
- The publication integration uses the existing connected social MCP. `mcp-server.mjs` records the approved preview and returned post IDs/status under each episode's review package. It does not store platform credentials or provide direct social-platform API authentication.
- Installed skills, functional categories and the lesson/premium/special stage-owner recipes live in `content/skill-catalog.json`. `content/SKILLS.md` explains the policy, and `scripts/skill-router.mjs` powers the MCP `recommend_skills` tool. Remotion remains the dated lesson renderer; a separate standalone premium/special project can use HyperFrames. HeroUI is a design reference only.

## Known implementation details

- Voice labels in older episode snapshots can differ in spelling from the provider ID in `voice-profile.json`. `normalizeVoiceProvider` in `scripts/lib.mjs` handles legacy labels; do not modify historical snapshots solely to make their labels match.
- `Audio.trimAfter` uses an absolute source-frame endpoint. `scripts/import-online-tts.mjs` calculates it from the final timed word plus a natural pause; do not reinterpret it as a number of frames removed from the end.
- `prepare-online-tts.mjs` produces continuous narration text: unintended blank lines can introduce pauses absent from word-level cue timing.
- A voice file itself does not authenticate the identity of the voice chosen in the website UI. Preserve this verification limitation.
- Generated media and review data are intentionally ignored by Git; inspect local `review/<episode-id>/status.json` for actual render/publication state, rather than assuming that a source JSON marked planned means rendered/published.
- `scripts/scenario-buffer-plan.mjs` is a read-only calendar gap/date adviser. The AI agent, not this deterministic module, authors complete source-verified new future episode JSON and updates the calendar in a review PR as approved in `AI_RULES.md`.
- Production scripts and the local MCP `prepareReviewForDate` entrypoint call `requireFreshGitMain` in `scripts/git-freshness.mjs`. It fetches GitHub `origin/main` using Git, checks it is an ancestor of local HEAD, fails closed when offline/stale, and records the source revision in working status. It never auto-pulls or auto-merges.
- `scripts/self-improvement-check.mjs` audits the upcoming canonical scenario reserve read-only against `content/calendar.json#planningBuffer`.
- `scripts/feedback-analyzer.mjs` validates Git-versioned Zernio snapshots in `content/feedback/observations/` and computes source-based descriptive watch, skip, saves and shares. The first dataset contains real Instagram readbacks; post-to-episode mappings remain unknown. Neither a cloud scheduler nor an AI-driven rewrite engine is enabled.
- No trusted platform analytics ingestion is implemented: the labs store owner-provided results. No automatic cover-generation or platform-specific variant-rendering pipeline is established.

## Known planning boundary

- The two earliest planned calendar/episode entries still preserve an obsolete comment/DM CTA in their historical production plans. Do not render/publish those drafts as current: `requireCurrentCta` rejects them until the owner explicitly requests a new CTA version with approved footage, voice, word-level cues and new registration. The old experiment ledger and published snapshots must not be silently rewritten. The renderer no longer supplies a comment/DM fallback when `visualBeats` is absent.

## Maintenance

For changes to active rules, edit their owning files and update this file **only when architecture/state changes**. The documentation and configuration consistency checker is `scripts/check-consistency.mjs`; it does not replace tests, video inspection, or human approval.
