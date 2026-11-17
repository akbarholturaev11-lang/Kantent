# Agent entry point — HSK AI Content Studio

Before work, read `AI_RULES.md` (global guardrails), `PROJECT_MEMORY.md` (architecture), and the task-specific source below. Treat the current repository as truth, not previous chat content.

**New-chat orientation:** From the repository root start at [`../START_HERE.md`](../START_HERE.md). For current unresolved tasks read [`docs/audits/CURRENT_TASKS.md`](docs/audits/CURRENT_TASKS.md); follow its links into the full V1–V7 evidence audit when needed. The task index is *not* a second production policy, and OPEN does not mean implemented. Check current main before resuming any prior work.

**Active continuation handoff:** Read [`docs/audits/WORK_CONTEXT.md`](docs/audits/WORK_CONTEXT.md) for the current P0/P1 coding branch, tested changes, PR dependency, blockers and next action. It is a progress log, never an override of these canonical rules.

## Agent roles (who does what)

| Agent | Started by | Owns | Never |
|---|---|---|---|
| **Codex — local video producer** | the owner's chat command, e.g. «Бугунги видеони тайёрла» | the runbook at the top of `content/WORKFLOW.md`: authors today's slot when the calendar has none, completes action plans, **generates the lesson frames** and **builds missing meaning-visual components** (below), voice, render, QA and the grouped preview; after the owner's exact approval, the approved publications | publishing unapproved video; the paid image API (`--paid` is for Claude Code only — Codex's own image generation is free, owner 2026-11-17); regenerating a saved voice take or frame; inventing characters; editing approved/published history |
| **Claude Code — engineering and audits** | the owner's request | code, tests, CI, rule migrations and audits on a branch, merged to `main` only with green checks; may run production on request under the same rules | pushing red checks to `main`; changing voice/CTA policy without the owner |
| **Calendar Reserve — ChatGPT scheduled, daily** | its schedule | complete CTA-free future sources for the next `calendar.json#planningBuffer.targetFutureEpisodes` dates in every default language, each written for its content type goal in `content/creative-formats.json#contentGoals`, including `visual.illustration` beats and `content/lesson-art/<id>.json` from `content:variety` (`content/WORKFLOW.md` reserve steps) | voice, frames, render, publication |
| **Feedback — ChatGPT scheduled, daily (Monday experiment review)** | its schedule | Zernio observations, reports, hypotheses and Hook/CTA/visual-variety A/B and content-experiment readouts (`content/EXPERIMENTS.md`), judging each content type only by its own goal metric (`content/creative-formats.json#contentGoals`); **append-only verified observations/reports and strictly provider-verified publication status reconciliation directly to `main`** under `content/feedback/AGENT_PLAYBOOK.md` (owner 2026-11-09) | writing scripts or calendar rows, changing policy, publishing, editing files outside feedback observations/reports |
| **HSK AI News — ChatGPT scheduled, every 3 days** | its schedule | source-verified static photo news to the four authorized feeds (`content/telegram-agent.json`) | video, Reels, Stories, RU Facebook |
| **GitHub Actions** | push/PR, or an owner dispatch | consistency and test CI; `video-review.yml` review renders; the Zernio publish workflows only on an owner dispatch with exact hashes | publishing on their own |

Handoffs: Calendar Reserve → Codex (complete sources); Codex → owner (one preview bundle); owner → Codex or Actions (exact approval); Feedback → Calendar Reserve (hypotheses and test IDs); any agent → `docs/audits/CURRENT_TASKS.md` (open defects). Every agent first reads the latest `main`.\n\n**Codex video-start check — MotionKit TEST ONLY:** Read the experimental motion section at the beginning of `content/WORKFLOW.md` before every video job. The **Codex agent itself** makes the semantic component choice; the code only provides deterministic candidate lists. No new AI API/keys are connected. This is a TEST-only pilot introduced by PR #70; even after merging code, the optional effects are off by default pending real-voice visual QA and exact owner approval. Never mistake a TEST brief for default rendering, owner approval or publication.\n

**Codex video-start check — SoundKit P2 TEST ONLY:** At every new RU/TJ video job, read `content/WORKFLOW.md#codex-soundkit-p2--test-only-automatic-localized-source-briefs-no-audio-mix` and the automatic `soundKitTest` result. Codex itself chooses scene-specific licensed sound references **or SILENCE**, with authentic localized narration and visual evidence; run `content:soundkit:test` validation on each language’s decision. P2 does not render or call a new AI API. P3 binds sound intent only to verified imported voice/word cue SHA; P4 may create a separate opt-in (`HSK_AI_SOUND_DESIGN_TEST=1`) preview MP4 in ignored `review/sound-design-tests`, without changing approved Gemini source voice or official video packages. P4 is NOT production, P5 real audio metrics and P6 owner A/B remain open; nothing grants publication approval.

## Source ownership (do not duplicate values)

| Information | Canonical source |
|---|---|
| Active global behavior and safety rules | `AI_RULES.md` |
| Production procedure and error handling | `content/WORKFLOW.md` |
| Default production languages, locale codes and per-language content roots | `content/languages.json` |
| Social account-to-language routing, video destinations and non-video update channels | `content/publication-destinations.json` |
| Unified 3-day source-verified HSK AI photo-news agent: Telegram TJ, Instagram RU+TJ and Facebook TJ, exact connected targets, 4:3 original image and authorized no-approval photo-feed post policy | `content/telegram-agent.json` (using `content/publication-destinations.json` for the exact Telegram account) |
| Dates, IDs, cadence, episode references | `content/calendar.json` |
| Future publishing weekdays, consecutive series parts and autonomous draft reserve | `content/calendar.json#weeklySchedule`, `#seriesPolicy` and `#planningBuffer` |
| Future planned episode buffer (minimum/target) | `content/calendar.json#planningBuffer` |
| Topic-based adaptive story selection and editorial policy | `content/creative-formats.json#storytellingPolicy`; optional annotations in `content/EPISODE_SCHEMA.md` |

| Raw external Zernio performance observations and optimizer audit notes | `content/feedback/` (not the canonical Hook/CTA Labs) |
| Shared CTA-free lesson source; approved/published legacy snapshots kept immutable | `content/episodes/*.json` |
| Translated CTA-free lesson scripts and source-version binding | `episodes/*.json` under each localized content root in `content/languages.json`; `content/EPISODE_SCHEMA.md` |
| Approved voice/provider/settings for each language | `voice-profile.json` in that language's configured content root |
| Language-specific CTA wording and active corrections | `cta-lab.json` in that language's configured content root, explained by `content/CTA_LAB.md` |
| Language-specific hook rules, hypotheses and readbacks | `hook-lab.json` in that language's configured content root, explained by `content/HOOK_LAB.md` |
| Creative packaging formats and pilot allocation | `content/creative-formats.json` |
| The separate goal of each weekly content type (lesson → HSK AI users, advertisement → brand recall, serial part → followers/subscribers), its closing and the metric it is judged by | `content/creative-formats.json#contentGoals` |
| Standalone advertising stories, minimalist presentation and production procedure | `content/creative-formats.json#promoPolicy`, `content/visual-system.json#promoPresentation` and `content/PROMO_WORKFLOW.md` |
| Design tokens, active lesson presentation/date, full-video duration, caption numbers and motion parameters | `content/visual-system.json` |
| Experimental SFX selection and source-evidence policy (P2 TEST ONLY; not a production audio change) | `content/sound-design.json` (inventory `content/sound-library.json`; original mix tokens remain in `visual-system.json#sound`) |
| Visual editorial method | `content/EDITING_SPEC.md` |
| Professional-motion meaning visuals: word → animated icon / sentence-pattern stage lexicon (reusable by every lesson) | `content/meaning-visuals.json`, rules in `content/EDITING_SPEC.md#professional-motion-system` |
| Automatic video cover design and review | `content/EDITING_SPEC.md#video-cover` and `content/WORKFLOW.md#4-render-and-validate` |
| Semantic shot/action enumeration and rollout status | `content/semantic-visual-system.json`, explained by `content/SEMANTIC_VISUAL_SCHEMA.md` |
| P3 evidence-based shot suggestion rules | `content/semantic-shot-intents.json`, explained by `content/SEMANTIC_SHOT_ADVISER.md` |
| Episode schema and invalidation | `content/EPISODE_SCHEMA.md` |
| Declarative teaching-drawing payload and authoring procedure | `content/GRAPHIC_SCENES.md` |
| Illustrated-glass lesson format, text roles, safe zone and subtitle placement | `content/EDITING_SPEC.md#illustrated-glass-lesson-format` |
| The only characters allowed in video frames (HSK AI cast: panda, dragon, crane, monkey, rabbit), their identity rules and exact app vectors | `content/characters/hsk-ai-characters.json` (+ rendered `content/characters/<id>-<mood>.png`) |
| Per-lesson frame (lesson art) manifests; generated images and provenance | `content/lesson-art/<episode-id>.json`; `public/lesson-art/<episode-id>/` |
| Visual variety (settings library, character roles, layout patterns, A/B experiments) | `content/visual-variety.json`, applied by `scripts/visual-variety-plan.mjs` |
| Content experiments (one active test, styles A/B, stored arms, owner decisions) and the per-video publication record | `content/experiments.json` + `content/EXPERIMENTS.md` (`scripts/experiments.mjs`); `content/feedback/publications.json` (`scripts/publication-ledger.mjs`) |
| Frame review requirements and render gate | `scripts/review-lesson-art.mjs` (rules in `content/EDITING_SPEC.md#illustrated-glass-lesson-format`) |
| Runtime architecture, limitations and known technical gotchas | `PROJECT_MEMORY.md` |
| Developer startup commands | `README.md` |
| Installed skill inventory, functional categories and per-branch owners | `content/skill-catalog.json` |
| Skill selection principles and precedence | `content/SKILLS.md` |

## Codex: lesson frames

Frames are a **Codex task** (owner decision 2026-11-09). When Codex prepares an illustrated-glass lesson it runs `node scripts/generate-lesson-art.mjs <episode-id>`, reads `review/<episode-id>/lesson-art-codex-brief.md`, generates every missing **background** frame with its own image generation exactly as briefed (text-free, no people, no characters, ≥1500 px JPEG at the given path, references for continuity), records each with `--record-codex <name>`, then runs `node scripts/review-lesson-art.mjs <episode-id>`, fixes failures, looks at each frame and confirms it with `--confirm-visual` (stored, hash-bound, in the committed `public/lesson-art/<id>/provenance.json`). `prepare_today_video`/`content:make` return `lesson-art-required` with this brief **before paid voice** until the review passes; commit the frames and provenance with the lesson. Characters are never generated (they are the HSK AI cast drawn from `content/characters/hsk-ai-characters.json`). Codex never invents a character, **never calls the paid `--paid` image route** — its own image generation is free; the paid API is only for Claude Code, which cannot generate images itself (owner 2026-11-17; `generate-lesson-art.mjs --paid` refuses a Codex environment) — and never regenerates a saved frame unasked. Full procedure: `content/WORKFLOW.md` step 2.6.

## Codex: meaning visuals

Professional-motion slides show what the Chinese means with animated components from the reusable library (`content/meaning-visuals.json`, `src/pro-motion/Meaning*.tsx`). When the library has no fitting component, **Codex builds it itself and adds it to the library** (owner decision 2026-11-17): `prepare_today_video`/`content:make` return `meaning-visuals-required` with `review/<episode-id>/meaning-visuals-codex-brief.md` **before paid voice**, and render refuses an uncovered slide. Codex builds only original drawings with the HSK AI cast for any person, passes `meaning-visual-check --strict` and the tests, looks at the rendered `HSKAI-MeaningGallery`, and commits the library change with the lesson. Procedure: `content/WORKFLOW.md` runbook; rules: `content/EDITING_SPEC.md#professional-motion-system`.

## Automatic rule categorization

Whenever the owner adds or changes a rule, **first classify it using the Source ownership table and save it in the relevant canonical file and section**. Put only genuinely cross-cutting global behavior or safety rules in `AI_RULES.md`; do not use it as a catch-all. If no exact category exists, extend the closest existing owner's section; create a new canonical file only for a genuinely separate domain and add it to this table. Never duplicate the rule in other files—link to its source instead.

## Required rule-change migration

When the owner **explicitly changes an established rule**, update its canonical source, then search active documentation, configuration, future plans, and source code for dependent or contradictory copies. Remove or update those copies **in the same change**. Never append the new rule next to an obsolete active rule. Do not silently rewrite previously published/approved episode snapshots, analytics, experiment logs or append-only history.

After any rule change, run `npm run check:consistency` from this project directory. Fix all reported violations before commit/push. The checker detects structural duplication and broken references; it **cannot prove semantic consistency**, so manually review any rule-dependent code, scripts and historical exceptions. If a previously approved voice or publication policy changes, follow the required explicit owner approval in `AI_RULES.md`.

## Skill selection at the moment of work

Before creating, changing, rendering or exporting any video, invoke the local MCP `recommend_skills` tool with the actual user request and the existing project's engine (when known). Read the owning Skill's `SKILL.md` and only the recommended phase references; helpers are optional and must be task-relevant. The sole category/branch inventory is `content/skill-catalog.json`. If the MCP tool is unavailable, follow the decision hierarchy in `content/SKILLS.md` manually; do not blindly trust a Skill frontmatter claim. A recommendation is advisory: it does not install a package, approve an engine migration, replace a voice, or authorize social publishing. If the tool returns `clarify` or `approval-required`, stop for the missing decision instead of silently choosing a framework.

## Editorial skill selection for scheduled agents

The daily Calendar Reserve, daily Feedback and **every-three-day Telegram TJ News** agents are three separate scheduled ChatGPT tasks. Drafting and Feedback remain nonpublishing. The **single 3-day HSK AI News agent** is the only owner-authorized autonomous publisher of **source-verified static photo news**: Tajik Telegram `@hskaiapp`, Russian Instagram Feed `@hskai.app`, Tajik Instagram Feed `@hskai.apptj`, and Tajik-only Facebook Feed `Akbarholturaev`. It never publishes video, Reels or Stories; Facebook RU automatic Zernio publishing stays disabled. See `content/telegram-agent.json` for the verified task ID, and `content/publication-destinations.json` for routing. Do not create duplicate schedulers or grant automatic VIDEO publishing. On each run read the latest `main` plus `content/skill-catalog.json`, then use `recommend_skills` when available, otherwise read the exact matching project-local SKILL.md according to `content/SKILLS.md`.

- **Calendar Reserve:** when authoring or repairing a future, unapproved HSK 1–2 lesson for the shared Instagram Reels/YouTube Shorts body, consult `.agents/skills/ig-reel-planning/SKILL.md` *during editorial hook/storyboard planning only*. This must not replace `content/hook-lab.json`, fabricate Chinese facts or add a CTA to canonical episode source.
  Only this scheduled writer (or a separately owner-invoked drafting agent) owns new future source/calendar files for the content types in `calendar.json#weeklySchedule`; ads follow `PROMO_WORKFLOW.md`. Verify **all** default languages in `content/languages.json`, each locale's matching `localization.sourceHash`, current `content/visual-system.json#lessonPresentation`, complete cue-linked `motionBeats`, `GRAPHIC_SCENES.md` when custom objects/actions are needed, and topic-selected `storytelling` metadata for new/revised drafts. `scripts/self-improvement-check.mjs#inspectDraftReadiness` now checks every configured production language and source-hash binding. It is **static source readiness**, not proof of real Gemini timings, an approved render or a completed publication.
- **Feedback (daily; Monday experiment review):** Instagram caption review uses `ig-caption-quality` only for *proposed future publication copy* when that is explicitly part of the report; competitor benchmarking uses `ig-competitor-research` only when real authorized external references and comparable evidence are available. Neither is a prerequisite to own-account Zernio analysis, and no social-post or message is automatically sent.
  Feedback owns sourced per-platform observations, descriptive reports and **hypotheses only**. It must never write or repair future lesson/promo JSON or calendar entries, nor promote a Hook/storytelling/CTA policy without valid fixed-age 7d evidence and explicit owner approval. A detected buffer shortfall is a handoff to Calendar Reserve, not permission for the analytics task to author scripts.
- **HSK AI News (every 3 days):** follow `content/telegram-agent.json#socialNewsDistribution` and `content/publication-destinations.json#newsPhotoDestinations`. Inspect the past 72h of actual `HSK-AI-Bot/main` user-facing releases, make verified original 4:3 photo with immutable GitHub RAW media URL, write RU captions for Instagram `@hskai.app` and TJ captions for Telegram `@hskaiapp`, Instagram `@hskai.apptj` and Facebook `Akbarholturaev`, validate and auto-publish independently after per-account duplicate checks. No per-post owner approval for these image+caption news posts. Never send video, Reels, Stories, auto DM, or RU Facebook auto posts; missing media/source blocks corresponding publications.
- Regular voice, semantic cue validation, Remotion rendering, CTA and final-publication approval remain unchanged.

## Central CTA assembly for future lessons

Author shared and translated future lesson sources with teaching scenes only: **no** top-level `cta`, `ctaExperiment` or embedded CTA scene. The language's canonical CTA copy plus visual template are in its configured `cta-lab.json`; `scripts/episode-cta-assembly.mjs` adds them when that language's working episode is materialized. Each working copy then keeps its own immutable-version CTA snapshot for verified voice, cue timing, QA and publication. Legacy sources and registered CTA experiments are historical, not alternate CTA sources. Do not auto-acknowledge a changed owner rule or reuse a stale registration: a new CTA version must be validated/registered before TTS/render.

## Language-scoped production

Resolve the production language set and content roots from `content/languages.json`. Ordinary dated/today preparation creates every configured default language for one calendar lesson; `content/WORKFLOW.md` owns the command contract. Ordinary standalone ad requests use the same configured default language set under `content/PROMO_WORKFLOW.md`; translated promo drafts live in each content root's `promos/` directory and bind to the shared source. Per-language reads, edits, labs, voice approval and publication approval must select the intended language explicitly when it is not the legacy default. Keep translations bound to the current shared source with `localization.sourceHash`; preserve the Chinese teaching point and regenerate narration/timing separately. Report missing/stale translations, pending voice decisions and partial outputs accurately; never substitute another language or reuse its review approval. Historical observations and publication records without a language marker belong to the original series, not to a translated series.

## Zernio feedback learning

`content/feedback/observations/` stores externally sourced measurement snapshots. `scripts/feedback-analyzer.mjs` validates and summarizes them read-only; it is not a second Hook Lab. Follow `content/feedback/AGENT_PLAYBOOK.md` for future connector-assisted analysis. `content/calendar.json#planningBuffer` owns future scenario coverage. In particular, do not treat unequal-age lifetime totals as same-window experiment results.

## Operating boundaries

- Do not edit secrets, add credentials, or use an unapproved external service.
- Do not treat a VIDEO production command as authorization to publish. Keep the exact video preview gate in `AI_RULES.md`. The distinct 3-day HSK AI News task alone has the separate owner-approved static news+4:3 image auto-publishing rule in `content/telegram-agent.json`.
- Preserve the existing renderer and use relevant guidance in `content/SKILLS.md` only when needed.
- Keep generated review artifacts in the designated ignored folders. Don't treat temporary files as canonical sources.
- Make the smallest compatible change, validate affected scripts/render stages, and report tests and blockers truthfully.

Cross-type publication attribution, serial IDs and evidence readbacks: `content/feedback/CONTENT_TRACKING.md`.
