---
name: wrap
description: End a work session by saving what would otherwise be lost — one question, a candidate list, and the user picks what to keep (repo lessons, decisions, corrections, drops, open items). Use when the user is calling it a day, at a natural stopping point after a fix or feature lands, or to note what is worth remembering.
argument-hint: "[optional: a specific lesson or focus]"
---

# Wrap — what from this session is worth keeping?

`/handoff` is for stopping mid-task. `/wrap` is for when the session's work is done. If
**$ARGUMENTS** names a lesson or focus, start there.

## 1. Ask one question, then write the candidates down before asking the user anything

"What from this session would be lost when it ends or compacts, and is worth keeping?" Skip
anything a file, commit, ticket, or memory already holds, and anything that only mattered to
this chat. Write the candidate list to a scratch file first, so a compaction mid-question
loses nothing. Delete it once the picks are saved.

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/learnings.js" ] || R="${PLUGIN_ROOT}"
LF="$(node "$R/hooks/learnings.js" --path)"   # this repo's lessons file; empty outside a git repo
S="${LF%.md}.wrap-scratch.md"; [ -n "$LF" ] || S="${TMPDIR:-/tmp}/keystone-wrap-scratch.md"
META="${KEYSTONE_LEARNINGS_DIR:-$HOME/.claude/keystone/learnings}/_keystone-meta.md"
mkdir -p "$(dirname "$S")" "$(dirname "$META")"
echo "LF=$LF"; echo "S=$S"; echo "META=$META"
```

Use the printed paths from here on; shell variables don't carry over to the next command.
These files live outside the repo, so an active `/guard` freeze denies Edit/Write to them.
Write them with a shell append instead (freeze fences Edit/Write, not Bash), using a quoted
heredoc so nothing in the text expands:

```bash
cat >> "<path printed above>" <<'ENTRY'

<the text to save>
ENTRY
```

Rewriting an existing entry under a freeze needs the freeze lifted (`/guard off`); say so
instead of working around it.

## 2. Kinds of candidate, and where each one goes

- **Unfinished work.** Don't record task state here. Tell the user there's unfinished work
  and to run `/handoff`.
- **Decisions and their reasons** go to the spec, an ADR (`docs/adr/`), or the project notes.
- **Hard-won facts**, things you learned by testing or investigating, go to the `LF` file,
  which lives outside the repo (outside a git repo there is none; use memory). The
  SessionStart hook re-surfaces entries only in this shape:

  ```markdown
  ## <YYYY-MM-DD> — [<Decision|Lesson|Pattern|Surprise>] <short title>
  <the fact, imperative where it's a rule; 1–3 lines>
  **Evidence:** <the command, file, error, or commit that showed it>
  **Triggers:** <1–3 of: auth · migrations · money · llm-prompt · api · db · caching · testing · build-deploy · config · security · perf · ui · deps · process, plus optional path globs>
  ```

  Facts that apply across projects go to memory instead. Facts about **keystone itself** go to the `META` file: a skill that
  should have fired, guidance that was wrong, a gate that was just noise. Write those
  generalized, with no client, repo, or project names, because that inbox feeds a public repo.
- **Corrections** to a stale note: quote the old text, give the new text, and say what proved
  it (a command or file, with the date). Mark it `unchecked` if nothing in this session backs
  it.
- **Drops**: notes that are now wrong or obsolete. Propose deleting them, not just rewording.
- **Unanswered questions** that came up this session and were never resolved.
- **External pointers**: URLs, ticket IDs, PRs.
- **Rules**: propose one only if the agent would decide differently without being told. If a
  type, test, lint rule, hook, or permission could catch the mistake, propose that check
  instead of prose; a check is paid for once, and a written rule is re-judged on every diff.
  Propose rules as CLAUDE.md/AGENTS.md edits, or as a global `~/.claude/INSTINCTS.md` entry
  with an evidence-backed confidence and a retirement condition ("retire once lint rule X
  exists"). Never write a rule without asking.

Every candidate names the real thing that taught it. If you can't point to what happened, it's
a guess, so drop it.

## 3. Verify any claim about state

Check every "done / pushed / merged" with git first (`git status`, `git log @{u}..`), and
record it with an identifier and date: "pushed a1b2c3, checked 2026-11-07", never a bare "done".

## 4. The user picks

Show one multi-select list of the candidates, each with its destination. Save only what the
user picks, and update an existing note rather than adding a duplicate. Never save secrets:
write `<REDACTED>` in place of any token, key, password, or credentialed URL, in the scratch
file too. Then delete the scratch file and say what was saved where.

If nothing qualifies, say so in one line and stop.
