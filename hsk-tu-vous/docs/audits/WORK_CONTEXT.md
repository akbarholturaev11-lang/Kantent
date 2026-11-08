# WORK_CONTEXT.md — Kantent engineering continuation

**Updated:** 2026-11-08 (UTC), after cross-platform/semantic/batched decoding and SFX failure-status review. **Maintainer:** ChatGPT acting on owner's request to continue after Codex limit. **Working branch:** `agent/continue-p0-p1-20261108`. **Parent commit:** `2794d8002f736c6f6b8d475f648234c235ca9726` (`codex/p0-p1-media-reliability-20261106`, PR #58). **Current main observed:** `7b0f8f8da81839a40945a4bbbbbfaccefd8258f6`. Refresh all refs on resume, and never assume main has merged this branch.

This is the **one persistent task/handoff context file**. Update this file as part of each meaningful agent work session. It records progress and evidence, *not* a second source of production policy. Canonical sources: [root AGENTS](../../../AGENTS.md), [project AGENTS](../../AGENTS.md), [AI_RULES](../../AI_RULES.md), [WORKFLOW](../../content/WORKFLOW.md), [CURRENT_TASKS](CURRENT_TASKS.md), [full V1–V7 audit](KANTENT_FULL_TECHNICAL_AUDIT_V5_2026-11-05.md).

## User objective

Continue fixing the most important, independently verified code bugs first: voice/audio preservation and first-take quality; one locale-bound spoken-cue timeline, visually truthful and synced graphics, real phone-size frame QA; unapproved RU/TG lesson/CTA bindings, PWA capture only from genuine current product; independent agent root-cause recovery without blind retries. Do **not** ask for permission at each technical failure when an authorized bounded fix is possible. Never invent a claim of successful render or provider voice audition.

Owner decisions P01–P12 in the complete audit are approved. Do **not** alter published/approved videos or voice, generate paid API speech without authorization, fake screenshots or cue times, auto-publish video, or merge unverified code to main. Video publication needs exact final owner preview approval. Static photo-news has independent authorization, outside this work.

## Owner scope correction — 2026-11-08: BUG FIXES ONLY

The owner explicitly clarified: **fix the existing bugs, do not add extra product functions**. This supersedes any previous backlog wording that treated nice-to-have capabilities as necessary for completion of this bugfix branch.

**In scope (P0/P1):** reproduce and repair concrete existing failures; TTS audio checkpoint/resume and STT reuse; exact RU/TG voice/caption/frame synchronization; misleading/early/missing visual states; SVG, pinyin and caption-boundary bugs; CTA/source/video hash mismatches; rendering error/status consistency and existing approval/publishing safeguards. Add only the smallest narrowly targeted regression tests needed to prove each fix. Real RU/TG end-to-end QA is verification, not a new feature.

**Out of scope / explicitly deferred:** new PWA screenshot automation, new TikTok video functionality or platform routing, new autonomous AI agent/orchestrator, broad UI/UX redesign, new workflows, new voice modes, generalized monitoring, and gratuitous helper APIs. Gemini→OpenRouter fallback is already separately owner-requested in PR #56, but **do not merge it into this bugfix branch unless required to repair a reproduced defect and explicitly reviewed for the existing audio checkpoint behavior**. Preserve that PR separately; do not delete or silently enable it.

**PR #59 scope caution:** It already contains internal QA-only frame extraction/contact-sheet tooling created before this clarification. Treat it as testing infrastructure, **not** a required new user-facing feature. Before merging, review each of these files for necessity and remove unnecessary runtime/CLI exposure. No additional feature expansion of that tool is authorized. Do not invalidate previously fixed bugs, alter approved media, or claim synthetic tests are real media QA. Prioritize bug reproduction, minimal code patches and regression proof, then CI and careful integration.

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

## Work on 2026-11-08 — implementation and evidence

1. Inspected latest `main`, all open PRs and Codex PR #58; confirmed 404 tests and successful synthetic CI there, while actual Gemini generation was skipped. No real RU/TJ final voice/MP4 semantics are established by that work.
2. Created this branch **directly from PR #58** to preserve Claude and Codex fixes. Opened [dependent draft PR #59](https://github.com/akbarholturaev11-lang/Kantent/pull/59) targeting `codex/p0-p1-media-reliability-20261106`, **not main**.
3. Added `scripts/cue-frame-review.mjs` and `npm run content:review-frames -- <episode-id> [ru|tg]`. When an existing genuine local review package is available, it verifies matching `episode.json` vs canonical compiled cue timeline, status `contentHash`, exact MP4 SHA-256, real 1080x1920 / 30fps / encoded frame count, and then extracts before/on/settled MP4 frames in both 1080×1920 and phone-size 270×480. Emits a local `index.html` contact sheet and `manifest.json` with `FRAME_SAMPLES_GENERATED_NOT_VISUALLY_APPROVED`. It **does not** generate speech, edit source media, publish, or claim semantic approval. Existing contact-sheet paths are not overwritten. Extracted exact frame index uses ffmpeg filter `select=eq(n,N)`, not approximate timestamp seeks.
4. New unit tests: `scripts/cue-frame-review.test.mjs` for frame boundaries, late/early cues, source/audio/locale mismatch, missing cues, graphic settle caps, promo cue and safe cap. First CI run [42445279484](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42445279484) **failed** because a later cue was validated only after computing the preceding deadline. Fixed by prevalidating all beat timestamps and exact audio-derived local/global frames. Next run [42445378989](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42445378989) **failed** because the old test fixtures expected different exceptions and had no promo `startFrame`; regression tests corrected. Following [42445397739](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42445397739) **SUCCEEDED** (full Canonical source consistency, including pure frame-plan tests). All failures and their root causes are preserved in GitHub Actions.
5. Added `scripts/cue-frame-review.integration.test.mjs`: generates a **synthetic, no-Gemini 1080×1920 30fps video** via ffmpeg and confirms the real decoder extracts exact full/phone PNG dimensions, keeps owner approval false, refuses an existing proof directory, and rejects mismatched MP4 SHA-256. CI runs it only **after FFmpeg installation**. **VERIFIED PASS**: [workflow 42445519317](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42445519317) completed with BOTH `consistency` and `semantic-foundation` jobs successful. Exact log shows `node --test scripts/cue-frame-review.integration.test.mjs`: 1 passed, 0 failed, using real FFmpeg-decoded synthetic MP4 frames; existing synthetic MP4 smoke and other checks also passed. No real Gemini or actual approved media was generated.
6. Linked this one work context from the project `AGENTS.md`, making it findable by a new agent. Do not create competing context files.

**Status:** software source and synthetic unit checks only, NOT production QA; separate external real RU/TG media review requires authorized existing MP4/WAV and human inspection. No approved audio/video was mutated, no credential used, no paid request, no Zernio post, no main merge.

## 2026-11-08 continuation — second verified engineering slice

**Current work chain:** Claude 6-file fixes → Codex PR #58 → dependent ChatGPT [draft PR #59](https://github.com/akbarholturaev11-lang/Kantent/pull/59). The branch remains based on Codex, NOT rebased onto main and not merged.

### New defects confirmed and changes implemented

1. **Real encoded length mismatch:** initial contact-sheet code used only `sum(scene.durationFrames)`. Production uses `sharedRenderRanges()`, which extends the final CTA when audio runs longer. Fixed frame evidence to use actual production totalFrames. Added source startMs↔accumulated frame-offset drift guard, CTA before/first/last frame proof and unit tests.
2. **Wrong platform attribution:** early review checked only Instagram hash even though YouTube/Facebook have separate CTA video bytes and variant episodes. Now supports `instagram|youtube|facebook` and validates each exact `videoSha256`, `baseContentHash`, `contentHash`, shared lesson/timeline and real H264+AAC video/audio. TikTok explicitly fails closed due different narrated CTA. Approved completed packages remain **read-only**; no approval is granted.
3. **Silent media masquerading as review:** reused production `verifyPlatformVideo`, rejecting a silent video-only MP4 even if its hash appears in status. Synthetic ffmpeg integration now generates 30fps 1080x1920 H264+AAC and tests a silent MP4 is rejected.
4. **Voice-linked semantic scenes omitted:** extended frame-proof planner to compiled `semanticTimeline` *only after recompiling and comparing exact current source and word cues*. Semantic word action has before/on/settled samples; static `semanticShot` without a spoken action receives first/middle/last frames explicitly labeled **NOT voice-cue evidence**. New regression tests.
5. **SFX failure left render permanently `rendering`:** `render-episode.mjs` invoked SFX outside its error-status catch. Added `render-sfx-step.mjs` so subprocess/spawn errors write `render-failed` before rethrow; tests cover success, error code, missing status, and missing tool. No blind retry.
6. **Very expensive frame extraction:** prior script launched roughly six FFmpeg processes per cue, each decoding a whole video prefix. Added `cue-frame-batch.mjs`, decoding all exact requested unique frame indices in **two sequential FFmpeg passes**, one 1080×1920 and one 270×480, then copying mapped PNGs to semantic/CTA labels. Rejects duplicate labels/traversal and missing frames. The integration test cross-checks batch pixels against independent single-frame FFmpeg decoding.

### Evidence and quality gates

- [GitHub Actions 42446953282](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42446953282): **success** at `d6a7f054bf3` (semantic foundation + consistency, including new SFX and batch safety tests and real synthetic MP4 extraction).
- [GitHub Actions 42446984738](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42446984738): video-review workflow **success** at `44d65cf20c` (synthetic video; Gemini voice generation step may be skipped). [42446984586](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42446984586) later **completed success**, with the independent encoded-frame pixel comparison, SFX tests, lint, consistency, FFmpeg synthetic integration and Remotion semantic checks all passed. This is still NOT a real RU/TG media QA.
- Latest README documentation commit `85c08aeaf6386872d98e106cadbd31e39fa14112`; associated CI queued at last check. Do NOT conflate documentation-only CI pending with previous passing code commit.
- No real Gemini/OpenRouter TTS generated, no RU/TG listening test, no actual semantic/phone readability verdict, no owner-preview approval, no PWA capture and no video publication.
- The separately failing `main` feedback analyzer 0-vs-2 cohort test is OUT OF SCOPE for this branch and must not be hidden by these P0/P1 CI results.

## Next tasks / blockers

- Recheck latest PR #59 CI after documentation-only commits (code+integration passed on workflow 42445519317). Do not treat the green *synthetic* MP4 test as real RU/TG voice/visual approval.
- When a real, **unapproved** existing review package is available locally: `cd hsk-tu-vous && npm run content:review-frames -- <episode-id> ru`, then repeat for `tg`. Compare the before/on/settled frame at phone size with spoken words, Mandarin accuracy, Chinese characters and pinyin, focal-object appearance, and real audio. The proof directory is under `review/<id>/cue-frame-review-<timestamp>` (TG: `review/<id>/tg/...`). The user/owner must still approve the exact final VIDEO package; this is not an autopublish pass.
- Integrate owner-approved direct Gemini→OpenRouter fallback only after properly reconciling [separate draft PR #56](https://github.com/akbarholturaev11-lang/Kantent/pull/56) with the newer voice-checkpoint changes in PR #58; avoid free-quota key cycling.
- Genuine current PWA screenshots require authorized browser capture and real source/locale/crop hash. Do not fake captures.
- Root-cause-based agent repair orchestration, cross-platform review identity, and remaining P1 semantic QA are open.
- IMPORTANT: recent `main` has unrelated Telegram news changes and currently failing consistency CI (observed runs 42351734221 etc). Do not rebase/merge from `main` until those changes and their CI failures are understood.

## Operating rules

- Work on `agent/continue-p0-p1-20261108`; do not push these changes to main, Codex PR #58 branch, Claude branch, or draft fallback PR #56.
- On each session update: base/head SHAs, verified changes, tests with exact run IDs/status, unresolved blockers and next **single** task. Do not label a test `passed` without observable CI evidence.
- Use no real API key, no `OPENROUTER_API_KEY` or `GEMINI_API_KEY` in commits, logs or test fixtures. Do not run a paid voice or social publish operation.
- When a bug cannot be reproduced without original audio/visual artifacts, distinguish **code fix / synthetic CI / real-media QA needed**.
