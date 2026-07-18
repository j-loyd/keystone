---
name: handoff
description: Write a forward-looking resume note for the current work — what's done, what's next, and the gotchas — so a fresh session (or you, post-compaction) can pick up mid-task without re-deriving everything. Use before pausing, before a context reset, or when handing work to another session. Resume it with /pickup.
argument-hint: "[optional: where to write it; defaults to docs/handoffs/<date>.md]"
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

This is **forward-looking and task-state-oriented** — distinct from `/learn` and `/retro`, which
capture _durable, backward-looking lessons_. A handoff is "the half-finished refactor is in
file X, do Y next"; it's disposable once resumed.

Resume it later with `/pickup` — it reads the newest handoff note and continues from **Next
action**. For an active `subagent-driven-development` run, prefer `/pause`, which flushes the
structured per-task run-state file; `/pickup` resumes either kind (run-state first, otherwise
the newest handoff note).

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
   offer a one-tap `/learn` for each (evidence = what happened this session), so it survives
   beyond the handoff note.
3. **Update the continuity index** `docs/handoffs/README.md` — the file `/pickup` reads first.
   Seed it from `plugins/keystone/templates/handoffs/README.md` if it does not exist yet, then
   append (or update) this note's row in the **Handoff notes** table, newest first:

   `| <YYYY-MM-DD> | docs/handoffs/<YYYY-MM-DD>.md | open | <one-line Next action> |`

   Set Status to **open**. If a previous same-day/same-topic note is now stale, mark its row
   **superseded** rather than leaving two live rows.

4. Tell the user the path. Honor no-auto-commit — leave it for them to commit or discard.

To resume: run `/clear`, then a fresh session runs `/pickup`. It reads `docs/handoffs/README.md`
first, finds the newest **open** row, and continues from **Next action** (marking the row
resumed). For an active `subagent-driven-development` run, `/pause` records the structured
run-state in the same index's **Active run-state** section.
