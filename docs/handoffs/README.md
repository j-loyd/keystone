# Handoffs — continuity index

The **repo-scoped continuity index**: the one file `/pickup` reads _first_ to decide what to
resume. It is a plain Markdown file any harness (Claude Code, Codex CLI, …) can read and write —
file-based continuity is the cross-harness baseline; hooks are Claude-Code-only enforcement teeth
that degrade gracefully. Template: `plugins/keystone/templates/handoffs/README.md`.

- **`/handoff`** writes a four-field resume note to `docs/handoffs/<YYYY-MM-DD>.md` **and**
  appends (or updates) that note's row in the **Handoff notes** table below.
- **`/pickup`** reads THIS file first (deterministic, recency + liveness aware) to pick a resume
  target, falling back to a directory glob (`docs/handoffs/[0-9]*.md`) only if this index is missing or
  stale. It also lists the open tickets (see `/pickup`). It marks a row **resumed** once it consumes it.
- The blessed flow is **`/handoff` → `/clear` → `/pickup`** — deliberate, _not_
  compaction-driven. Compaction is the harness's lossy fallback; a handoff is your aimed note.

Newest first. **Status**: `open` (waiting to be resumed) · `resumed` (a `/pickup` consumed it) ·
`superseded` (a newer note replaced it).

## Handoff notes

| Date       | File | Status | Hook |
| ---------- | ---- | ------ | ---- |
| _none yet_ |      |        |      |

---

`MEMORY.md` (your `~/.claude/…/MEMORY.md`) is a **personal, cross-project** index — _not_ this
repo's task-state. For "what was I doing in THIS repo," this index is the source of truth.
