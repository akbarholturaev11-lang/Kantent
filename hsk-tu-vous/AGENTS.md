# Agent entry point — HSK AI Content Studio

Before work, read `AI_RULES.md` (global guardrails), `PROJECT_MEMORY.md` (architecture), and the task-specific source below. Treat the current repository as truth, not previous chat content.

## Source ownership (do not duplicate values)

| Information | Canonical source |
|---|---|
| Active global behavior and safety rules | `AI_RULES.md` |
| Production procedure and error handling | `content/WORKFLOW.md` |
| Dates, IDs, cadence, episode references | `content/calendar.json` |
| CTA-free future lesson scripts; approved/published legacy snapshots kept immutable | `content/episodes/*.json` |
| Approved voice/provider/settings | `content/voice-profile.json` |
| CTA wording and active corrections | `content/cta-lab.json`, explained by `content/CTA_LAB.md` |
| Hook rules, hypotheses and readbacks | `content/hook-lab.json`, explained by `content/HOOK_LAB.md` |
| Design tokens, caption numbers and motion parameters | `content/visual-system.json` |
| Visual editorial method | `content/EDITING_SPEC.md` |
| Episode schema and invalidation | `content/EPISODE_SCHEMA.md` |
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

## Central CTA assembly for future lessons

Author future canonical `content/episodes/*.json` lessons with teaching scenes only: **no** top-level `cta`, `ctaExperiment` or embedded CTA scene. The canonical copy plus visual template are under `content/cta-lab.json`; `scripts/episode-cta-assembly.mjs` adds them when a working episode is materialized. The working `review/<id>/episode.json` then keeps one immutable-version CTA snapshot for verified voice, cue timing, QA and publication. Legacy sources and registered CTA experiments are historical, not alternate CTA sources. Do not auto-acknowledge a changed owner rule or reuse a stale registration: a new CTA version must be validated/registered before TTS/render.

## Operating boundaries

- Do not edit secrets, add credentials, or use an unapproved external service.
- Do not treat a production command as authorization to publish. Follow the explicit final-preview gate in `AI_RULES.md`.
- Preserve the existing renderer and use relevant guidance in `content/SKILLS.md` only when needed.
- Keep generated review artifacts in the designated ignored folders. Don't treat temporary files as canonical sources.
- Make the smallest compatible change, validate affected scripts/render stages, and report tests and blockers truthfully.
