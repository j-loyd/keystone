---
name: plan-eng-review
description: Engineering-manager review of a plan's architecture — feasibility, risk, alternatives, and honest effort. Use before committing to an implementation approach.
argument-hint: "[plan, design, or approach to review]"
allowed-tools:
  - Read
  - Grep
  - Glob
---

# Eng Review — can we build this well?

Review the technical approach in **$ARGUMENTS** as an engineering manager who has to
live with the result. Pairs with `/plan-ceo-review` (scope/ambition) and the
`writing-plans` skill (the actual plan).

> For a deeper assessment you can dispatch the **`planner`** agent (via this harness's
> subagent-dispatch primitive — Claude Code's Task tool, or the equivalent elsewhere) to
> trace the approach against the codebase in its own context, then review what it returns.

## Do

1. **Trace the approach against the real codebase.** Read the files it touches. Does it
   fit existing patterns, or fight them? Name the functions/modules it should reuse.
2. **Evaluate the architecture.**
   - Data model and state transitions — normalized vs. blob; auditability; permissions.
   - Boundaries — where do trust, validation, and side effects live?
   - Failure modes — what happens when each external dependency is slow/down/wrong?
3. **Identify the top risks** (1–3), ranked. For each: likelihood, blast radius, and a
   mitigation or a cheaper way to de-risk early.
4. **Offer an alternative** if a materially simpler or safer approach exists. One is enough.
5. **Score effort honestly** — rough size with stated assumptions; call out the parts
   most likely to balloon.

## Lenses (apply the ones that fit — don't recite all six)

Each catches a specific failure mode. Reach for the ones the plan is most exposed to:

- **Pre-mortem** — assume it shipped and failed badly. What's the most likely cause? Plan against that now.
- **MECE** — are the pieces mutually exclusive and collectively exhaustive? Look for gaps (unhandled case) and overlaps (two tasks owning the same thing).
- **Constraint analysis** — what's the _real_ binding constraint (a dependency, a rate limit, a data shape)? Optimizing anything else is wasted motion.
- **Reversibility test** — is this a one-way door (hard to undo: schema migration, public API, data deletion) or two-way? Spend rigor in proportion; don't over-deliberate reversible calls.
- **Curse of knowledge** — what does the implementer (or future reader) not know that you do? Name the implicit context the plan assumes.
- **Base-rate neglect** — what usually happens with work like this? If migrations like this normally take 3× and break X, weight that over inside-view optimism.

## Scored rubric

Score each 1–5 (5 = strong) — findings, not vibes:

| Dimension                                                              | Score | Why |
| ---------------------------------------------------------------------- | ----- | --- |
| Architecture fit — reuses existing patterns vs. fights them            | _/5   |     |
| Risk coverage — top risks named with real (not hand-wavy) mitigations  | _/5   |     |
| Testability — the failure modes named in step 2 are actually checkable | _/5   |     |
| Effort confidence — assumptions stated, ballooning parts named         | _/5   |     |
| Lean process — every gate, artifact, and step the plan adds earns its pain; no ceremony | _/5   |     |

Any dimension at 1–2 blocks a plain "proceed" verdict — say so explicitly rather than
averaging it away.

## Adversarial pass (before you present the verdict)

State the strongest case _against_ your own recommendation — what would make the
alternative, or "rethink," the right call — in 2–3 sentences, then say whether it moved
you. For HIGH-stakes plans (touches auth/money/data-deletion, a one-way-door migration, or
a new external dependency), escalate beyond self-critique to an **independent adversarial
pass**: invoke the `adversarial-review` skill (`/challenge`) — keystone's single home for
the fresh-context, zero-authorship-memory adversarial read — carrying your engineering
lens's question, "what's the strongest reason this approach is wrong." Don't hand-roll a
parallel `planner` dispatch here; route through that skill so there's one owner of the
independence mechanism. Scale by keystone's cost tiers: routine plans get the same-tier
self-critique, HIGH-stakes plans earn the heavier independent pass. If neither the skill
nor subagent dispatch is available in this harness, the self-critique is the fallback —
always do at least that much. A genuine disagreement
between passes goes into the write-up as an explicit tension, not a silently resolved
footnote.

## Constraints

- Prefer normalized, per-concern tables over monolithic JSON blobs, matching whatever
  stack the codebase already uses rather than assuming one.
- For any LLM/agent work, apply the `cost-aware-llm-pipeline` skill (cheap→mid→high→top
  tier routing, budgets, small-shot testing) rather than reaching for the biggest model.

End with a clear verdict: **proceed / proceed-with-changes / rethink**, the scored
rubric, and the next step.
