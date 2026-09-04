# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `subagent-driven-development` (recommended)
> to implement this plan phase-by-phase — a fresh subagent per slice, with review after each
> task at its risk tier. Each phase file
> uses checkbox (`- [ ]`) steps for tracking.

**Goal:** [one sentence describing what this builds]

**Architecture:** [2-3 sentences on the approach]

**Tech Stack:** [key technologies / libraries]

**Status:** Planned | In progress | Blocked | Done

---

## Phases

Execute in order unless a phase is marked parallel-safe. Each phase produces working,
testable software on its own.

| #   | Phase                 | File                                           | Status |
| --- | --------------------- | ---------------------------------------------- | ------ |
| 1   | [Foundation / schema] | [phase-1-foundation.md](phase-1-foundation.md) | [ ]    |
| 2   | [API / services]      | [phase-2-api.md](phase-2-api.md)               | [ ]    |
| 3   | [UI / integration]    | [phase-3-ui.md](phase-3-ui.md)                 | [ ]    |

> Each `phase-N-*.md` is a self-contained plan: `### Task N` sections with bite-sized
> `- [ ]` steps, exact file paths, and complete code per the `writing-plans` skill.

## Not yet specified

> In-scope questions this plan can see coming but can't yet phrase sharply enough to task.
> They stay here until earlier work makes them specifiable. Delete this section if empty —
> an empty heading is ceremony. (See `writing-plans` → Fog.)

- [The suspected question, and the area to revisit.]

## Out of scope

> Ruled out deliberately. Unlike the section above, these never graduate into tasks.
> One line plus the reason. Delete this section if empty.

- [Thing] — [why it's out.]

## Open questions / risks

- [Anything unresolved that could change the plan.]

## Revision log

- **YYYY-MM-DD** — initial plan.
- _[Add an entry when the plan materially changes — what changed and why. Git holds the diff.]_
