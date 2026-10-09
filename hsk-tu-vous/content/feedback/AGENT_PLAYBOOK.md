# HSK AI Content — feedback agent playbook

This runbook is for ChatGPT using its already-connected **Zernio and GitHub** tools. It is not a background daemon. It requires no additional API key and collects no HSK AI application user data.

## Analysis run (proposed cadence: Monday / Wednesday / Friday, Asia/Shanghai)

1. Fetch the latest GitHub branch SHA and read the **current** `hsk-tu-vous/AGENTS.md`, `AI_RULES.md`, `content/calendar.json`, `content/hook-lab.json` and `content/cta-lab.json`.
2. Query connected Zernio Instagram/TikTok accounts and collect actual post metrics with platform post ID, publication timestamp, synchronization time, and metric units. Do not present a platform with no returned analytics as a zero-performing platform.
3. Add a provenance-stamped snapshot in `content/feedback/observations/` following the README and schema. For cumulative Zernio totals use `window: "lifetime"`, not fabricated exact 24h/7d windows.
4. Match source `episodeId` / hook format / HSK level / effect style only if the published media and existing episode source prove the mapping. Unverified fields remain `null`.
5. Inspect the read-only `content:feedback` and `content:buffer` reports. For a new cycle create a dated feedback report containing separate OBSERVATION, HYPOTHESIS, EXPERIMENT and DECISION sections, plus source links and uncertainty. Compare only within matched platform, observed window, level and duration band.
6. If the calendar buffer falls below target, propose scenarios that maintain existing cadence, correct Chinese examples, and current episode schema. Under current `AI_RULES.md`, do not silently add a new calendar date without owner approval.
7. Only modify *unapproved future* script drafts when permitted by canonical production rules. Do not change canonical CTA wording, provider voice, approved/published snapshots, publication, or core renderer.
8. Commit through a branch/PR and run repository tests. Summarize metrics, caveats, exact changed files, SHA and current merge status. Never claim unattended execution unless the scheduled task actually confirmed it.

## Before each new video

Fetch the latest `main` SHA and current episode, Hook Lab, CTA Lab and voice/visual rules immediately before preparing working media. Capture the SHA used in production metadata. If relevant source files change before render/review, invalidate the old working preview and refresh the appropriate dependencies.

## Non-goals

No customer-install attribution, no separate social API token, no user data extraction, no causal claim from views alone, no automatic winner declaration, no autonomous publishing. Existing owner approval of the exact final preview remains mandatory.
