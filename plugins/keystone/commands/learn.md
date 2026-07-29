---
name: learn
description: Capture a lesson learned into this repo's persistent learnings (auto-surfaced at the start of future sessions in this repo). Distills the current session or a stated lesson.
argument-hint: "[optional: the lesson; omit to distill from this session]"
allowed-tools:
  - Bash
  - Read
---

# Learn — bank a lesson for this repo

Capture a durable lesson so future sessions in this repo start already knowing it.
keystone stores learnings **outside** the repo (so the repo stays clean), keyed by its
git remote, and the `learnings.js` SessionStart hook re-surfaces the recent ones
automatically.

## What to capture

If **$ARGUMENTS** is given, that's the lesson. Otherwise, distill the current session:
what was non-obvious, what bit us, what we'd do differently, a gotcha about this
codebase/stack. **One atomic lesson per entry.** Skip the trivial — only bank things
worth knowing next time.

Tag each entry with the type of thing it is — this makes them scannable later and forces you
to be clear about what kind of knowledge it is:

- **Decision** — a choice we made and _why_ (so we don't relitigate it or silently reverse it).
- **Lesson** — something we'd do differently next time.
- **Pattern** — a reusable approach worth repeating.
- **Surprise** — a violated expectation / gotcha about this codebase, stack, or tooling.

**Evidence is required, and don't fabricate it.** Every entry names the real thing that taught
it — a file, an error, a commit, a decision. If you can't point to what happened, it's a guess,
not a learning — don't bank it.

## How to write it

1. Find this repo's learnings file:
   ```bash
   LF="$(node "$CLAUDE_PLUGIN_ROOT/hooks/learnings.js" --path)"
   [ -z "$LF" ] && { echo "Not in a git repo — learnings are per-repo. cd into one first."; exit 0; }
   mkdir -p "$(dirname "$LF")"
   ```
2. Append a dated entry in this format (keep the `## ` heading — the hook keys on it):

   ```markdown
   ## <YYYY-MM-DD> — [<Decision|Lesson|Pattern|Surprise>] <short title>

   <The lesson, imperative where it's a rule. 1–3 lines.>
   **Evidence:** <what happened that taught this — a file, error, or decision.>
   **Triggers:** <1–3 tags from the controlled list below, plus optional path globs>
   ```

   **Triggers — tag now, retrieve later.** Pick the closest anchors from this controlled
   vocabulary (don't invent new ones — free-form tags are what make later lookup silently
   miss): `auth` · `migrations` · `money` · `llm-prompt` · `api` · `db` · `caching` ·
   `testing` · `build-deploy` · `config` · `security` · `perf` · `ui` · `deps` · `process` —
   plus optional path globs (`*.tsx`, `migrations/*`). Today the tags help the orchestrator
   pick which lessons ride along in a task packet; they also make the planned typed-schema
   migration mechanical instead of a re-tagging slog.

   Write it with an Edit/append, or:

   ```bash
   cat >> "$LF" <<ENTRY

   ## <date> — [<type>] <title>
   <lesson>
   **Evidence:** <evidence>
   **Triggers:** <tags>
   ENTRY
   ```

3. Confirm to the user what was banked and where.

## Lessons about keystone itself → the meta-inbox

If the lesson is about the **tool, not this repo** — a skill that should have fired and
didn't, guidance that was wrong in practice, a gate that was noise, a capability keystone
lacks — don't bury it in this repo's file. Route it to the global meta-inbox instead (same
entry format; fixed path, agnostic to whatever repo you're in):

```bash
META="${KEYSTONE_LEARNINGS_DIR:-$HOME/.claude/keystone/learnings}/_keystone-meta.md"
```

**Write it generalized at capture** — no client, repo, or project names ("a high-volume
classification pipeline", not the client): the inbox feeds keystone's public repo, so
anonymization happens at the source, never as a later cleanup. Tag `process` plus the
domain anchor. Inside the keystone repo, `/retro` drains this inbox into proposed
skill/command improvements.

## Promote when it generalizes

If a lesson isn't repo-specific — it's a confirmed preference about how you should always
work — offer to promote it to the **global** `~/.claude/INSTINCTS.md` as an instinct (with
a confidence %) so it fires everywhere, not just this repo. (See the `INSTINCTS.md` format.)

Give the `%` a transparent source: add a trailing evidence line in the instinct body, e.g.
`_(0.7 — banked across 3 retros in this repo; user didn't correct it)_`, and let the number
reflect that count, not a guess. Confidence is a stated, evidence-backed heuristic the user can
hand-edit down to mute — **not** a stored or auto-decaying float.
