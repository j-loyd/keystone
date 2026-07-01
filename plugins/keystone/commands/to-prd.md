---
name: to-prd
description: Turn the current discussion or plan into a formal product requirements document. Produces a structured PRD doc for review.
argument-hint: "[feature/initiative to spec]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
---

# To PRD — formalize the requirements

Transform **$ARGUMENTS** (or the current discussion) into a clear product requirements
document. This is the heavier, formal sibling of `writing-plans` — use it when the work
needs a shared, reviewable spec rather than an implementation plan.

## Structure

1. **Problem & context** — who has this problem, what they do today, why now.
2. **Goals / non-goals** — what success means; what's explicitly out of scope.
3. **Users & scenarios** — the concrete flows this serves.
4. **Requirements** — functional (numbered, testable) and non-functional (performance,
   security, accessibility, cost).
5. **Open questions & risks** — the unresolved decisions and the riskiest assumptions. Before
   listing, run each section through its type-matched lenses (`brainstorming`/`section-lenses.md`):
   risk → pre-mortem + adversarial pass; data/non-functional → MECE + constraint analysis.
6. **Success metrics** — how we'll know it worked, observably.

## Process

- Pull from the codebase and any `CONTEXT.md`/ADRs so the language matches the domain.
- Write the PRD as a markdown doc (default location `docs/prd/<slug>.md` unless the user
  says otherwise) and link it from the relevant index.
- Keep requirements testable and scannable; flag every assumption explicitly.
- Offer to follow with `/to-issues` to break the PRD into a Backlog.
