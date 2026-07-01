---
name: zoom-out
description: Step back from tunnel vision — orient in unfamiliar code, or pause mid-task to check a change's blast radius before going further. Use when you don't recognize the code you're in, a diff keeps growing past its original scope, a change reaches a widely-shared module/config, or before a hard-to-undo step. Reports only — complements /audit (subtractive) and improve-codebase-architecture (additive) without duplicating either.
---

# Zoom Out

Two related situations, one move: **go up a level of abstraction before you take the next
step.** Use whichever mode fits.

## Mode 1 — Orient (you don't know this area)

You're in code you don't recognize. Before reading line-by-line, get the map:

1. Check `docs/codebase/` if `onboard-codebase` has run — `STRUCTURE.md` for where things live,
   `ARCHITECTURE.md` for how the pieces connect. Verify the map's `Built at: <sha>` against
   `HEAD`; if it's stale, treat it as a lead, not an answer.
2. Find the module's callers and dependencies (`grep`, or the Explore agent) — not just its own
   body. "What calls this" and "what does this call" is the map; the implementation is detail.
3. Name what you found using the project's domain vocabulary — `CONTEXT.md` if one exists,
   otherwise whatever terms the code itself already uses consistently.
4. Report the map: the module's place in the flow, its callers, its dependencies, and — if
   `docs/codebase/CONCERNS.md` flags anything nearby — the known risk. Then get back to the task.

## Mode 2 — Checkpoint (pause before going further)

Mid-task, before continuing, reach for this when any of these fire:

- **Scope creep.** The diff now touches files you didn't set out to touch — check whether
  that's a legitimate consequence of the change or you've wandered.
- **High fan-in.** The next edit is to something with many callers/consumers (`grep` the
  symbol, route, table, or config key to count) — a small change here is a big change
  everywhere it's used.
- **Cross-cutting surface.** The change reaches something outside the code itself — a
  migration, a public API contract, a config default, a cron/queue consumer, a doc that claims
  something the change is about to make false.
- **Hard to undo.** The next step is a deletion, a migration, a public interface change, or
  anything else expensive to reverse once shipped.

When one fires, stop and produce a short **blast-radius note** before continuing:

- **Touches** — every file/module/consumer the change reaches, one line each.
- **Also true elsewhere** — the same pattern, bug, or assumption, if it exists anywhere else in
  the codebase (the `variant-analysis` instinct, applied before you finish, not just at review
  time).
- **Not touching, on purpose** — anything that looked in-scope but you're deliberately leaving
  alone, so it reads as a decision, not an oversight.
- **Verdict** — proceed as planned, narrow the change, or flag it for the user before going
  further.

This is a **look, don't rewrite** move — it reports, it doesn't refactor. If the note surfaces
real architectural friction, hand off to `improve-codebase-architecture`; if it surfaces bloat
or an abstraction that doesn't earn its keep, hand off to `auditing-for-overengineering`
(`/audit`). If the note is clean, it _is_ the deliverable — a paragraph, not a report — and you
continue.

## Boundaries — what this isn't

- **Not `/review`.** `/review`'s blast-radius check is one section of a full pre-merge safety
  pass on a finished diff. This is a cheaper, earlier, mid-task habit meant to catch tunnel
  vision while the diff is still growing, not to replace the gate at the end.
- **Not `verification-before-completion`.** That skill proves a completion claim with evidence
  right before you say "done." This is about noticing scope before you get there.
- **Not a redesign.** If the honest answer is "this needs restructuring," that's
  `improve-codebase-architecture`'s job — this skill hands off; it doesn't do the deepening
  itself.
