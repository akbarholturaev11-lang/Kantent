# Kantent / HSK AI Content Studio — start here

**What this is:** A Node.js + MCP + Remotion production system for short Chinese-learning lessons and genuine HSK AI product advertisements. It is **not** the HSK AI learner app. The main active code, content, and rules are under [hsk-tu-vous/](hsk-tu-vous/).

**What it must do:** Turn source-checked RU and TJ lesson or promotional scripts into *meaning-accurate, voice-synchronized* vertical videos with real TTS/STT word cues, correct Hanzi/pinyin, original and authentic visuals, per-platform CTA/review assets, and an **owner-approved exact final preview** before video publication. First-take voice quality and Mandarin pronunciation matter; good audio must be preserved if STT fails. Report incomplete/blocked tasks truthfully. Use existing approved models/voices and current canonical configurations; do not invent or rotate providers to bypass limits.

## The pipeline in 10 seconds

Calendar/content JSON → verified bilingual narrative → scene-by-scene *frame intent* (what must be seen at which spoken cue) → first-quality approved voice → exact word timestamps/captions → Remotion frame transitions and MP4 → actual phone-size semantic/audio QA → language/platform review package → explicit video owner approval → verified separate publication.

Lessons use the owner-approved **illustrated-glass format** (text-free frames made by Codex, the HSK AI cast drawn from the app's vectors, liquid-glass chips, bottom-first subtitles). For the daily command «Бугунги видеони тайёрла» follow the **runbook at the top of [WORKFLOW.md](hsk-tu-vous/content/WORKFLOW.md)**; who does what is in [project AGENTS.md → Agent roles](hsk-tu-vous/AGENTS.md#agent-roles-who-does-what). Not everything is proven end to end (for example the Tajik one-take import and promo screenshot capture); consult [CURRENT_TASKS](hsk-tu-vous/docs/audits/CURRENT_TASKS.md) before claiming a capability.

## Read files in this order

1. [Root AGENTS.md](AGENTS.md) and [project AGENTS.md](hsk-tu-vous/AGENTS.md) — agent boundaries and canonical source ownership.
2. [AI_RULES.md](hsk-tu-vous/AI_RULES.md) — active safety/voice/frame/publication rules.
3. [PROJECT_MEMORY.md](hsk-tu-vous/PROJECT_MEMORY.md) — current technical architecture, traps, and state.
4. [WORKFLOW.md](hsk-tu-vous/content/WORKFLOW.md) — real production steps; [EDITING_SPEC.md](hsk-tu-vous/content/EDITING_SPEC.md) and [GRAPHIC_SCENES.md](hsk-tu-vous/content/GRAPHIC_SCENES.md) for visual QA.
5. [CURRENT_TASKS.md](hsk-tu-vous/docs/audits/CURRENT_TASKS.md) for status and [V1–V7 full audit](hsk-tu-vous/docs/audits/KANTENT_FULL_TECHNICAL_AUDIT_V5_2026-11-05.md) for line-linked evidence.

## Where actual settings live

- [calendar.json](hsk-tu-vous/content/calendar.json): planned episodes and dates.
- [languages.json](hsk-tu-vous/content/languages.json): production locales and content roots.
- [publication-destinations.json](hsk-tu-vous/content/publication-destinations.json): authorized targets.
- Per-locale `voice-profile.json`: approved voice/model; `cta-lab.json`: final CTA.
- [visual-system.json](hsk-tu-vous/content/visual-system.json): graphics, captions and timing.
- `hsk-tu-vous/scripts/`: preparation, generation, checks, import, rendering, and MCP. `hsk-tu-vous/src/`: Remotion/React rendering.

**Entry commands** (from `hsk-tu-vous/`, with Node.js and dependencies available): `npm ci`, `npm run check:consistency`, `npm run content:plan`, `npm run content:make -- YYYY-MM-DD`; `npm run mcp` for project MCP operations. Real TTS and publishing require authorized credentials, owner gates, and appropriate environment. Do not run paid or publishing actions just to orient yourself.

**Owner decisions:** P01–P12 in the full audit are approved; P07 (repair root cause), P10 (genuine browser-captured PWA screenshots when available), P11 (first-take quality) are especially important. Approved historical content remains immutable.

**For a new chat:** Fetch latest `main`, read the short files first, choose one scoped outstanding task, inspect corresponding runtime, run affected tests and report exact commit, outcome, blockers. Do not restart historical design debates from archived plans.
