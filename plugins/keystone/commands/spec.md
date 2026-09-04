---
name: spec
description: Turn a feature/requirements into a written plan saved to docs/plans/, then hand off to fresh-context subagents to execute it task-by-task with review between tasks. The explicit entry point to the spec → plan-file → isolated-execution workflow.
argument-hint: "[the feature / problem to spec]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
---

# Spec — write it down, then execute in fresh context

Drive the full plan-then-execute workflow for: **$ARGUMENTS**

This is the explicit front door to keystone's favorite loop: **author a spec → save it as a
plan file → execute it in fresh-context slices** (no context pollution), reviewing
between tasks. It chains existing skills — follow them, don't reinvent.

## 0. Declare the effort level

At the front door, propose the run's effort level — **Light / Medium / Heavy** — from the
observed signals (subsystems touched, safety surface, reversibility, and task count if known):
take the **lowest band the signals allow**, name the signal that set it, and let the user
confirm or override in a word. Medium is the fallback only when nothing is known yet. Carry the
level into `writing-plans`, which composes the `spec → middle → execute` pipeline accordingly. See [`../skills/writing-plans/plan-levels.md`](../skills/writing-plans/plan-levels.md).

## 1. Sharpen the spec first (if it's fuzzy)

If the request is ambiguous or big, interrogate it before planning — use `grill-with-docs`
(stress-test against the codebase + CONTEXT.md/ADRs) or `/office-hours` (heavy scoping). A
plan built on an unresolved spec just encodes the confusion. Skip if the spec is already crisp.
If the spec is mostly crisp but a section or two feels soft, skip the full session and run the
per-section lens pass from the `brainstorming` skill's `section-lenses.md` inline instead.

## 2. Write the plan

Invoke the **`writing-plans`** skill. It produces a task-by-task plan with `- [ ]` checkbox
steps, saved under **`docs/plans/`** (adaptive layout): a single
`YYYY-MM-DD-<feature>.md` for small/medium work, or a `YYYY-MM-DD-<feature>/` **folder**
with `plan.md` + `phase-N-*.md` when the work has ~3+ phases or spans subsystems. Then
re-read the plan against the spec with fresh eyes before handing off. For a plan you want
genuinely stress-tested (not just re-read by its own author), run **`/challenge`** on it — an
independent fresh-context pass that enumerates and attacks the plan's assumptions before any
code is written. Cheaper than discovering the wrong assumption mid-execution.

For a large or high-stakes spec, pass **`--review-convergence`** to run the plan through the
bounded multi-lens review loop (`writing-plans/plan-convergence-loop.md`) before handoff — it
replans until no HIGH concern remains across the goal / buildability / security lenses, capped at
~3 cycles. Default off; the one-shot fresh-eyes re-read above is enough for small plans.

## 3. Hand off to execution (the part you like)

Offer the two execution modes from `writing-plans`'s handoff:

- **Subagent-driven (recommended)** — invoke **`subagent-driven-development`**: a **fresh
  subagent per slice of the plan, in an isolated context** that never inherits this planning session's
  history; review after each task at its Risk tier — you verify at LOW, one Riley pass at MED, Quinn plus spec-then-quality (plus Sage on a safety surface) at HIGH. This is the
  "execute in a new context window" handoff. Your context stays free for coordination.
- **Separate-session / inline** — subagent-driven-development's `no-subagent-fallback.md` for batch execution with review
  checkpoints when subagents aren't available.

For risky or parallel work, pair with `using-git-worktrees` so execution is isolated from the
current workspace.

## Notes

- The plan file is the source of truth and the hand-off artifact — the executing subagent
  reads it, not this conversation.
- Honor the no-commit rule: planning and execution prepare work; commits happen only when you
  explicitly say so.
- For a multi-issue plan, `/to-issues` can turn the plan into Linear Backlog tickets instead.
