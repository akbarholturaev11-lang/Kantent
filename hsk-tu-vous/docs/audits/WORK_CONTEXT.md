# WORK_CONTEXT.md — Kantent engineering continuation

**Updated:** 2026-11-08 (UTC), after merging the owner-requested OpenRouter backup (PR #56) and the paid-API first-take fixes. **Working branch:** `agent/continue-p0-p1-20261108` (dependent PR #59, unmerged).

This is the **one persistent task/handoff context file**. Update this file as part of each meaningful agent work session. It records progress and evidence, *not* a second source of production policy. Canonical sources: [root AGENTS](../../../AGENTS.md), [project AGENTS](../../AGENTS.md), [AI_RULES](../../AI_RULES.md), [WORKFLOW](../../content/WORKFLOW.md), [CURRENT_TASKS](CURRENT_TASKS.md), [full V1–V7 audit](KANTENT_FULL_TECHNICAL_AUDIT_V5_2026-11-05.md).

## User objective

Continue fixing the most important, independently verified code bugs first: voice/audio preservation and first-take quality; one locale-bound spoken-cue timeline, visually truthful and synced graphics, real phone-size frame QA; unapproved RU/TG lesson/CTA bindings, PWA capture only from genuine current product; independent agent root-cause recovery without blind retries. Do **not** ask for permission at each technical failure when an authorized bounded fix is possible. Never invent a claim of successful render or provider voice audition.

Owner decisions P01–P12 in the complete audit are approved. Do **not** alter published/approved videos or voice, generate paid API speech without authorization, fake screenshots or cue times, auto-publish video, or merge unverified code to main. Video publication needs exact final owner preview approval. Static photo-news has independent authorization, outside this work.

## Owner scope correction — 2026-11-08: BUG FIXES ONLY

The owner explicitly clarified: **fix the existing bugs, do not add extra product functions**. This supersedes any previous backlog wording that treated nice-to-have capabilities as necessary for completion of this bugfix branch.

**In scope (P0/P1):** reproduce and repair concrete existing failures; TTS audio checkpoint/resume and STT reuse; exact RU/TG voice/caption/frame synchronization; misleading/early/missing visual states; SVG, pinyin and caption-boundary bugs; CTA/source/video hash mismatches; rendering error/status consistency and existing approval/publishing safeguards. Add only the smallest narrowly targeted regression tests needed to prove each fix. Real RU/TG end-to-end QA is verification, not a new feature.

**Out of scope / explicitly deferred:** new PWA screenshot automation, new TikTok video functionality or platform routing, new autonomous AI agent/orchestrator, broad UI/UX redesign, new workflows, new voice modes, generalized monitoring, and gratuitous helper APIs. Gemini Direct → OpenRouter backup (PR #56) is **now in scope**: on 2026-11-08 the owner explicitly instructed that it be kept exactly as designed and brought into this line (see the section below). It stays opt-in via `HSK_AI_OPENROUTER_FALLBACK_ENABLED=true` and never rotates Google keys on quota.

**PR #59 scope caution:** It already contains internal QA-only frame extraction/contact-sheet tooling created before this clarification. Treat it as testing infrastructure, **not** a required new user-facing feature. Before merging, review each of these files for necessity and remove unnecessary runtime/CLI exposure. No additional feature expansion of that tool is authorized. Do not invalidate previously fixed bugs, alter approved media, or claim synthetic tests are real media QA. Prioritize bug reproduction, minimal code patches and regression proof, then CI and careful integration.

## Existing work preserved

- [Claude branch](https://github.com/akbarholturaev11-lang/Kantent/tree/claude/local-fixes-20261106) at `6c1fe0eb33f70851907cd77edc5cacc9fa186426` changed 6 lesson/CTA JSON files. Codex branch is **3 commits ahead of it**, not a competing reset.
- [Codex PR #58](https://github.com/akbarholturaev11-lang/Kantent/pull/58) at `2794d8002f736c6f6b8d475f648234c235ca9726` includes hash-verified WAV checkpoints/reuse, bounded STT retry, ffprobe duration, cue-scene/source binding, early visual reveal controls, SVG geometry checks, pinyin/caption page validation and tests, and fixes to the unapproved `haishi-vs-huozhe-tea` visual choice. Reports 404 Node tests passing, lint/TypeScript and consistency, and synthetic MP4 review.
- GitHub PR #58 commit check-runs were all successful except **actual Gemini voices generation was SKIPPED** (not a failure). No production RU/TJ voice listening or real-audio/real-video semantic QA is proven. The Codex PR is unmerged.
- [Draft PR #56](https://github.com/akbarholturaev11-lang/Kantent/pull/56) (opt-in `gemini-direct -> openrouter` backup) was **merged into this branch on 2026-11-08 on explicit owner instruction**, reconciled with the SHA-bound checkpoint/resume logic below. Multiple distinct Google projects still do not authorize circumvention of documented per-project rate limits.
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

## 2026-11-08 — verified bugfix-only continuation: saved audio SHA integrity

**Root cause (code-confirmed):** `hasCurrentImportedVoice` accepted an imported file lacking `audioSha256` because the shared `assertImportedAudioHash` treats legacy hashless media as allowed. `findReusableVoiceCheckpoint` accepted a structurally valid WAV with no persisted per-chunk SHA. An explicit `--resume` likewise accepted hashless WAVs (`!recordedChunk?.sha256`) and accepted saved MP3s by decodable duration alone. Corrupt WAVs were deleted and regenerated, risking unnecessary new paid TTS and loss of original evidence.

**Minimal bug fixes, NO product feature added:**

- `voice-import-state.mjs`: automatic reuse requires a valid SHA-256 digest, not just a decodable file and matching narration/profile.
- `voice-checkpoint.mjs`: automatic checkpoint detection and the shared local saved-WAV validator require exact file name, full RIFF/WAV validation and matching recorded SHA. Internal `matchesRecordedAudioHash` also verifies exact encoded MP3 bytes.
- `generate-voice-gemini.mjs`: explicit resume refuses existing WAV chunks that have missing/mismatched recorded SHA (preserves original, makes **zero** TTS calls on that branch). Resumed master WAV and existing MP3 are checked against stored hashes. Existing MP3 is **not deleted/reencoded on mismatch**; it remains for inspection.
- `voice-import-state.test.mjs` and `voice-checkpoint.test.mjs`: regression tests for absent/invalid hash, wrong filename, mutated WAV/MP3 and preservation of existing WAV contents.
- `.github/workflows/isolated-one-take-core.yml`: isolated no-Gemini CI now runs these narrow unit regressions when the integrity code changes.

**Verified CI:** [42449569954](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42449569954) isolated one-take TTS core safety **completed SUCCESS** on code+test commit `4c2939afccc230f96d8673d21308cab0b4c05903` including the new saved-audio SHA regression step. Earlier full canonical consistency [42449450063](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42449450063) **completed SUCCESS** on preceding workflow commit; most recent full canonical consistency [42449569985](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42449569985) subsequently completed both `consistency` and `semantic-foundation` jobs **SUCCESS** at the same bugfix code/test SHA `4c2939afccc230f96d8673d21308cab0b4c05903`. No real Gemini speech or owner-approved production media was exercised.

**Risk/compatibility note:** legacy imported files with no SHA are not silently deleted or mutated; automatic *reuse* now returns false until provenance is verified. If a resume finds an MP3 present but no stored SHA (e.g. interrupted metadata write), it fails closed and preserves the file for manual investigation. This favors correct voice identity over silent recovery and may require explicit intervention for old incomplete metadata. No paid API request was made, no video was published, no main merge occurred.

## 2026-11-08 — owner instruction: OpenRouter backup + paid-API first-take bug fixes

**Owner instruction (verbatim intent):** keep the backup Gemini keys, add OpenRouter as an automatic reserve when the free Gemini limits run out, exactly as designed; then fix the audit's most important bugs, starting with getting each paid generation right the first time without extra attempts. Base: `origin/agent/continue-p0-p1-20261108@4f10d30c` (424/424 local tests green before changes).

**Merged:** `origin/feature/gemini-direct-openrouter-backup-20261106` (PR #56, merge commit on this branch). Its generator wiring targeted the old file, so it was re-applied by hand onto the PR #58/#59 generator:

- TTS: Gemini Direct primary; HTTP 429/5xx or the HTTP 400 region refusal "User location is not supported" (real 2026-11-10 Codex run, both languages blocked; no audio produced) switches to OpenRouter **only before any chunk of the take is saved** (one vendor per video). Each saved chunk records its `transport`; `ttsTransport`, `transcriptionTransport` and `fallbackEvents` are persisted in both `metadata.json` and `checkpoint.json`, so an automatic or explicit resume continues on the recorded transport and refuses to resume an OpenRouter-backed take without the opt-in and key.
- STT and Mandarin clip recovery: a Direct 429/5xx retries the **same saved WAV/MP3/clip** via OpenRouter; the exact-token gate is unchanged. Real trigger: the 2026-11-03 zhuozi RU take's clip recovery was blocked by Gemini's 25-requests/day Free Tier (HTTP 429).
- STT erhua/traditional (real 2026-11-11 youdianr RU+TG takes): Gemini Transcribe writes 有点儿/一点儿 as 有点/一点 and TG sometimes as Traditional 這個有點貴, so 9/9 RU and 8/8 TG Mandarin spans were rejected. The gate now drops an erhua 儿 **only** for bigrams proven by author pinyin with a written final -r (yǒudiǎnr; never nǚ'ér/érzi), folds common Traditional forms to Simplified, and splits a mixed word such as `一点儿ро` at the script boundary. Offline replay of the saved clips: RU 6/9, TG 5/8 spans confirmed; the rest are provider omissions/hallucinations (贵→"guay", 一点儿ро→"Lidia, iría a", a zero-width span) and stay fail-closed.
- 2026-11-12 Nov 12 AI Voice ad (RU+TG, Codex limit reset only on Nov 17, so Claude Code finished it): the owner asked for the full AI Voice entry screen at «AI Voice», a smooth swipe into the inner screen and a zoom on the microphone at «mikrofon»; the same real RU screens for both languages. Implemented as `visual.screenMotion` (see `PROMO_WORKFLOW.md`), re-rendered with the saved first-take voice and word timings unchanged (voiceTextHash identical), CTA re-registered (ru-brand-v4, tg-brand-v5). First real render of the brand ending found `HSKAI` without a space: the wordmark now keeps a gap. Codex's uncommitted production fixes were landed with tests: caption pages keep overlapping words on one page, recovery prefers exact 1:1 pairing over merged spans, provider spelling is kept when it already matches the source tokens.
- Google key rotation on 429 stays disabled (`googleQuotaKeyRotationEnabled: false`).

**Bugs fixed (code-confirmed, regression-tested):**

1. **Every lesson render crashed after the MP4s were rendered** — `render-episode.mjs` called `buildCaptionSections()` after `f15725b8` replaced its import (ReferenceError while writing SRT). Found by `scripts/no-undefined-identifiers.test.mjs` (ESLint `no-undef` over all production scripts), now in consistency CI.
2. **Resumed take stranded with zero STT attempts** — the STT budget was cumulative per take (`attempts < 3`). The real zhuozi RU take had 3/3 used on chunk 3, so every resume skipped STT and pushed toward a new paid TTS. Budget is now `STT_ATTEMPTS_PER_RUN = 3` per run; attempt numbering continues for saved files.
3. **V-15** — one OpenRouter TTS HTTP error aborted the run. Now one bounded retry only for 429/500/502/503/504 *error responses* (no audio was produced), honoring Retry-After ≤ 30 s; timeouts/network aborts are never retried because audio may already be billed.
4. **V-14** — the OpenRouter PCM response's declared `rate`/`channels` were ignored and a fixed 24 kHz mono header was written (wrong speed/pitch → STT mismatch → wasted take). The declared format now labels the WAV; non-16-bit or unknown encodings fail closed; FFmpeg still resamples to the approved 24 kHz mono master.
5. Error text written to logs/metadata/CI artifacts redacted only `AIza…` keys; `AQ.…` Google keys, `sk-or-…` OpenRouter keys and bearer tokens are now redacted too (`redactCredentials`).

**Evidence (local, synthetic — NOT real media QA):** 438/438 Node tests, `npm run lint` (ESLint + tsc) and `npm run check:consistency` pass. No paid API call, no real RU/TG generation, no push, no main merge.

**Follow-up the same day (pushed to PR #59):** merged latest `origin/main` (@hskaiapp rename) and finished that rename in `video-credentials.mjs` (its route guard still pinned `@aibotsakbar`, so `video-credentials.test.mjs` failed on clean main), then:

6. **Silent second paid take (X-05/X-08, real):** PR #59 bought a new take whenever automatic resume could not use a saved one — legacy takes without per-chunk SHA-256, another transport/chunk plan, or an imported take the working copy lost. Read-only replay on 2026-11-08: re-running zhuozi today would have bought 5 RU + 5 TG TTS chunks again; xiang-vs-yao already shows 3 paid takes of one narration. `findUnresumableSavedTakes` now stops before any TTS with the folders and reasons; `--new-take` (MCP `forceNewTake`) is the explicit owner override and retires older takes for both resume and the guard.
7. **V-12 audio QA:** each TTS chunk's peak/RMS/longest pause/clipping/near-silence is recorded in `ttsChunks[].audioQa` before STT; only digital silence or ≥98% near-silent audio blocks (WAV preserved, no STT spent). Calibrated on 180 real saved chunks: 10–45% near-silent, 0 false rejections.
8. MCP `generate_voice` description no longer claims audio is "sent to Google" regardless of transport.

**Still open for this objective:** set an OpenRouter credit limit (the configured key reported no per-key limit on 2026-11-08) and run one real RU and one TG episode with fallback enabled, then listen. This branch is 6 commits behind `main`, so `requireFreshGitMain` blocks real production runs from it until it is brought up to date.

## 2026-11-08 — owner instruction: pushed to `main`

On the owner's explicit instruction ("push to main"), `main` was fast-forwarded `7b0f8f8d..4c8cdb0f` (72 commits: Codex PR #58, PR #59, merged PR #56 backup, the voice fixes above and the @hskaiapp follow-up) only after all four GitHub workflows passed on `4c8cdb0f`: Isolated one-take TTS core [42455530451](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42455530451), Canonical source consistency [42455530452](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42455530452), Zernio routing/video package [42455530472](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42455530472), video review automation [42455530404](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/42455530404) — all synthetic, real Gemini generation skipped. Later commits on this branch reach `main` the same way: only after their own CI is green.

- **CI gap fixed:** `video-review.yml` never passed `HSK_AI_OPENROUTER_FALLBACK_ENABLED`, so the backup could not be enabled in GitHub. It now reads the Actions variable (default `false`) and fails before any paid request if the backup is on without `OPENROUTER_API_KEY`.
- **Static sweep:** ESLint correctness rules over `scripts/*.mjs` (beyond `no-undef`) found no further defects.
- **Local main checkout warning:** `/Users/…/HSK AI Kantent` is on `codex/p0-p1-media-reliability-20261106@2794d800` with 18 uncommitted files from 2026-11-06 (e.g. a `HSK_AI_LOCAL_REVIEW_ONLY` freshness bypass, OpenRouter and generator edits, `ji-vs-duoshao` lesson/CTA content). It was deliberately left untouched; whoever owns that work must reconcile it with the new `main` before production runs from that folder.

### Related-path review after the main push (2026-11-08)

Every caller of the voice pipeline was re-checked (only `generate-voice-gemini.mjs` calls TTS/STT; content:make, MCP and GitHub reach it; promos use the same path).

9. **Sample fallback provenance (code-confirmed):** after copying the verified sample over the rejected take, `wavSha256`/`mp3Sha256` and the single-chunk record still described the rejected audio, so checkpoint and imported episode disagreed and an explicit resume refused the folder. Hashes are now recomputed after the copy and the checkpoint is persisted.
10. **X-14 provenance (P2):** `requireFreshGitMain` now discloses uncommitted tracked/untracked project files (`sourceTreeClean`, `dirtyPaths`, content `dirtySourceSha256`, scoped to `hsk-tu-vous/`, ignored files excluded) and `approve-package.mjs` copies it into `approval.json` as `renderSourceRevision` with a warning. Deliberately not a block: local runs legitimately update tracked ledgers (`cta-lab.json`). Verified against real `git` in this worktree.
11. **Missing media tools found only after payment:** the generator can fall back to Remotion's bundled FFmpeg, but import (TikTok composition, duration probe) and every renderer spawn system `ffmpeg`/`ffprobe`. On a machine without them the take was bought and STT spent before import/render failed. `requireSystemMediaTools()` now proves both are on PATH before any take is chosen or bought. Renderer binaries were deliberately not switched to the bundled build (different ffprobe output could change MP4 verification).
- Checked and **not** a defect: a `--new-take` barrier folder without audio is not packaged into the GitHub recovery artifact, but restore only happens within reruns of the same workflow run and CI never passes `--new-take`.

## 2026-11-08 — first REAL local RU+TG voice run (owner-authorized)

Episode `bi-comparison-height-20261104` (unapproved, unpublished), run locally from this worktree on `main`-equivalent code with Gemini Direct primary + OpenRouter backup (`.env.local` symlinked, never copied). Four runs; the safeguards held and every defect found was fixed with a regression test and pushed to `main` after green CI:

| Run | Result | Fix |
|---|---|---|
| 1 | Blocked before any paid request: TG draft had no scene headlines; RU/TG CTAs unregistered | TG headlines added (`d79d985d`); baseline CTAs registered via MCP `register_cta_experiment`, copy identical to the last approved registration except placement (`7ef4dab9`) |
| 2 | RU: 6 TTS chunks saved (one per-minute 429 retried), STT dropped "с 比 или с 很", recovery aborted on a zero-length provider word. TG: `fetch failed` / `UND_ERR_CONNECT_TIMEOUT` killed the take | V8-01 timing policy shared with the main aligner; never-connected requests retried and backup-eligible (`762c7d8d`) |
| 3 | RU resumed with **0 TTS**; recovery refused the interleaved RU+Mandarin gap. TG: 6 chunks saved; correct speech rejected for ASR spellings (У/Ӯ, чи/чӣ, split compounds, 比/很 as "би"/"ҳен") | Position-aligned verified-spelling matcher, mixed-gap recovery with both hints, free re-check of saved STT responses (`50abac88`) |
| 4 | TG chunk 1 now passes; TG chunk 2 STT kept only the Mandarin and the clip returned no words. RU mixed clip heard "с би или с **хан**" for 很 (hěn) — correctly rejected | none: fail-closed as designed |

**Cost so far:** RU 7 and TG 7 TTS HTTP requests (13 audio chunks, all on the free Gemini tier, 0 OpenRouter); RU chunk 1 has used 9 STT attempts. All 12 saved chunks pass signal QA.

**Open (needs the owner, not code):** listen to RU 3.4–5.9 s (`…/2026-11-08T07-09-39-507Z/recovery-diagnostic/chunk-001/span-01.wav`): if 很 sounds like "hěn", the remaining blocker is Gemini STT on mixed speech (X-10/X-19), not TTS; if it sounds like "hàn", a new RU take is justified (`--new-take`). Mixed-language STT still needs a strategy (e.g. per-sentence clips with known script boundaries) before mixed lessons import without manual help.

## 2026-11-08 (later) — one-take default and local RU voice end to end

Owner listened to the RU/TG one-take vs scene A/B and chose **one take per language as the default** (`HSK_AI_TTS_MODE=scene` opts out; stored mode id `continuous-pilot` unchanged so saved takes resume).

| Finding (real run) | Fix |
|---|---|
| Gemini Transcribe free tier: ~3 requests/min, **25/day**; whole-file STT of a 57–60 s take failed (RU timings backwards; TG OpenRouter 10/131 words) | Silence-bounded ≤22 s STT windows (`stt-windows.mjs`); every paid window/pass/clip response cached by exact bounds+hints; passes only for the missing language in windows with a gap |
| OpenRouter: zero-length words, empty entries, Tajik without hint = 6 words with inverted times | Shared ≤250 ms repair; empty entries skipped; one ISO-639-1 hint (`tg`/`ru`/`zh`) per request |
| 冷 had no verified reading (author pinyin per word) | Unique valid pinyin syllable split only |
| "B" for 比, "А/би" for A/B, "тоже" for "то же", bare-clip "HSGKAI" | Letter-name/joined-word matching; one ±0.7 s context retry per unconfirmed span |
| A resumed take stayed on the STT backup forever | Resume asks Direct first again; backup answers kept as evidence |
| 8.1 s RU / 8.4 s TG hook vs 6 s / 8 s limit (old code silently cut speech at 6 s) | Cap never cuts hook speech; content: closing instruction + its beat moved to the answer scene (TTS text byte-identical); CTA v2 registered (supersedes v1) |
| **Guard bug:** a `--new-take` take hid itself → a second RU TTS take was bought (1 Direct request, `2026-11-08T13-48-23-577Z`, kept, not used) | `findUnresumableSavedTakes` lists the barrier take itself |

**State (2026-11-08, superseded below):** RU one-take `review/…/gemini-production/2026-11-08T07-51-00-414Z` (the take the owner listened to) has all 125 tokens verified and is imported (57.0 s). Its render was then blocked by the visual-hold rule, resolved on 2026-11-09 by the illustrated-format beats. TG one-take: Direct daily STT quota spent; OpenRouter evidence cached; resume after the quota reset.

## 2026-11-09 — illustrated-glass lesson format (owner-approved)

After several owner-reviewed test renders of `bi-comparison-height-20261104` (RU), the owner approved the format modelled on their reference reels: generated text-free background art, only the HSK AI cast (panda, dragon, crane, monkey, rabbit from the app's character pack) drawn from exact vectors, no people, camera and overlays on exact cues, three non-repeating text roles, safe-zone text with bottom-first adaptive subtitles. Rules: `content/EDITING_SPEC.md#illustrated-glass-lesson-format`; mandatory from `lessonPresentation.illustratedFormatFromDate`. The owner then asked for variety (no single background/pair/layout), frames as a Codex task, a frame review service and every rule in docs — all merged to `main` (7e0e14c3, 9f25bac6). The RU render resolved the earlier visual-hold block with re-authored beats (CTA re-registered up to v8). Lesson art cost: about $1.05 (OpenRouter, before frames became a Codex task).

## 2026-11-09 — full project audit (owner request: "loyihani tuliq avdit qil … mukammal")

Findings and fixes (branch `agent/continue-p0-p1-20261108`):

| Finding | Fix |
|---|---|
| Calendar has no item after 2026-11-06, so «Бугунги видеони тайёрла» threw "nothing to prepare" | Owner rule recorded: the today command authorizes authoring exactly today's `weeklySchedule` slot; resolver throws `AUTHORING_REQUIRED`, MCP returns stage `authoring-required`, `content:make -- today` exits 2 with the instructions (WORKFLOW §1.3). The empty reserve itself means the external Calendar Reserve task produced nothing after 11-06 — owner to check it |
| New format started 2026-11-10, so a lesson authored for today (11-09) would silently use the old look | `illustratedFormatFromDate` and the variety A/B start moved to 2026-11-07 (after the last existing draft) |
| Frames were checked only at render, after paid voice | `lessonArtPreflight` runs before voice in MCP and CLI: stage `lesson-art-required` + refreshed Codex brief |
| Visual frame confirmations lived only in ignored `review/`, so a GitHub render could never pass | Confirmations persist, hash-bound, in committed `public/lesson-art/<id>/provenance.json` |
| Manifests could ask for characters inside frames, contradicting "no baked-in character" | `validateArtManifest` rejects `characters` on frame assets |
| Reserve readiness did not check illustrated drafts | `inspectDraftReadiness` requires the lesson-art manifest, its variety record and every referenced frame name |
| Contradictions: AI_RULES "Codex first, then paid fallback"; EDITING_SPEC "no headline / one stage" vs the illustrated chip/pair; stale generator header | Reworded at the owning sources; EDITING_SPEC got an explicit precedence rule |
| No single procedure for the daily command; agent duties scattered | Runbook at the top of `content/WORKFLOW.md`; "Agent roles" table in `AGENTS.md`; Feedback playbook reads the variety A/B |
| No npm aliases for the frame tools | `content:variety`, `content:art`, `content:art:review`, `content:characters` |
| **V9-01 (real TG one-take):** one window pass returned 他 with an impossible time (10.30 s → 0.40 s); that single word made `timedBlocks` throw and aborted all gap recovery for the take | The impossible word is dropped as untimed (`GEMINI_UNTIMED_WORD_DROPPED`), so its span is re-recognized from a clip or stays unconfirmed; nothing is guessed — rerun 2026-11-09: recovery now runs and confirms 7 of 9 gap spans; 2 spans (21.6–25.0 s "пеш аз сифат 很 намегузорем ҳамин кофист" and one more) stay unconfirmed because Gemini Direct answered 429 (daily quota) and the OpenRouter backup repeated words. TJ import waits for the Direct quota reset; resume the same take, no new TTS |
| Owner's main checkout is 116 commits behind `main` with 18 uncommitted Codex files (2026-11-06), so production there is blocked as stale | Snapshot preserved untouched as local branch `wip/owner-checkout-20261106` (5ac4e942); switching the checkout is the owner's call |

## 2026-11-09 — today's lesson authored while Codex is rate-limited (owner: "xozircha koda tayorlap qo'y")

- Today's Monday slot is now `ye-dou-placement-20261109` (HSK 1, 也/都 after the subject and before the verb): RU canonical, TG localization bound by `sourceHash`, 23 cue-linked illustrated beats per language, calendar row registered last. `inspectDraftReadiness` ready for RU+TG; `resolveTodayVideo` selects it for 2026-11-09.
- Facts checked 2026-11-09 against three independent grammar references (`learningFactSources`); the lesson teaches only the placement of 也 and 都, not 也都 or other meanings of 都.
- Visual plan from `content:variety`: setting `classroom` (A/B arm B, indoor-daily), monkey as the friend, panda as «я», rabbit as the third classmate, pattern `dialogue`. Manifest `content/lesson-art/ye-dou-placement-20261109.json` asks for 4 text-free frames (classroom, classroom-whiteboard, desk-alone, desks-together).
- Renderer generalized for non-比 lessons without changing the 比 render: `illustration.label` (link/compare chip, default 比), `focusLabel` (focus tag, default A/B) and a stand-alone `stamp` overlay.
- **Not done (Codex, after its limit resets):** the 4 frames + visual confirmation, voice, render, QA, preview. `prepare_today_video` will stop at `lesson-art-required` before paid voice with `review/ye-dou-placement-20261109/lesson-art-codex-brief.md`. Frame anchors and cast positions are authored blind; the first render must be checked for subtitle/face overlap.

## Next tasks / blockers

See `CURRENT_TASKS.md` (owner actions first). Engineering-wise the next real proof is a Codex-made frame set for a new lesson and the TJ one-take import/render.

## Operating rules

- Pushes to `main` only with green CI and on owner instruction (owner instructed merging the approved format and its follow-ups to `main` on 2026-11-09).
- On each session update: base/head SHAs, verified changes, tests with exact run IDs/status, unresolved blockers and next **single** task. Do not label a test `passed` without observable CI evidence.
- Use no real API key, no `OPENROUTER_API_KEY` or `GEMINI_API_KEY` in commits, logs or test fixtures. Do not run a paid voice or social publish operation without the owner's request.
- When a bug cannot be reproduced without original audio/visual artifacts, distinguish **code fix / synthetic CI / real-media QA needed**.
