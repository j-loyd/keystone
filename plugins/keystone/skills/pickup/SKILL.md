---
name: pickup
description: Resume interrupted work — pick up where you left off by reading the newest open /handoff note and the open tickets, reconciling them with git, and continuing without restarting. Use after the context is compacted, after a crash, or after a deliberate /handoff. (Named pickup, not resume, to avoid colliding with the harness's built-in conversation /resume.)
argument-hint: "[optional: path to a handoff note or a feature's tickets; defaults to the newest open note]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash(git status)
---

# Pickup — rehydrate interrupted work

`/pickup` is the single resume command. Two things can be waiting for it:

- A **handoff note** from `/handoff` (four fields, `docs/handoffs/<date>.md`): the state of
  whatever you were doing and the literal next action.
- **Open tickets** from `/spec` → `/to-tickets` → `/implement`: the task graph itself is the
  progress record. Local tickets live at `.scratch/<feature>/issues/`; a remote tracker is
  configured in `docs/agents/issue-tracker.md`.

It reads both and **continues, never restarts**.

## How

1. **Find what's open.** If **$ARGUMENTS** names a file or feature, use it and skip the search.

   ```bash
   test -f docs/handoffs/README.md && cat docs/handoffs/README.md        # continuity index
   ls -t docs/handoffs/[0-9]*.md 2>/dev/null | head -1                   # fallback: newest note
   grep -L '^\*\*Status:\*\* done' .scratch/*/issues/*.md 2>/dev/null     # local tickets not done
   test -f docs/agents/issue-tracker.md && cat docs/agents/issue-tracker.md
   ```

   The index's **Handoff notes** table (newest first) is the source of truth for notes; ignore
   rows marked `resumed` or `superseded`. For a remote tracker, list open issues labelled
   `ready-for-agent` (or the configured equivalent) as its doc describes, skipping the spec issue
   itself and any ticket that already carries a `merged into <branch>` comment (`/implement`
   counts those as done and closes them at the end).

2. **Pick the target.**
   - **An open handoff note** → resume it (step 3). If it names a feature with open tickets, the
     note's Next action wins; the tickets are the Remaining work.
   - **No open note, but open tickets** → summarize the feature, which tickets are done, and the
     current frontier (tickets not done whose blockers are all done), then tell the user to run
     `/implement`, which resumes from the frontier.
   - **Neither** → nothing to resume; say so and stop.

3. **Resume a handoff note.**
   1. Read its four fields (Current state / Next action / Remaining work / Decisions & gotchas).
   2. Reconcile **Current state** against reality first (`git status -s`, the current branch,
      `git log --oneline -5`) so you trust the note before acting on it. If they disagree, surface
      that; don't barrel ahead.
   3. Carry **Decisions & gotchas** forward so they're not relitigated.
   4. Start from the literal **Next action**, then work the **Remaining work** in order.
   5. Mark the consumed row **resumed** in `docs/handoffs/README.md` so a later `/pickup` doesn't
      re-consume it.

Resuming continues the work; it doesn't push or merge anything the user hasn't asked for.
