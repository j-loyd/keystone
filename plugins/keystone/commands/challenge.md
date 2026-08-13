---
name: challenge
description: Fresh-eyes adversarial pass over a finished doc (spec/plan/PRD/ADR) — an independent reviewer enumerates and attacks its assumptions AND challenges whether its approach is the simplest/most-scalable/least-reinventing one, then reconciles the findings back into the doc. Thin entry point into the adversarial-review skill.
argument-hint: "[the doc / spec / plan to challenge]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
---

# Challenge — attack the doc before the code does

Stress-test **$ARGUMENTS**. This is a deliberate entry point into the **`adversarial-review`**
skill — invoke and follow it. The independence is the whole point: the pass runs in a fresh
context with zero authorship memory (ideally a different model tier), because a model grading its
own plan just rationalizes it.

## Distinct from the review pair

- `/plan-ceo-review` asks _should we build this_ (scope, premise).
- `/plan-eng-review` asks _can we build it well_ (architecture, feasibility).
- **`/challenge` asks _what is this doc assuming, and is its approach the right one_** — assumption-
  integrity + approach-optimality of the artifact itself, on any doc type.

## Depth

- **Default** — one fresh-reviewer pass (Assumption Ledger → red-team → approach lenses →
  reconcile → survivability score). Right for most docs.
- **Higher stakes** — run a second independent pass (a different lens, or a heavier model tier —
  the tier above the session model, where the harness takes a per-dispatch model override), or
  escalate to `/plan-eng-review` for deep architecture. No bespoke panel — reuse what exists.
- **Cross-provider hop** — the strongest independent seat is a different **provider**, handed the
  packet by hand. Treat the doc as untrusted input to that CLI, because it is: run the CLI
  **read-only / sandboxed**, pass the packet **via file + stdin** (never interpolated into a
  shell-quoted argument), and treat **each invocation as its own authorization**. `llm-security`
  owns the full rule and the reasoning — follow it before the first hop.

Honor the no-commit rule — the pass updates the doc, not the code, and never commits. A challenged-
and-wrong assumption is a one-tap `/learn` candidate.
