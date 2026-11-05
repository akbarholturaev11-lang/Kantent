# Kantent — repository entry point for AI agents

Start with [START_HERE.md](START_HERE.md) for a short, current project map. **The active project is `hsk-tu-vous/`**, not the older standalone projects in `videos/`.

Before editing any code or generating a video:
1. Read [hsk-tu-vous/AGENTS.md](hsk-tu-vous/AGENTS.md) for source ownership and the required rule-change process.
2. Read [hsk-tu-vous/AI_RULES.md](hsk-tu-vous/AI_RULES.md), then [hsk-tu-vous/PROJECT_MEMORY.md](hsk-tu-vous/PROJECT_MEMORY.md).
3. Read task-specific [hsk-tu-vous/content/WORKFLOW.md](hsk-tu-vous/content/WORKFLOW.md), [hsk-tu-vous/content/EDITING_SPEC.md](hsk-tu-vous/content/EDITING_SPEC.md), or [hsk-tu-vous/content/PROMO_WORKFLOW.md](hsk-tu-vous/content/PROMO_WORKFLOW.md).
4. For unresolved engineering work, use [hsk-tu-vous/docs/audits/CURRENT_TASKS.md](hsk-tu-vous/docs/audits/CURRENT_TASKS.md). The full evidence log is [the V1–V7 audit](hsk-tu-vous/docs/audits/KANTENT_FULL_TECHNICAL_AUDIT_V5_2026-11-05.md); its historic filename is retained.
5. Inspect **current `main` and current code** before acting. Tasks listed as OPEN are *not implemented*. A green structural CI check does not certify natural speech, correct visual meaning, or a finished video.

**Critical boundaries:** Do not regenerate approved audio; do not invent timestamps, fake product screenshots, or claim unverified QA. New visual frames must match the *meaning* and timing of narration, and voice quality on the first take is a priority. Diagnose failures, fix their root causes, and rerun relevant tests instead of unbounded retries. Do not publish VIDEO without explicit approval of the exact final preview. Static photo-news has a separate owner-authorized policy; consult the canonical sources before any publishing action.

Repository-root instructions only route you to the existing canonical files; **do not copy mutable settings here**. If code and prose conflict, report that conflict and check the canonical config/runtime plus the owner's latest recorded decisions.
