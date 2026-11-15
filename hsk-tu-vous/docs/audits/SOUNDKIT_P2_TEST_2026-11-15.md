# SoundKit P2 — Codex TEST-only sound selection implementation and audit

**Status: P2 code and regression testing completed on isolated feature branch.** Not merged to `main`. No production audio or rendering behavior changed.

- Branch: `feat/sound-design-phase0-kenney-audit-20261115`; PR #72 remains DRAFT.
- Plan: `plans/SOUND_DESIGN_LIBRARY_2026-11-15.md` in planning branch / PR #71.
- Baseline + P1: `docs/audits/SOUND_DESIGN_BASELINE_2026-11-15.md` and `assets/sound-library/README.md`.
- Verified audited library: 151 pinned CC0 WAVs with independent SHA-256, 51/50 publisher-vs-mirror difference documented; 151 items have `eligibleForAutomaticUse:false` and are **NOT** loaded by the actual renderer.

## P2 delivered

1. **Canonical machine-readable policy:** `content/sound-design.json` owns TEST-only selection rules and the small role-specific audition allowlist. Existing sound gain/fade numeric tokens remain exclusively in `content/visual-system.json#sound`. `content/sound-library.json` remains the source-audited asset inventory, not a second mixing policy.
2. **Pure deterministic proposal/validator:** `scripts/codex-soundkit-selection.mjs`. It returns a shortlist of authorized, hash-bound sound references for a real authored visual event and always includes `SILENCE`. No automated choice, no LLM, no API. Authentic static product screenshots may get a gentle *entrance/reveal* proposal, not an invented click. A real UI tap/success tone is **hard-disabled throughout P2**, even when editable source metadata falsely claims a recording was verified. A future P3+ independent media hash/provenance validator is required before either role can be considered. Current real promo screenshots are static and never establish UI interaction. Hook/first scene and CTA cannot receive an SFX proposal.
3. **Localized Codex brief:** `scripts/codex-soundkit-test.mjs`. At the start of eligible production, it reads the registered calendar/source, verifies language and current TG localization binding against the original RU source, hashes the exact source bytes plus pinned catalog and policy, and writes `review/sound-design-tests/<id>/<ru|tg>/brief.json`. The returned `soundKitTest` is explicit `TEST_ONLY`, `productionEffectsEnabled:false`, `aiApiConnected:false`.
4. **Agent-owned creative decision:** Codex itself reads each brief and writes a real `codex-decision.json`, per scene, including `SILENCE` where the actual visuals do not warrant an audible accent. The validator rejects source/catalog/policy drift, copied RU/TG decisions, unsupported asset IDs, altered asset hashes, license mismatch, fake on-screen event evidence, unsupported press/success roles, missing narration evidence, scene/CTA manipulation, undocumented silence and non-Codex attribution. Validation does not infer a missing creative decision or silently choose based on a hash.
5. **Automatic preflight integration:** `scripts/make-episode.mjs` and the shared `scripts/mcp-server.mjs` `prepare_today_video` / `prepare_video_for_date` path now produce SoundKit briefs for each production language alongside existing MotionKit briefs. P2 is advisory: when a source is not ready it reports `source-not-ready` but does **not** silently replace it, purchase TTS, enable SFX, or break approved production. Published episodes are not retroactively modified.
6. **Codex instructions / canonical migration:** `AGENTS.md` ownership table, `content/WORKFLOW.md`, `content/EDITING_SPEC.md` and `content/SKILLS.md` point to the one SoundKit policy and clarify the separate unchanged audio-render and exact-preview approval gates. `package.json` includes the `content:soundkit:test` CLI.
7. **Isolated read-only CI:** `.github/workflows/soundkit-p2-ci.yml` runs the source-aware adversarial tests, checks JS syntax without extra dependencies, and prepares four real localized briefs from an upcoming lesson and advertisement. `.github/workflows/soundkit-kenney-mirror-import.yml` remains read-only asset integrity CI.

## Evidence / test coverage

- [P2 CI #43691185712 — SUCCESS](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/43691185712). Test sources include the 2026-11-15 series, 2026-11-17 ad, 2026-11-18 lesson, and 2026-11-19 ad, across RU and TG. CI also actually writes real test briefs for the 17th and 18th in RU/TG. No paid Gemini voice generation is required.
- [P1 asset import #43689444267 — SUCCESS](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/43689444267); 151 playable SHA-pinned WAV files with verified CC0 licenses.
- [Read-only asset integrity #43689807132 — SUCCESS](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/43689807132) after retiring all acquisition write workflows.
- Per-scene sound choices are **candidate references**, not measured sound design. Their name/role classification does not establish professional timbre, volume or intelligibility. Actual audio listening is required before activation.
- String `chosenBy:"Codex"` plus evidence is a schema guard; it cannot cryptographically prove authorship or human artistic taste. The existing Codex production agent must perform the requested decision in its own session; the new code does not launch an autonomous new model.
- P2 has **no real voice source audio SHA binding, no frame-accurate timing or actual audio render, no real-video A/B and no owner approval**. Those remain P3–P6. Do not use P2 alone to publish videos with new effects.

## Subsequent gates (NOT implemented in this PR)

- **P3:** exact verified imported audio/Gemini word cues and source audio SHA-256; per-platform CTA/locale refcheck; no synthetic timestamps.
- **P4:** opt-in Remotion sound track, preserving old soft-cut/tap behavior with no double-trigger and default mix unchanged; no remote API or extra TTS.
- **P5:** automated clipping, peak/LUFS, files and audio regressions; human headphone and phone loudspeaker review.
- **P6:** real RU/TG A/B on genuine imported approved speech, exact file fingerprints and owner sign-off prior to default rollout or publication.
