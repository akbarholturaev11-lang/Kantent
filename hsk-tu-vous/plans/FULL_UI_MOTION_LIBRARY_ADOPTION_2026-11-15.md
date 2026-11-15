# Full UI & Motion Library — Kantent selective per-video adoption

Status: **EXPERIMENTAL TEST PILOT IMPLEMENTED** (owner direction 2026-11-15). Verified free catalogs have been imported and original Remotion adapters plus Codex-authored, locale-scoped TEST selection are implemented. Normal rendering and publishing behavior remain unchanged; no real voice A/B owner approval exists. Target: active `hsk-tu-vous/`; never use legacy `videos/`.

## Owner decision

**Import the full legitimately available component collections, then choose and adapt components selectively for each video.** The reusable catalog may be large, but a rendered video should include only components selected by its narration, visual meaning, content type and brand. Each video must have a distinct **composition, rhythm and component combination** rather than a mechanically repeated template. Do not demand that all raw components are globally unique: repetition is acceptable when it is semantically correct, but repeated assembly without editorial reasoning is not.

## Source scope and ownership

The four sources discussed by the owner are **exactly**:

1. `https://bencho.dev/` — interaction demos and micro-interactions. Identify available downloadable source, license and attribution per component; do **not** assume a whole freely distributable source package.
2. `https://www.boardui.com/`, `https://github.com/BoardUI/boardui` — full free MIT source catalog (upstream currently documents 69 free entries, subject to pinned inventory); Pro requires proper license. Its Next.js app, API routes, AI agent runtime and secrets are **not** video dependencies.
3. `https://transitions.dev/`, `https://github.com/Jakubantalik/transitions.dev` (verify canonical repository and license at import time) — full legitimately available free transition recipes/skill. Pro recipes require valid access and permission. Existing recipes depend on browser interactions and must be adapted to deterministic Remotion frame values.
4. `https://www.beautifului.dev/` — the 21 demo interface concepts shown in the user's screenshot (agent/chat/approval/insight tables). Verify source availability and reuse license before importing. **Do not confuse with `https://beautiful-ui.dev/` (different product), or install the wrong library.** Demos/screenshots alone do not grant source reuse rights.

No subscription purchases, credentials, license circumvention, scraping paywalled source or source copied into this public repository contrary to license. Any Pro sources must be obtained through the owner's authenticated entitlement and held outside the public repo when required. Preserve source attribution, license files, upstream version/commit hash and provenance.

## Architecture

- **Collection layer:** a full, version-pinned, provenance-audited **catalog of all legitimately obtainable source/recipes**, kept outside the production bundle. An inventory/manifest can live in the repo, but licensed/private code should remain in private storage or an owner-approved private repo. Free upstream snapshots may be vendored only after checking redistribution terms. Avoid importing full template applications, example backends and runtime secrets.
- **Adaptation layer:** only relevant React/graphics fragments become reusable `src/video-components/` Remotion components with a stable prop schema and tests. Convert browser interactions, timers, hover/press, CSS keyframes and time-driven transitions to pure frame-based animation using Remotion `useCurrentFrame`, `interpolate`, `spring`, `Sequence`. No non-deterministic browser time/state on render.
- **Selection layer:** per episode, a visual director/selector reads the registered calendar content type, final localized narration, cue-aligned scene/beat intents, canonical palette, branded characters and safe zone; proposes a short component combination per beat. Choose by actual object/action/teaching purpose first; stylistic variety second. Store selection and parameters as **immutable episode-specific metadata** with version/pinned source IDs. Do not use unseeded randomness or invent spoken cues.
- **Export layer:** a Remotion composition imports **only selected approved adapter modules** via a constrained registry. Unused catalog components must not increase video runtime/bundle size or trigger network calls. RU/TJ content and all platform CTA/cue/time variants follow existing language/platform rules.
- **Brand and semantic guardrails:** `content/visual-system.json`, `content/EDITING_SPEC.md`, `content/creative-formats.json`, `content/WORKFLOW.md`, `AI_RULES.md` and `AGENTS.md` retain ownership. Preserve HSK AI cast identity, source-bound product truth, single liquid-glass teaching card + single timed subtitle for active lesson format, 1080×1920 vertical phone readability, safe zone, voice-synced motion, and owner approval before VIDEO publication. No generic dashboards when a Chinese sentence needs a literal recognisable action.

## Per-video composition policy

- **Lesson:** clear teaching object/action; optionally one selected typography or reveal effect. Do not place dashboard UI over a spoken meaning.
- **Advertisement:** authentic product screenshot/flow where supported, with restrained Beautiful UI / BoardUI-inspired app components, a deliberate transition and brand CTA.
- **Serial part:** continuity of characters/brand; distinct setting, motion and framing for each part; keep story continuity and separate part closure.
- A director should **avoid the same complete combination or scene sequence in adjacent videos**, unless the content requires continuity. Maintain an `episode-component-selection` audit so the agent can explain why each effect was chosen.
- A component must fit the voice/cue, be legible at 270×480, keep motion smooth and avoid flashes, strobe, glitch, high-frequency decorative motion and conflicting focus.
- Every adaptation should retain an easy disable/rollback switch, while leaving previously approved/published assets and hashes immutable.

## Implementation sequence and progress (2026-11-15)

1. **Licensing and inventory:** verify current upstream sources and licenses; enumerate every legitimately available component, code/recipe availability, upstream version, dependencies, browser-only assumptions and video use case. Create `component-catalog.json` with provenance, availability (`free-source`, `licensed-pro`, `demo-reference-only`, `blocked`), frame compatibility, selection tags and `reviewed` state. Full source acquisition for all allowed free components into a **separate catalog**; do not move them into the active renderer by default.
2. **Baseline/compatibility audit:** run current main test/consistency/TS lint and record baseline. Investigate actual Remotion/React/Tailwind compatibility, package changes, browser APIs and licensing before any edits to `src/`.
3. **Adapter pilot:** implement a cross-source reusable adaptation set (text reveal, number/card state, glass stats, chat/AI states, progress, transitions); leave nonvideo components unadapted. Render a synthetic preview without paid voice; compare 1080×1920 and phone-size 270×480.
4. **Per-video selector:** consume actual registered episode/beat data; output versioned deterministic selections and compatibility checks. Ensure variety across consecutive dates, while preserving semantic intent, characters and exact real-word timing. No editing existing approved voices, CTA, publication state.
5. **A/B quality gate:** first test on one unapproved video; export baseline and candidate, inspect complete MP4 with voice plus onset/settled frame sheets, continuity, text accessibility, render failures, bundle/runtime cost. Owner approves exact preview before adoption to production.
6. **Rollout:** migrate only after green CI + meaningful visual QA; document reusable components and how future video agents choose them. Do not automatically adopt new upstream versions or Pro plans.

## Acceptance criteria

- A full catalog of all legitimately obtainable/free sources, with license/provenance metadata, and clear **not obtainable without license** status for restricted items.
- Catalog code/reference storage is isolated from production modules; no accidental dependency on Next.js API runtimes, secrets, browser-only interactive state, network calls or Pro code in this public repository.
- **Codex is the creative AI selector** on each registered localized video: a deterministic algorithm only proposes compatible candidates; Codex writes justified, source-hash-bound `TEST_ONLY` decisions per RU/TJ scene. No new AI API is connected. Video variation and visual correctness require actual real-video inspection, not just deterministic structural tests.
- Successful baseline and regression tests, independent real MP4 visual QA, no breakage to current content language, timing, asset identities, publication gate or approved/published videos.
- No claims that all components have been ported to Remotion; **download/catalog all allowed**, **adapt only when selected**.

## Evidence checked on 2026-11-15

- `https://github.com/BoardUI/boardui` describes free MIT catalog and `npx boardui@latest add --all`; Pro is separate and cannot be republished as source into a public repo.
- `https://transitions.dev/skill` describes an installable free skill and separate Pro entitlement.
- `https://bencho.dev/` shows interactive examples but source reuse must be verified before copying.
- `https://www.beautifului.dev/` is the screenshot source; verify actual code license instead of treating it as the unrelated `beautiful-ui.dev` Notchset kit.

**Completed test scope:** pinned BoardUI free catalog; Transitions.dev free agent skills; Beautiful UI public reference; Bencho public index only; seven frame-driven adapters; scene-aware advisory candidate generation; independent RU/TJ Codex TEST briefs; exact imported voice-cue opt-in illustrated-art binder; CI synthetic baseline/candidate frames and MP4. **Still open:** real paid/approved voice A/B, semantic 270×480 review, approved production/default rollout, and opt-in promotional UI bindings. No Pro code imported.\n\nThis document is implementation guidance, not a second canonical source of runtime settings. Any change to active rules/config must follow `hsk-tu-vous/AGENTS.md` rule-migration process, reconcile dependent copies and pass `npm run check:consistency`.
