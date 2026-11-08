# WORK_CONTEXT.md — Kantent engineering continuation

**Updated:** 2026-11-08 (UTC). **Maintainer:** ChatGPT acting on owner's request to continue after Codex limit. **Working branch:** `agent/continue-p0-p1-20261108`. **Parent commit:** `2794d8002f736c6f6b8d475f648234c235ca9726` (`codex/p0-p1-media-reliability-20261106`, PR #58). **Current main observed:** `7b0f8f8da81839a40945a4bbbbbfaccefd8258f6`. Refresh all refs on resume, and never assume main has merged this branch.

This is the **one persistent task/handoff context file**. Update this file as part of each meaningful agent work session. It records progress and evidence, *not* a second source of production policy. Canonical sources: [root AGENTS](../../../AGENTS.md), [project AGENTS](../../AGENTS.md), [AI_RULES](../../AI_RULES.md), [WORKFLOW](../../content/WORKFLOW.md), [CURRENT_TASKS](CURRENT_TASKS.md), [full V1–V7 audit](KANTENT_FULL_TECHNICAL_AUDIT_V5_2026-11-05.md).

## User objective

Continue fixing the most important, independently verified code bugs first: voice/audio preservation and first-take quality; one locale-bound spoken-cue timeline, visually truthful and synced graphics, real phone-size frame QA; unapproved RU/TG lesson/CTA bindings, PWA capture only from genuine current product; independent agent root-cause recovery without blind retries. Do **not** ask for permission at each technical failure when an authorized bounded fix is possible. Never invent a claim of successful render or provider voice audition.

Owner decisions P01–P12 in the complete audit are approved. Do **not** alter published/approved videos or voice, generate paid API speech without authorization, fake screenshots or cue times, auto-publish video, or merge unverified code to main. Video publication needs exact final owner preview approval. Static photo-news has independent authorization, outside this work.

## Existing work preserved

- [Claude branch](https://github.com/akbarholturaev11-lang/Kantent/tree/claude/local-fixes-20261106) at `6c1fe0eb33f70851907cd77edc5cacc9fa186426` changed 6 lesson/CTA JSON files. Codex branch is **3 commits ahead of it**, not a competing reset.
- [Codex PR #58](https://github.com/akbarholturaev11-lang/Kantent/pull/58) at `2794d8002f736c6f6b8d475f648234c235ca9726` includes hash-verified WAV checkpoints/reuse, bounded STT retry, ffprobe duration, cue-scene/source binding, early visual reveal controls, SVG geometry checks, pinyin/caption page validation and tests, and fixes to the unapproved `haishi-vs-huozhe-tea` visual choice. Reports 404 Node tests passing, lint/TypeScript and consistency, and synthetic MP4 review.
- GitHub PR #58 commit check-runs were all successful except **actual Gemini voices generation was SKIPPED** (not a failure). No production RU/TJ voice listening or real-audio/real-video semantic QA is proven. The Codex PR is unmerged.
- [Draft PR #56](https://github.com/akbarholturaev11-lang/Kantent/pull/56) is **separate**, with optional `gemini-direct -> openrouter` fallback. Do not merge it blindly into PR #58: both edit `generate-voice-gemini.mjs`; reconcile with checkpoint/resume logic and the current owner/provider requirements first. Multiple distinct Google projects do not authorize circumvention of documented per-project rate limits.
- Current `main` has 6 newer commits unrelated to this work (one recent `@hskaiapp` Telegram channel fix); rebase/merge only with explicit CI and conflict review. Preserve the news-agent source/publishing rules.

## Verified status and evidence

| Area | Code-level verification | Outstanding real-world proof |
|---|---|---|
| P0 voice checkpoint and reuse | PR #58 unit/integration and GitHub CI green (synthetic) | Real RU/TG first-take Mandarin pronunciation; authenticated production media input and saved-WAV recovery |
| P0 locale-bound cue timeline | PR #58 compiles shared timing and sends it to renderer | Real audio->word->before/at/after visual frame comparison |
| P1 first visual/choice/graphic geometry | PR #58 source and 229 graphic payload checks green | 1080x1920 and 270x480 contact sheets, interpret each teaching state visually |
| P1 captions/pinyin/CTA boundary | PR #58 checks split cues, grouped caption pages, hash validity | Real imported caption pages, spoken timing and Pinyin visibility in final MP4 |
| P1 source-edit/CTA registrations | PR #58 additional tests/edits; do not blindly rewrite immutable ledger | Confirm each target final working snapshot, review packages |
| P1 autonomous repair loop | Not verified as a real agent workflow | Root cause branch, regression tests, bounded retries, truthfully report blockers |
| P1 current PWA promo screenshots | Not yet connected as authorized browser-capture pipeline | Genuine signed-in current UI capture, locale, crop, source/asset hash, phone preview |
| P1 exact-preview gate | Existing guard code; no autonomous video posting permitted | Real final owner approval for each approved target |

## Work on 2026-11-08

1. Inspected `main`, open PRs, Codex PR #58; confirmed that Codex actually advanced the large P0/P1 patch set and must **not** be reimplemented from scratch.
2. Started this **separate branch from PR #58** to preserve its review state and keep further changes inspectable.
3. Next concrete task: implement read-only **cue-specific before/on/settled phone-frame proof** against *existing* real review MP4 and compiled `cue-timeline.json`, with no TTS/API calls and no posting. Before adding code, check current renderer/ffmpeg paths and regression tests; avoid duplicating a working command. Guard against source/audio/video identity mismatch.
4. After code, run CI via PR and record result here, not merely `npm run lint` claims.
5. Remaining follow-ups: first-take A/B RU/TG audio QA (requires authorized real sample), PWA browser capture, agent root-cause recovery orchestration, publication gate reconciliation and PR #56 voice-fallback integration.

## Operating rules

- Work on `agent/continue-p0-p1-20261108`; do not push these changes to main, Codex PR #58 branch, Claude branch, or draft fallback PR #56.
- On each session update: base/head SHAs, verified changes, tests with exact run IDs/status, unresolved blockers and next **single** task. Do not label a test `passed` without observable CI evidence.
- Use no real API key, no `OPENROUTER_API_KEY` or `GEMINI_API_KEY` in commits, logs or test fixtures. Do not run a paid voice or social publish operation.
- When a bug cannot be reproduced without original audio/visual artifacts, distinguish **code fix / synthetic CI / real-media QA needed**.
