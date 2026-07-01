---
name: research-notes
description: Persist external/technical research as a durable, committed docs/research/ note (chosen stack + rationale, don't-hand-roll decisions, pitfalls, sources) so it survives the session and a fresh-context agent can reuse it.
argument-hint: "[topic; omit to use the current research session's topic]"
allowed-tools:
  - Bash
  - Read
  - Write
---

# Research notes — persist what you learned

Research is expensive to redo. When a session has produced external/technical research worth
keeping — a stack/library evaluation, an integration gotcha hunt, a "how is this normally
solved" investigation — capture it as a durable repo doc instead of letting it evaporate into
the transcript.

This complements, not replaces, the `deep-research` skill (which _does_ the investigation) and
`find-docs` (which pulls live API docs). This command persists the _conclusions_.

## What to write

Topic: **$ARGUMENTS** (or the topic of the research just done).

Write to `docs/research/<topic-slug>.md` using the structure in
`keystone/templates/research/topic.md`:

- **Summary** + **Recommendation** — the bottom line and the one-line why; name the chosen
  stack/library + version and the alternatives you rejected.
- **Don't hand-roll** — the problem → use-instead table (what looks tempting to build but
  shouldn't be).
- **Pitfalls** — concrete gotchas, perf traps, and "looks-done-but-isn't" cases.
- **Sources** — real, cited URLs with access date. **Don't fabricate sources or findings** —
  if a claim isn't backed by something you actually read, drop it or mark it unverified.

Keep it tight and factual; this is a reference, not an essay.

## How

1. Pick a slug from the topic (kebab-case). Target: `docs/research/<slug>.md`.
2. If the file exists, extend it (new findings, bump the date) rather than clobbering.
3. Write the file; confirm the path to the user. Honor the no-auto-commit rule — leave it
   staged-or-unstaged for the user to commit.

## When to reach for it

- After a `deep-research` run whose conclusions you'll act on later.
- After choosing a library/approach you don't want the next session to relitigate.
- After discovering integration pitfalls worth warning future-you about.
