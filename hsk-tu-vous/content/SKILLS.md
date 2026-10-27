# HSK AI — Skills routing guide

## Single source of truth

**`content/skill-catalog.json` is the only active machine-readable inventory.** It assigns every installed `.agents/skills/<name>/SKILL.md` to exactly one functional category, an engine compatibility route, and a main usage branch. It also defines one *owner* and optional *helpers* for each task branch.

Do not keep a second skill-by-skill list in this Markdown file. Use `scripts/skill-router.mjs` or `recommend_skills` from the local HSK AI MCP server. Read the returned owner skill and only the references needed for that phase.

## Functional categories

- `engine` — Remotion/HyperFrames composition, runtime and validation.
- `layout` — composition of elements, safe areas, responsive text and small interface elements.
- `effects` — animations, transitions, timing, 3D, motion blocks.
- `captions` — subtitles and caption treatments for existing footage.
- `audio` — music/SFX mixing and approved media assets.
- `brand` — design system and approved visual identity.
- `promo` — product advertisements, announcements and launch films.
- `teaching` — explainers and briefing.
- `data` — numerical visualizations, milestones and comparisons.
- `editing` — existing-footage enhancement, interactive slides and covers.
- `export` — reframing and encoding to requested formats.
- `migration` — explicit framework migration only.
- `social` — Instagram editorial advice only: lesson hook planning, post-copy review, read-only competitor research. This is not a video engine or subtitle format.

Each skill belongs to **one** category. Categories may have different *workflows*, but do not create another skill for the same responsibility unless the engine or actual deliverable differs.

## Three branches for each production step

The recipes in `skill-catalog.json` have `lesson`, `premium` and `special` branches where relevant. In each branch the **owner** supplies the primary technique. **Helpers** are loaded only when the actual task needs them; they do not replace the owner.

| Step | Ordinary HSK lesson | Premium HSK AI promo | Explicit special request |
| --- | --- | --- | --- |
| Effects | `remotion-best-practices`, its `rules/effects.md`, `rules/transitions.md` | `hyperframes-animation`, optional `hyperframes-keyframes`/`hyperframes-registry` | `motion-effects` for a standalone effect |
| Layout | Remotion `rules/video-layout.md`/`rules/measuring-text.md` | `hyperframes-studio` with HSK brand limits | `apple-design` or Figma-specific input |
| Captions | Remotion `rules/subtitles.md`, existing HSK caption components | `hyperframes-studio` captions track | `embedded-captions` for existing talking-head footage only |
| Audio | Approved Gemini voice profile and automatic word-timed audio importer | `hyperframes-audio` for mixing existing tracks | Standalone music/video workflow only |
| Brand | Existing `visual-system.json` (no extra brand files) | `hyperframes-creative` references canonical brand | `brand-intake` only on requested brand reset |
| Advertising | Existing Remotion renderer for simple promo | `product-launch-video` | Explicit Apple-style or other specialized promo |
| Export | Remotion video render with its existing audio | `hyperframes-cli` validation | `reel-export` only for video reframe/encoding |

For data visualizations, educational explainers, social content, and special existing-footage edits, use the corresponding **named capability** under `skill-catalog.json`; they remain registered without becoming default steps for every video.

For new advertisements, `recommend_skills` also returns `creativeGuidance` pointing to the canonical promo policy, minimal presentation and `PROMO_WORKFLOW.md`. Read those before writing the scenario. This is editorial guidance across both existing engine branches, not a new skill, another renderer or a migration permission. The lesson/storytelling rules and autonomous Calendar Reserve scope remain separate.

## Selected Instagram advisors (no wholesale third-party installation)

Three HSK-specific, project-local `social` skills are registered as ordinary `.agents/skills/<name>/SKILL.md` modules:
- `ig-reel-planning`: `social_hook/lesson`, advice before the approved Hook Lab + storyboard + actual Gemini cue workflow; automatically offered only for explicitly Instagram-scoped HSK lesson video tasks.
- `ig-caption-quality`: `social_caption/special`, for **Instagram publication copy**, not baked-in captions/subtitles.
- `ig-competitor-research`: `social_research/special`, read-only source-backed competitor benchmarking. Never scrape, claim access to private metrics or feed invented results into the Hook Lab.

Each advisor is reachable through `recommend_skills` for its own task phrasing. The **scheduled daily draft writer** explicitly consults `ig-reel-planning` as preproduction guidance when drafting the shared Reels/Shorts lesson, and the **scheduled Mon/Wed/Fri feedback agent** performs owned-account analytics from the existing sources while invoking `ig-competitor-research` only for available independently verified competitor evidence, and `ig-caption-quality` only for a proposed Instagram publication caption. `content/WORKFLOW.md` and `content/feedback/AGENT_PLAYBOOK.md` define these handoffs; the scheduled task prompts must point to them, not duplicate the skills' instructions. These modules do not create another CTA source, replace `content/WORKFLOW.md`, make external requests, install Python tools, alter the current Remotion scene renderer, or authorize publishing. Inspiration: [Jakeschincariol/instagram-agent-skill](https://github.com/Jakeschincariol/instagram-agent-skill) (MIT); no complete upstream skill bundle is copied.

## Non-negotiable precedence

1. `AGENTS.md`, `AI_RULES.md`, `content/WORKFLOW.md`, `content/EDITING_SPEC.md`, `content/visual-system.json`, `content/cta-lab.json` and `content/voice-profile.json` override all third-party Skill samples.
2. **Ordinary dated HSK lessons remain Remotion.** Only an independent special premium commercial may use HyperFrames; migration of existing code requires the owner's separate explicit approval.
3. Production captions come from Gemini Transcribe word timestamps for the audio generated with the approved Gemini TTS profile. The normalized transcript must match every script token before a VTT is imported. Ignore Whisper/WhisperX/ElevenLabs/HeyGen recommendations in generic skills; do not add another TTS/transcription provider.
4. Remotion caption styling and placements are owned by `visual-system.json` and `EDITING_SPEC.md`; do not copy a generic TikTok highlight color, pill background or 80px font just because a skill illustrates it.
5. HyperFrames safe zones can guide a standalone promo, but don't move existing lesson captions to the export skill's generic coordinates. Keep both existing narration audio and caption timing on aspect conversions.
6. A generic skill's `brand.md`, `MOTION.md` or `CLAUDE.md` recommendation is **not** permission to create parallel HSK brand sources. Never replace approved logo, palette, CTA or product screenshots from a preset.
7. Skills may advise, but they do **not** authorize publishing, a network download, credential creation, auto-update, dependency installation or an engine migration. Preserve the preview approval gate.

## Runtime selection and maintenance

Before starting any video, invoke `recommend_skills(task, existingEngine)`. It chooses the engine, named workflow, and optional per-stage owner/helper skills. It reads `skill-catalog.json`. A return of `clarify` or `approval-required` means do not proceed without that decision.

**Skill deduplication:** remove a skill only if another installed skill truly performs the same task and deleting it does not eliminate a separate output/engine or leave a broken reference. For any rename/delete, migrate references and tests in the same change. Do not delete distinct niche capabilities solely because they are infrequent.

A new skill must be added to the JSON catalog with category, route, branch and purpose. Verify all folders/`SKILL.md` names, recipe owners and helper references through `npm run check:consistency`. Run `node --test scripts/skill-router.test.mjs`; inspect actual output for new task patterns. Tests do not prove visual quality without rendering.
