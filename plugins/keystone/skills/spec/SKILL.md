---
name: spec
description: The single entry point for building a feature — interview if fuzzy, write the spec with an integrate-first section and an over-engineering gut check, break it into tickets, then hand off to /implement. Use when the user runs /spec with an idea, a problem, or a path to a draft.
disable-model-invocation: true
---

# Spec — idea to tickets

Drive one feature from idea to implementable tickets: **$ARGUMENTS**

Five steps. **Pause for the user's OK between steps**; each one ends with a short summary and a
question like "Ready to write the spec?" Never run ahead into the next step on silence.

## 0. Where the spec lives

Read `docs/agents/issue-tracker.md` if it exists (written by `/setup`). If it doesn't, use the
local default and mention `/setup` once, not again:

- **Draft** at `.scratch/<feature-slug>/spec.md`, always, whatever the tracker. It is the
  compaction-proof record of the interview and the spec.
- **Publish** to the configured tracker at the end of step 2 (local tracker: the draft already is
  the published spec).

Read `GLOSSARY.md` and the ADRs in the area you're touching, and use the glossary's terms
throughout. If only a legacy `CONTEXT.md` exists, treat it as the glossary and offer
`git mv CONTEXT.md GLOSSARY.md`.

## 1. Understand it (grill if fuzzy)

If the request is already crisp, say so and skip to step 2.

**If the project is already underway**, do a blind-spot pass before asking anything:

1. Read the README, `docs/`, ADRs, `GLOSSARY.md`, and recent history (`git log --oneline -30`).
2. **Collision pass**: list decisions that contradict each other (a doc says X, an ADR or the code
   says not-X, two ADRs disagree).
3. **Untouched areas**: list what a project of this shape normally decides but this one never did
   (auth model, data retention, error/empty states, deploy target, cost ceiling, ...).
4. Open the interview with those two lists.

Then load the `grilling` skill (and `domain-modeling` when terms are moving) and interview until
the frontier is empty. **Write each answer into the draft under `## Interview log` as it
arrives**, not at the end, so a compaction mid-interview loses nothing.

## 2. Write the spec

First sketch the **seams** you'll test the feature at: prefer existing seams, use the highest one
possible, and aim for the fewest (ideally one). Check them with the user.

Then write the spec into the draft, distilling the interview log into the sections below. Run the
checks in [checks.md](checks.md) while filling in the integrate section and the security
questions.

<spec-template>

## Problem Statement

The problem the user is facing, from the user's perspective.

## Solution

The solution, from the user's perspective.

## User Stories

A long, numbered list covering every aspect of the feature, each as: "As an <actor>, I want a
<feature>, so that <benefit>."

## Integrate and be creative where possible; build where necessary

One entry per capability the feature needs:

- **Integrate**: the package or managed service that already solves it, with its legitimacy and
  live-repo check result (see checks.md). Solved problems (auth, payments, email, search, file
  uploads, queues, rate limiting, crypto, dates/time zones, money, parsing) land here by default.
- **Combine**: how existing modules, packages, or platform features compose to cover it before
  anything new is written.
- **Build**: only the part that's genuinely ours or that nothing fits, with one line on why.

## Implementation Decisions

Modules built or modified and their interfaces, architectural decisions, schema changes, API
contracts, specific interactions, and the agreed seams. No file paths or code snippets (they go
stale), except a prototype snippet that encodes a decision more precisely than prose, trimmed to
the decision-rich part.

## Security Questions

The questions from checks.md that apply to this feature, each with its answer. Omit the ones that
don't apply; don't pad.

## Testing Decisions

What makes a good test here (external behavior, not implementation details), which modules are
tested at which seam, and prior art in the codebase.

## Over-engineering Gut Check

(Filled in step 3.)

## Out of Scope

What this spec deliberately doesn't do.

## Further Notes

Anything else.

</spec-template>

Publish it to the tracker if it isn't local, applying the `ready-for-agent` label (or its
configured equivalent).

## 3. Over-engineering gut check

Before any tickets, answer each question in one line under `## Over-engineering Gut Check`, and
**cut whatever fails** from the spec (say what you cut):

1. Is every piece needed for _this_ problem, now? Anything speculative goes.
2. **Deletion test** on each new module or abstraction: delete it in your head. Does complexity
   vanish (cut it) or reappear across callers (keep it)?
3. Is this the fewest seams possible, ideally one?
4. Can an existing package, service, or module do this instead?
5. What's the simplest version that works? Is the spec bigger than that? If so, why?
6. Bigger than a few tickets? Offer `/challenge` on the spec for a fresh-context attack on its
   assumptions before building.

## 4. Break it into tickets

Read [the to-tickets skill](../to-tickets/SKILL.md) and follow it on this spec (or the user can
run `/to-tickets` themselves). The ticket count is itself a gut check: if it feels like too many,
go back to step 3 before publishing them.

## 5. Hand off

Summarize: the spec's location, the tickets and their blocking edges, and the unblocked frontier.
Offer `/implement` to build them.
