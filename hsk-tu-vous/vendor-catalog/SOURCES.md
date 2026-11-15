# Kantent external UI & motion sources — verified import status

Updated: 2026-11-15. Implementation tracked in PR #70; catalog remains experimental even when merged.

All third-party source trees remain **isolated** from the Remotion production dependency graph. Original local adapters and a Codex TEST selection workflow exist, but neither a catalog import nor passing synthetic CI proves real-voice video QA or authorizes publication.

| Source | Current import | Path | Licensing |
| --- | --- | --- | --- |
| BoardUI | **Full public free component source imported** (upstream documents 69 free entries; source tree includes base/application components, hooks, CSS tokens, utils). No Pro code. | `boardui-free/` | MIT, includes original LICENSE, upstream commit pinned to `ec5c5eb3e29c2441be63b9422cd54f411ef23466` |
| Transitions.dev | **All three publicly available free agent skills installed** (main skill currently has 36 transition references). Not yet Remotion-compatible adapters. | `../.agents/skills/transitions-dev/`, `transitions-polish/`, `transitions-ui-generation/` | Site-specific free-commercial-use terms allow using skills in projects, restrict competing libraries; source commit `20d70c1262bf721c0300c2946cbe1fc7605a555c`. See `TRANSITIONS_SKILLS_IMPORT.md`. |
| Beautiful UI — `www.beautifului.dev` | **Public website HTML and MIT license page snapshot**, contains the showcase for 21 visual components. **Not a distributable React component package**. | `beautifului-reference/` | MIT webpage license: Shane Levine (2026); preserve attribution. Do not confuse with `beautiful-ui.dev` Notchset. |
| Bencho — `bencho.dev` | **Public component index and license/access notes only; source code NOT imported**. Full code and MCP are Pro-only according to the vendor; no authenticated purchase was provided. | `bencho-reference/` | Site-specific license / Pro access. No unauthorized copying or Pro circumvention. |

Sources: https://github.com/BoardUI/boardui ; https://github.com/Jakubantalik/transitions.dev ; https://www.beautifului.dev/ ; https://bencho.dev/

## Video usage model

1. Browse the full source/reference catalog **without importing it into the active Remotion bundle**.
2. For each video, inspect actual script and exact word cues, current branded cast, content type and screen safe zones.
3. Choose a genuinely different but appropriate **small combination** of effects/visuals and adapt only those to deterministic Remotion frame-driven React.
4. Register per-video selection in source-controlled metadata; validate meaningful motion, speech sync, RU/TJ localization, 1080×1920 and 270×480 legibility. Preserve approved/published assets.
5. Show owner exact preview for video approval before any publishing.

**Experimental engineering state:** Free catalog acquisition is complete as above. Seven original deterministic, frame-driven Remotion adapters have been written in `../src/video-components/MotionKit.tsx` (five UI effects, two artwork-only effects); an isolated silent pilot is in `../src/video-components/MotionKitPilot.tsx`. The deterministic, read-only selector is `../scripts/video-component-selector.mjs`. The calendar-aware planning command is `../scripts/preview-video-component-plan.mjs <date-or-id>` and reads registered lesson or promo source data without inventing cue timing. GitHub Actions runs `motion-kit-pilot-ci.yml` for TS/ESLint, scenario tests, main consistency and technical demo still/MP4 rendering. Artwork-only adapters are wired to an **explicit opt-in** `HSK_AI_MOTION_KIT_REVIEW=1` path that validates real imported Gemini word cues plus a distinct Codex TEST decision for each RU/TJ narration source. Ordinary/default rendering is unchanged. Promotional UI concepts are still reference-only. No real imported-voice A/B or exact owner approval has occurred. Continue with `../plans/FULL_UI_MOTION_LIBRARY_ADOPTION_2026-11-15.md` for voice-bound QA and rollout.

## Safety notes

- Do not commit any Pro license key, paid code without documented rights, external scripts with unknown origin or a backend runtime from an upstream UI showcase.
- This is a *public* GitHub repository. Vendor terms still apply.
- Never execute foreign example applications on production workers.
- Any later edits to `AI_RULES.md`, `content/visual-system.json` or other canonical policies require the project's documented rule-migration process.
