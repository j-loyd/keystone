---
name: pause
description: Flush a run-state checkpoint on demand and stop — mark the in-flight task, write its partial summary and the literal next action, so a cold /pickup is unambiguous. Use to pause a subagent-driven-development run cleanly.
allowed-tools:
  - Read
  - Bash
  - Write
---

# Pause — flush a run-state checkpoint and stop

A `subagent-driven-development` run writes its run-state continuously, so "pause" is mostly
"stop." This command forces an immediate checkpoint so a later `/pickup` has zero ambiguity.

## How

1. Open the run's run-state file (see `../skills/subagent-driven-development/run-state-format.md`).
2. Mark the **in-flight task**: leave its checkbox per the resume heuristic (an interrupted task
   is checked with no summary block, or simply unchecked), write whatever partial summary you
   have, and record the **literal next action** so a cold resume starts immediately.
3. Update the `Updated:` timestamp.
4. **Reflect the run in the continuity index** `docs/handoffs/README.md` — the file `/pickup`
   reads first. Ensure the run has a row in the **Active run-state** section
   (`| <plan> | <run-state path> | paused |`), so a cold `/pickup` finds it without globbing.
   Leave it there until `finishing-a-development-branch` retires the run on completion.

Continue later with `/pickup`. If there's no active run-state file (you weren't mid-run), use
`/handoff` for a freeform resume note instead.
