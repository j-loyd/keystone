---
name: retro
description: Engineering retrospective over a window of work — what happened, what was learned, what to change. Pulls from git history and past conversations.
argument-hint: "[time window or project, e.g. 'this week' or a repo path]"
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Retro — turn the last stretch of work into learnings

Run a retrospective over **$ARGUMENTS** (default: the last week in the current repo).

## Gather context

- **Git timeline** — commits, merged PRs, churned files over the window
  (`git log --since`, `git shortlog`, `--stat`). What actually shipped?
- **Co-change pairs** — which files keep changing _together_ (a coupling signal the Evolve
  step below uses). Count unordered file pairs per commit, e.g.:
  ```bash
  git log --since=2w --diff-filter=ACMR --pretty=format:%H --name-only \
    | awk 'NF==1 && length($0)==40 {if(n>1)for(i=1;i<=n;i++)for(j=i+1;j<=n;j++)print f[i]"|"f[j]; n=0; next}
           NF{f[++n]=$0} END{if(n>1)for(i=1;i<=n;i++)for(j=i+1;j<=n;j++)print f[i]"|"f[j]}' \
    | sort | uniq -c | sort -rn | head
  ```
  Emits `<count> fileA|fileB` rows — real co-change evidence, not a flat per-file frequency.
- **Past conversations** — use the `episodic-memory` / `search-conversations` tooling to
  recover decisions, blockers, and dead-ends from the working sessions. (No gbrain —
  keystone uses the episodic-memory plugin + `MEMORY.md`.)

## Run the retro

Answer, concretely and with evidence:

1. **What got done** vs. what was planned. Where did scope drift, and why?
2. **What worked** — practices/decisions worth repeating.
3. **What hurt** — friction, rework, surprises, near-misses. Root cause, not symptom.
4. **What we learned** — non-obvious facts about the system or the domain.
5. **What changes next** — 1–3 specific, actionable adjustments (process, code, or docs).

## Capture

Offer to persist durable learnings, routed by scope. Type each one as a **Decision**,
**Lesson**, **Pattern**, or **Surprise** (the `/learn` categories), each with real evidence —
the retro questions above map onto these directly (worked → Pattern, hurt/learned → Lesson/Surprise, scope drift → Decision):

- A lesson specific to **this repo** → bank it via the `/learn` command (per-repo
  learnings store, auto-surfaced in future sessions here). Capture the strongest 1–3.
- A reusable lesson or confirmed preference that applies **everywhere** → propose a
  global `~/.claude/INSTINCTS.md` entry (with a confidence %) and/or a `MEMORY.md` note.
- A consequential, hard-to-reverse **decision** → propose an ADR (`docs/adr/`).

### Evolve — propose a skill from what recurred

When a lesson has recurred enough to be worth codifying, propose a **new skill** (never write
one automatically — hand a brief to the `skill-creator` skill and stop):

1. **Read what's accumulated.** Cluster the repo's recent learnings:
   `node "$CLAUDE_PLUGIN_ROOT/hooks/learnings.js" --cluster` (returns `[{key, entries}]`). Also
   skim the global `## [N%] when …` instinct blocks.
2. **Join to the git evidence.** For each cluster, find the co-change pairs (from Gather context)
   whose path or commit subject matches the cluster's terms, and read off `N` = the pair's
   co-change count. This join — cluster (learnings/instincts) **and** pair-count (git) in one pass
   — is the signal; nothing is stored.
3. **Pitch only when both fire.** Only when a cluster has ≥2 source learnings **and** a matched
   file-pair with `N ≥ 2`, draft a one-paragraph pitch: _"You've learned [X] across [dates] and
   [files A, B] changed together in [N] commits — propose a skill to capture this?"_ Cite the
   co-change count and the source learnings by date. Route acceptance to `skill-creator`.
4. **Scope from the evidence.** Broad co-change across the repo → lean toward a global instinct;
   narrow/domain-specific → a repo skill.

The Evolve step **proposes only** — it writes no skill, no config, and never commits.

Keep it blameless and specific. End with the shortlist of changes to make.
