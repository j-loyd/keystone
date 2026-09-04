# Run-state format

A **run-state file** is the durable record of one `subagent-driven-development` execution. The
orchestrator appends to it after each task so the top loop carries only a one-line stub per
finished task (not every verbose result), and a `/pickup` can pick the run back up after a
compaction or crash. It is a plain human-readable log — not a status machine, not parsed as
control flow.

## Where it lives — one file per run

Co-located with the plan it executes, so it travels with the plan in git and is disposable once
the run completes:

- **Folder plan** (`docs/plans/<plan-folder>/`) → `docs/plans/<plan-folder>/RUN-STATE.md`
- **Single-file plan** (`docs/plans/<plan>.md`) → `docs/plans/<plan>.run-state.md`

Exactly **one file** per run. Per-task summaries are _sections in this one file_ — never a
second state file or a tree of per-task files.

While the run is live it is also listed in the repo's continuity index,
`docs/handoffs/README.md`, under **Active run-state** (`Plan | Run-state path | Status`) — the
file `/pickup` reads first. The run-state file is the record; that index row is just the pointer
to it.

## Shape

```markdown
# Run-state — <plan name>

- **Plan:** docs/plans/<...>.md
- **Branch:** <branch>
- **Updated:** <YYYY-MM-DD HH:MM>

## Locked decisions

- <orchestrator-override call, with the why> — so a resumed run doesn't relitigate it.

## Open blockers

- <anything unresolved that a resume must know about> (or "none")

## Task log

- [x] Task 1: <title>
  - Status: DONE | DONE_WITH_CONCERNS
  - Gates: Riley CONCERNS(2)→accepted · Quinn — · Sage —
  - Files: path/a, path/b
  - Finding: <the one durable fact worth carrying forward>
  - Concern: <any, or "none">
- [ ] Task 2: <title>
- [ ] Task 3: <title>
```

Each completed task carries a **≤6-line summary block** under its checked box — this is the
implementer's Report Format (Status / files / finding / concern) trimmed to the durable bits,
plus the orchestrator-written `Gates:` line (the implementer has terminated by then and never
writes to this file).
**Tasks are the tracking unit even when several were dispatched as one slice** (see `SKILL.md`,
"Why fresh context"): the slice's worker returns per-task evidence and the orchestrator writes
one block per task. Slicing does not change the resume heuristic below.

The **Gates** line records each gate that ran and its verdict (`—` for one the tier didn't
run). It costs a line and buys the only evidence anyone will ever have about whether a gate is
worth its dispatch: `finishing-a-development-branch` tallies it at the end of the run, and a
gate that fires repeatedly and catches nothing is a gate arguing for its own deletion. keystone's
own rule is that a gate which has never failed anything is theater — this is how you find out
which ones those are instead of guessing.
An unchecked task has no block yet. A task with a checked box but **no summary block** is the
one that was interrupted mid-flight.

The **Locked decisions** list mirrors writing-plans' discuss/lock step: decisions that would
otherwise become mid-run overrides live here during execution, so a resumed run inherits a
decision, not a question.

## Resume heuristic — state it verbatim everywhere

> **The first task that is unchecked, or checked with no summary block, is where to resume.**

`/pickup`, `/pause`, and the orchestrator all read this same line. Quote it; don't re-invent it.

## Liveness & retirement — a finished run must not shadow a newer handoff

A run-state is **live** only while the resume heuristic finds an unfinished task. The moment
every task is checked _with_ a summary block, the run is **complete** and the file has served its
purpose. `/pickup` treats liveness — not mere file existence — as the gate: a completed
run-state that lingers on disk is ignored, never picked over a newer `/handoff` note.

On completion, `finishing-a-development-branch` **retires** the run-state: it archives or deletes
the file (git keeps the history) and clears the run's row from the **Active run-state** section of
`docs/handoffs/README.md`. This is what guarantees a done run can never silently shadow every
future handoff — retire it, don't leave it as a tripwire.

## What it is NOT

- **Not a status machine.** No phase/status enum any tool transitions; nothing parses it as
  control flow. It's a log the orchestrator appends to with the Write tool, the way `/handoff`
  writes its note.
- **Not a multi-file tree.** One file. Not state + context + research + N×summary files.
- **Not a hook or daemon.** No background writer; the orchestrator writes it inline.
- **Not the freeform handoff.** For a freeform, non-run resume note, use `/handoff`. The
  run-state is its structured, per-task, continuously-updated cousin.

A Heavy run may also have a sibling **run-manifest** that indexes the run's artifacts; it is
**additive** and does not change the resume contract — `/pickup` still reads only the task log.

## Cross-harness portability

The run-state is a plain markdown file on disk. Any harness — Claude Code, Codex CLI, or another
— reads and writes it with its ordinary file tools. Nothing here depends on a harness-only
primitive; `/pickup` and `/pause` are command prose that any harness with file access can
execute. Tools named anywhere in this doc are instances, not requirements.
