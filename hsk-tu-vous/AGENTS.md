# Agent entry point — HSK AI Content Studio

Before work, read `AI_RULES.md` (global guardrails), `PROJECT_MEMORY.md` (architecture), and the task-specific source below. Treat the current repository as truth, not previous chat content.

## Source ownership (do not duplicate values)

| Information | Canonical source |
|---|---|
| Active global behavior and safety rules | `AI_RULES.md` |
| Production procedure and error handling | `content/WORKFLOW.md` |
| Dates, IDs, cadence, episode references | `content/calendar.json` |
| Dated script and its versioned snapshots | `content/episodes/*.json` |
| Approved voice/provider/settings | `content/voice-profile.json` |
| CTA wording and active corrections | `content/cta-lab.json`, explained by `content/CTA_LAB.md` |
| Hook rules, hypotheses and readbacks | `content/hook-lab.json`, explained by `content/HOOK_LAB.md` |
| Design tokens, caption numbers and motion parameters | `content/visual-system.json` |
| Visual editorial method | `content/EDITING_SPEC.md` |
| Episode schema and invalidation | `content/EPISODE_SCHEMA.md` |
| Runtime architecture, limitations and known technical gotchas | `PROJECT_MEMORY.md` |
| Developer startup commands | `README.md` |
| Local skills routing | `content/SKILLS.md` |

## Automatic rule categorization

Whenever the owner adds or changes a rule, **first classify it using the Source ownership table and save it in the relevant canonical file and section**. Put only genuinely cross-cutting global behavior or safety rules in `AI_RULES.md`; do not use it as a catch-all. If no exact category exists, extend the closest existing owner's section; create a new canonical file only for a genuinely separate domain and add it to this table. Never duplicate the rule in other files—link to its source instead.

## Required rule-change migration

When the owner **explicitly changes an established rule**, update its canonical source, then search active documentation, configuration, future plans, and source code for dependent or contradictory copies. Remove or update those copies **in the same change**. Never append the new rule next to an obsolete active rule. Do not silently rewrite previously published/approved episode snapshots, analytics, experiment logs or append-only history.

After any rule change, run `npm run check:consistency` from this project directory. Fix all reported violations before commit/push. The checker detects structural duplication and broken references; it **cannot prove semantic consistency**, so manually review any rule-dependent code, scripts and historical exceptions. If a previously approved voice or publication policy changes, follow the required explicit owner approval in `AI_RULES.md`.

## Operating boundaries

- Do not edit secrets, add credentials, or use an unapproved external service.
- Do not treat a production command as authorization to publish. Follow the explicit final-preview gate in `AI_RULES.md`.
- Preserve the existing renderer and use relevant guidance in `content/SKILLS.md` only when needed.
- Keep generated review artifacts in the designated ignored folders. Don't treat temporary files as canonical sources.
- Make the smallest compatible change, validate affected scripts/render stages, and report tests and blockers truthfully.
