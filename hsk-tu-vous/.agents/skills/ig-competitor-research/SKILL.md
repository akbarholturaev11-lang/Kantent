---
name: ig-competitor-research
description: Read-only Instagram competitor Reel benchmarking with provenance, uncertainty and no scraping.
---

# Instagram competitor research — HSK AI

**Scope:** a separately requested competitive editorial review. This skill does **not** run as a required daily video stage and is not an Instagram login, crawler or platform analytics API.

## Sources
Use only publicly available, manually supplied or otherwise authorized accessible Reel links, captions, dates and metrics. Keep source URLs, collection date, metric names and publication date. Do not scrape accounts, request passwords, infer nonpublic retention/reach or automate following, messaging or comments.

## Comparison method
1. Build a compact sample of relevant language-learning Reels. Record each account's **comparable** historical median from a clearly defined period when actual observations are available.
2. Compute `viewMultiple = observedViews / sameAccountComparableMedianViews` only for positive confirmed median values, same metric definition, and defensible collection windows; otherwise label `not-comparable`. Never divide by unobserved medians or estimate them from follower count.
3. Describe observable hook and shot types, verified teaching value and structural differences. Do **not** copy third-party scripts, branded assets, choreography or account identity into HSK AI production.
4. Distinguish publicly visible lifetime views from account-specific 24h/7d measurements. A higher multiple is descriptive, not evidence a hook caused an uplift; small samples and niche differences limit inference.
5. Output candidate **hypotheses** only. If the owner wants a HSK pilot, route a separate task into `ig-reel-planning`, actual Hook Lab, `creative-formats.json` and the approved production flow. Never write competitor data into HSK AI's own `content/feedback/observations`, Hook Lab performance ledger or future calendar automatically.

## Output
Source list, observed time window and metric definitions; an auditable comparison table with `not-comparable` where necessary; up to three **testable editorial hypotheses** and explicit evidence gaps. No auto-collection, source rewriting, CTA modification or publishing.

## Provenance
Selected the outlier-vs-own-account-median **idea** from [instagram-agent-skill/ig-viral](https://github.com/Jakeschincariol/instagram-agent-skill/tree/main/skills/ig-viral) (MIT). No upstream scraping workflow or `swipe.py` tool is installed.
