# Agent entry point — HSK AI Content Studio

Before work, read `AI_RULES.md` (global guardrails), `PROJECT_MEMORY.md` (architecture), and the task-specific source below. Treat the current repository as truth, not previous chat content.

## Source ownership (do not duplicate values)

| Information | Canonical source |
|---|---|
| Active global behavior and safety rules | `AI_RULES.md` |
| Production procedure and error handling | `content/WORKFLOW.md` |
| Default production languages, locale codes and per-language content roots | `content/languages.json` |
| Dates, IDs, cadence, episode references | `content/calendar.json` |
| Future publishing weekdays, consecutive series parts and autonomous draft reserve | `content/calendar.json#planningWeekdays`, `#seriesPolicy` and `#planningBuffer` |
| Future planned episode buffer (minimum/target) | `content/calendar.json#planningBuffer` |
| Topic-based adaptive story selection and editorial policy | `content/creative-formats.json#storytellingPolicy`; optional annotations in `content/EPISODE_SCHEMA.md` |

| Raw external Zernio performance observations and optimizer audit notes | `content/feedback/` (not the canonical Hook/CTA Labs) |
| Shared CTA-free lesson source; approved/published legacy snapshots kept immutable | `content/episodes/*.json` |
| Translated CTA-free lesson scripts and source-version binding | `episodes/*.json` under each localized content root in `content/languages.json`; `content/EPISODE_SCHEMA.md` |
| Approved voice/provider/settings for each language | `voice-profile.json` in that language's configured content root |
| Language-specific CTA wording and active corrections | `cta-lab.json` in that language's configured content root, explained by `content/CTA_LAB.md` |
| Language-specific hook rules, hypotheses and readbacks | `hook-lab.json` in that language's configured content root, explained by `content/HOOK_LAB.md` |
| Creative packaging formats and pilot allocation | `content/creative-formats.json` |
| Standalone advertising stories, minimalist presentation and production procedure | `content/creative-formats.json#promoPolicy`, `content/visual-system.json#promoPresentation` and `content/PROMO_WORKFLOW.md` |
| Design tokens, active lesson presentation/date, full-video duration, caption numbers and motion parameters | `content/visual-system.json` |
| Visual editorial method | `content/EDITING_SPEC.md` |
| Semantic shot/action enumeration and rollout status | `content/semantic-visual-system.json`, explained by `content/SEMANTIC_VISUAL_SCHEMA.md` |
| P3 evidence-based shot suggestion rules | `content/semantic-shot-intents.json`, explained by `content/SEMANTIC_SHOT_ADVISER.md` |
| Episode schema and invalidation | `content/EPISODE_SCHEMA.md` |
| Declarative teaching-drawing payload and authoring procedure | `content/GRAPHIC_SCENES.md` |
| Runtime architecture, limitations and known technical gotchas | `PROJECT_MEMORY.md` |
| Developer startup commands | `README.md` |
| Installed skill inventory, functional categories and per-branch owners | `content/skill-catalog.json` |
| Skill selection principles and precedence | `content/SKILLS.md` |

## Automatic rule categorization

Whenever the owner adds or changes a rule, **first classify it using the Source ownership table and save it in the relevant canonical file and section**. Put only genuinely cross-cutting global behavior or safety rules in `AI_RULES.md`; do not use it as a catch-all. If no exact category exists, extend the closest existing owner's section; create a new canonical file only for a genuinely separate domain and add it to this table. Never duplicate the rule in other files—link to its source instead.

## Required rule-change migration

When the owner **explicitly changes an established rule**, update its canonical source, then search active documentation, configuration, future plans, and source code for dependent or contradictory copies. Remove or update those copies **in the same change**. Never append the new rule next to an obsolete active rule. Do not silently rewrite previously published/approved episode snapshots, analytics, experiment logs or append-only history.

After any rule change, run `npm run check:consistency` from this project directory. Fix all reported violations before commit/push. The checker detects structural duplication and broken references; it **cannot prove semantic consistency**, so manually review any rule-dependent code, scripts and historical exceptions. If a previously approved voice or publication policy changes, follow the required explicit owner approval in `AI_RULES.md`.

## Skill selection at the moment of work

Before creating, changing, rendering or exporting any video, invoke the local MCP `recommend_skills` tool with the actual user request and the existing project's engine (when known). Read the owning Skill's `SKILL.md` and only the recommended phase references; helpers are optional and must be task-relevant. The sole category/branch inventory is `content/skill-catalog.json`. If the MCP tool is unavailable, follow the decision hierarchy in `content/SKILLS.md` manually; do not blindly trust a Skill frontmatter claim. A recommendation is advisory: it does not install a package, approve an engine migration, replace a voice, or authorize social publishing. If the tool returns `clarify` or `approval-required`, stop for the missing decision instead of silently choosing a framework.

## Editorial skill selection for scheduled agents

The existing daily Calendar Reserve and the Monday/Wednesday/Friday feedback agent are independent scheduled ChatGPT tasks; their canonical production rules remain in `content/WORKFLOW.md` and `content/feedback/AGENT_PLAYBOOK.md`. Do not create duplicate schedulers or automatic publishing. On each run read the latest `main` plus `content/skill-catalog.json`, then use `recommend_skills` when available, otherwise read the exact matching project-local SKILL.md according to `content/SKILLS.md`.

- **Calendar Reserve:** when authoring or repairing a future, unapproved HSK 1–2 lesson for the shared Instagram Reels/YouTube Shorts body, consult `.agents/skills/ig-reel-planning/SKILL.md` *during editorial hook/storyboard planning only*. This must not replace `content/hook-lab.json`, fabricate Chinese facts or add a CTA to canonical episode source.
- **Feedback (Mon/Wed/Fri):** Instagram caption review uses `ig-caption-quality` only for *proposed future publication copy* when that is explicitly part of the report; competitor benchmarking uses `ig-competitor-research` only when real authorized external references and comparable evidence are available. Neither is a prerequisite to own-account Zernio analysis, and no social-post or message is automatically sent.
- Regular voice, semantic cue validation, Remotion rendering, CTA and final-publication approval remain unchanged.

## Central CTA assembly for future lessons

Author shared and translated future lesson sources with teaching scenes only: **no** top-level `cta`, `ctaExperiment` or embedded CTA scene. The language's canonical CTA copy plus visual template are in its configured `cta-lab.json`; `scripts/episode-cta-assembly.mjs` adds them when that language's working episode is materialized. Each working copy then keeps its own immutable-version CTA snapshot for verified voice, cue timing, QA and publication. Legacy sources and registered CTA experiments are historical, not alternate CTA sources. Do not auto-acknowledge a changed owner rule or reuse a stale registration: a new CTA version must be validated/registered before TTS/render.

## Language-scoped production

Resolve the production language set and content roots from `content/languages.json`. Ordinary dated/today preparation creates every configured default language for one calendar lesson; `content/WORKFLOW.md` owns the command contract. Ordinary standalone ad requests use the same configured default language set under `content/PROMO_WORKFLOW.md`; translated promo drafts live in each content root's `promos/` directory and bind to the shared source. Per-language reads, edits, labs, voice approval and publication approval must select the intended language explicitly when it is not the legacy default. Keep translations bound to the current shared source with `localization.sourceHash`; preserve the Chinese teaching point and regenerate narration/timing separately. Report missing/stale translations, pending voice decisions and partial outputs accurately; never substitute another language or reuse its review approval. Historical observations and publication records without a language marker belong to the original series, not to a translated series.

## Zernio feedback learning

`content/feedback/observations/` stores externally sourced measurement snapshots. `scripts/feedback-analyzer.mjs` validates and summarizes them read-only; it is not a second Hook Lab. Follow `content/feedback/AGENT_PLAYBOOK.md` for future connector-assisted analysis. `content/calendar.json#planningBuffer` owns future scenario coverage. In particular, do not treat unequal-age lifetime totals as same-window experiment results.

## Operating boundaries

- Do not edit secrets, add credentials, or use an unapproved external service.
- Do not treat a production command as authorization to publish. Follow the explicit final-preview gate in `AI_RULES.md`.
- Preserve the existing renderer and use relevant guidance in `content/SKILLS.md` only when needed.
- Keep generated review artifacts in the designated ignored folders. Don't treat temporary files as canonical sources.
- Make the smallest compatible change, validate affected scripts/render stages, and report tests and blockers truthfully.
