---
name: handoff
description: Write a forward-looking resume note for the current work — what's done, what's next, and the gotchas — so a fresh session can pick up mid-task without re-deriving everything. Use when the user runs /handoff before pausing, a context reset, or handing work to another session. Resume it with /pickup.
argument-hint: "[optional: where to write it; defaults to docs/handoffs/<date>.md]"
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
  - Write
---

# Handoff — leave a resume note

The harness auto-summarizes context when it grows long, but that summary is opaque and lossy
on _intent_. When you're about to pause, hit a context reset, or hand work to a fresh session,
write a deliberate, aimable resume note so the next session continues mid-task instead of
reconstructing state from scratch.

**The blessed flow is `/handoff` → `/clear` → `/pickup`** — deliberate, not compaction-driven.
You aim a note, wipe the context on purpose, then rehydrate cleanly. Compaction is only the
harness's lossy fallback for when you _didn't_ hand off.

This is **forward-looking and task-state-oriented** — distinct from `/wrap`, which captures
_durable, backward-looking lessons_ when a session's work is done. A handoff is "the
half-finished refactor is in file X, do Y next"; it's disposable once resumed.

Resume it later with `/pickup` — it reads the newest open handoff note (and any open tickets)
and continues from **Next action**.

## What to capture

Keep it to four fields — tight, concrete, file-and-line specific:

1. **Current state** — what's done and where things stand right now (branch, what's committed vs
   uncommitted, what's working/broken).
2. **Next action** — the literal next step to take, specific enough to start immediately.
3. **Remaining work** — the rest, briefly, in order.
4. **Decisions & gotchas** — choices already made (with the _why_, so they're not relitigated)
   and traps discovered this session.

Write only what you actually know — don't pad. If a field is empty, say so.

## How

1. Default target: `docs/handoffs/<YYYY-MM-DD>.md` (use **$ARGUMENTS** if a path is given; or
   just print the note to the chat if the user prefers not to write a file).
   ```bash
   mkdir -p docs/handoffs
   ```
2. Write the four sections. Lead with the branch and `git status -s` reality so the next
   session trusts it. Any **gotcha** you just wrote that will outlive this task is a lesson —
   mention that `/wrap` can bank it once the work is done, so it survives beyond the handoff
   note.
3. **Update the continuity index** `docs/handoffs/README.md` — the file `/pickup` reads first.
   If it does not exist yet, seed it from the plugin template:
   `R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/templates/handoffs/README.md" ] || R="${PLUGIN_ROOT}"; mkdir -p docs/handoffs && cp "$R/templates/handoffs/README.md" docs/handoffs/README.md`. Then
   append (or update) this note's row in the **Handoff notes** table, newest first:

   `| <YYYY-MM-DD> | docs/handoffs/<YYYY-MM-DD>.md | open | <one-line Next action> |`

   Set Status to **open**. If a previous same-day/same-topic note is now stale, mark its row
   **superseded** rather than leaving two live rows.

4. **Leave nothing running or stranded.** Before walking away, check for and report (don't
   silently fix): tagged debug probes the investigation added but never removed (grep the run's
   marker), background processes or dev servers you started, worktrees you created, and work
   that exists only on this machine (uncommitted changes, or a branch with no upstream). List
   each in **Current state** so the next session isn't surprised by it.
5. Tell the user the path. Honor no-auto-commit — leave it for them to commit or discard.

To resume: run `/clear`, then a fresh session runs `/pickup`. It reads `docs/handoffs/README.md`
first, finds the newest **open** row, and continues from **Next action** (marking the row
resumed).
