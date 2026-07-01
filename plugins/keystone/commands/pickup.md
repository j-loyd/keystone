---
name: pickup
description: Resume interrupted work — read the newest resume artifact (a /handoff note, or a subagent-driven-development run-state file) and continue from where it stopped, without restarting. Use after a compaction, crash, or a deliberate /handoff or /pause. (Named pickup, not resume, to avoid colliding with the harness's built-in conversation /resume.)
argument-hint: "[optional: path to a handoff or run-state file; defaults to the newest of either]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
---

# Pickup — rehydrate interrupted work

`/pickup` is the single resume command. Two kinds of artifact can be waiting for it:

- A **handoff note** from `/handoff` (freeform, four-field — `docs/handoffs/<date>.md`), for
  ad-hoc or non-run work. This is the common case.
- A **run-state file** from a `subagent-driven-development` run (structured, per-task — see
  `../skills/subagent-driven-development/run-state-format.md`). Written continuously by the
  orchestrator and flushed by `/pause`.

It reads whichever applies and **continues, never restarts**.

## How

1. **Read the continuity index first.** `docs/handoffs/README.md` is the deterministic,
   recency-aware source of truth — its **Handoff notes** table (newest first) and its **Active
   run-state** section tell you what is open without guessing from the filesystem.

   ```bash
   test -f docs/handoffs/README.md && cat docs/handoffs/README.md
   ```

   If **$ARGUMENTS** names a specific file, use it and skip the search. If the index is
   **missing or stale**, fall back to directory globs (exclude the index itself):

   ```bash
   shopt -s globstar 2>/dev/null   # so docs/plans/**/ matches nested plan folders
   runstate=$(ls -t docs/plans/**/RUN-STATE.md docs/plans/*.run-state.md 2>/dev/null | head -1)
   handoff=$(ls -t docs/handoffs/[0-9]*.md 2>/dev/null | head -1)   # date-named notes, not README.md
   printf 'run-state: %s\nhandoff:   %s\n' "${runstate:-none}" "${handoff:-none}"
   ```

2. **Choose the resume target — recency + liveness, not mere existence.** A run-state wins
   **only if it is demonstrably live**: it has at least one task that is _unchecked_, or _checked
   with no summary block_ (the resume heuristic in
   `../skills/subagent-driven-development/run-state-format.md`). A **completed** run — every task
   checked with a summary — is _not_ a resume target even if its `RUN-STATE.md` still exists on
   disk; a finished run that lingers must never shadow a newer handoff. So:

   - **Live run-state exists** → resume the run (step 4).
   - **Otherwise** → resume the newest handoff row whose Status is **open** (step 3). Ignore rows
     already marked `resumed` or `superseded`.
   - **Neither** → nothing to resume; tell the user and stop.

   Confirm liveness by actually reading the run-state's task log before trusting it — do not
   pick it just because the file is present.

3. **If it's a handoff note** — resume the freeform work (the usual path):

   1. Read the note's four fields (Current state / Next action / Remaining work / Decisions &
      gotchas).
   2. Reconcile **Current state** against reality first — `git status -s` and the current branch
      — so you trust the note before acting on it. If they disagree, surface that, don't barrel
      ahead.
   3. Carry **Decisions & gotchas** forward so they're not relitigated.
   4. Start from the literal **Next action**, then work the **Remaining work** in order.
   5. Mark the consumed row **resumed** in `docs/handoffs/README.md` so a later `/pickup` does
      not re-consume it.

4. **If it's a run-state file** — rehydrate the structured run:

   1. Read the run-state file and the `Plan:` it names, to rebuild each task's handoff packet
      from recorded facts, not the lost chat.
   2. Find the resume point, verbatim from the format doc:

      > **The first task that is unchecked, or checked with no summary block, is where to resume.**

      A checked task with a summary block is done — skip it.

   3. Re-read **Locked decisions** and **Open blockers** so they carry forward, not relitigated.
   4. Hand back to `subagent-driven-development` at the resume-point task — dispatch the
      implementer with its packet and run the normal per-task loop forward. Do not re-run
      completed tasks.

Honor no-auto-commit — resuming continues the work, it does not commit unless the user asks.
