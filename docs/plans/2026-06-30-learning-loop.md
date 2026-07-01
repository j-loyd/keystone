# Spec: The Learning Loop — spec-driven development that compounds

**Status:** DRAFT for review · **Date:** 2026-06-30 · **Target:** keystone v0.2 (does NOT block the public push)

## Problem

keystone already has every ingredient of a system that learns — `/learn`, `/retro`,
`learnings.js`, run-state, `/handoff`, CONTEXT.md/ADRs, the SDD crew with QA + review gates.
But the **loop is open** in three places, so nothing compounds:

1. **Capture almost never happens.** Capture is 100% manual (`/learn`, `/retro`) and, in
   practice, run only inside the keystone repo itself (exactly one learnings file exists on the
   author's machine). The richest lesson source — what QA/review/investigation _caught_ — evaporates.
2. **Retrieval doesn't scale.** `learnings.js` surfaces **all** of a repo's lessons at every
   SessionStart. At 5 lessons that's helpful; at 50 it's context bloat that gets ignored; at 200
   it's actively harmful. There is no relevance matching.
3. **Lessons never feed forward.** A lesson learned in run N does not sharpen the _spec_ or
   _plan_ for run N+1, and process lessons ("how to work") can't graduate into keystone itself.
   Learning is passive reference, not active improvement.

A system only "gets better over time" when the loop is **closed** and retrieval is **by relevance**.

## The closed loop

```
/spec → brainstorm → writing-plans ──[reads lessons whose triggers match this spec's domains]
   │
   ▼
subagent-driven-development ──[each task packet to Mason carries the lessons matching that task]
   │
   ├─ Quinn (QA) / Riley (review) / Sage (security) gates ──[findings → lesson candidates]
   ▼
task done ──[orchestrator harvests a candidate; one-tap /learn — no silent auto-write]
   │
/handoff (promote "gotchas" → lesson)   /investigate (root cause → lesson)   /retro (sweep)
   │
   ▼
learnings/<repo>.md ──[typed · trigger-tagged · reinforced · retirable]
   │                                    │
   │ (repo-scoped, retrieved by trigger)│ type: process → PROMOTE into keystone
   ▼                                    ▼            (new instinct / skill line / template)
next SessionStart + next plan ──[retrieval by relevance] → smarter next cycle
```

## Design decisions (the opinionated part)

**D1 — Close the loop at reflection points, never with a daemon.** keystone already rejected
background auto-write (archived `phase-learning-skill-promotion.md`), and that stands. Capture
fires at the moments where reflection is _already happening_, each with a one-tap confirm:

- **SDD task completion** — the orchestrator harvests a candidate from what review/QA caught
  (a bug class, a plan deviation, a surprise). This is the highest-value, currently-wasted source.
- **`/investigate`** — a found root cause is almost always a durable lesson.
- **`/handoff`** — promote the "Decisions & gotchas" field into a durable lesson.
- **`/retro`** — the explicit sweep (exists; keep).
  Human stays in the loop everywhere; the system only ever _drafts_ and _offers_.

**D2 — Lessons are typed and trigger-tagged, retrieved by relevance (the scalability unlock).**
Replace the flat lessons file with structured records:

```
---
id:        <slug>
date:      <YYYY-MM-DD>
type:      gotcha | convention | pitfall | decision | process   # process = promotable
triggers:  [auth, migrations, "*.tsx", llm-prompt, pre-commit]   # when this applies
reinforced: <n>       # bumped each time the trigger recurs and the lesson holds
status:    active | superseded | promoted
---
<the lesson> — **Why:** … **How to apply:** …
```

Retrieval is **grep-by-trigger**, not "load everything": when about to work on X, surface only
the lessons whose `triggers` match X. SessionStart shows a **count + top-N by recency/reinforcement**,
not the whole store. This is what keeps 200 lessons useful — you only ever see the 2–3 that matter
to the current move. (Lean + cross-harness: plain files + `grep`, no embeddings, no daemon; semantic
retrieval is a documented future option, not the default.)

**D3 — Lessons feed FORWARD into specs and plans (the "gets better" half).**

- `writing-plans` gains a step: before finalizing, pull lessons matching the spec's domains and
  fold them into Risks/Approach. Plans start pre-loaded with "last time auth here, X bit us."
- SDD dispatch: each task's handoff packet includes the lessons matching that task's files/domain.
  (This also closes a known structural gap: `learnings.js` fires only at SessionStart, so banked
  repo lessons never reach Task-spawned crew subagents today. Folding them into the handoff packet
  is the cross-harness fix — no Claude-Code-only `SubagentStart` hook needed.)
- The plan-review / spec self-review gates check the plan against relevant past pitfalls.

**D4 — Two tiers: repo lessons vs. promotable process lessons.** A `type: process` lesson is
about _how to work_, not this repo — it's a candidate to **graduate into keystone itself** (an
INSTINCTS.md rule, a skill line, a template). `/retro` gets a formal `promote` action that opens a
keystone-shaped change (human-gated, PR-flavored). This is how the _tool_ improves, not just the repo.

**D5 — Reinforcement + retirement keep the store honest.** Recurrence that holds bumps
`reinforced` (rises in retrieval priority); a lesson that's contradicted or structurally fixed is
marked `superseded` (kept for audit, stops surfacing). `/retro` and review can retire lessons.
This defeats the failure mode of every "lessons learned" doc: rotting into stale noise.

## Cross-harness & safety posture

- **Baseline is prose in the skills** ("before finalizing a plan, read matching lessons"); the
  SessionStart/injection **hook is the Claude-Code convenience** with graceful degradation on
  Codex CLI. Plain files + grep everywhere. Consistent with keystone's stated cross-harness rule.
- **Human-gated end to end.** No silent writes, no auto-promotion. The system drafts; you approve.
- **Privacy:** lessons stay in `~/.claude/keystone/learnings/<repo-slug>.md`, outside the repo —
  client repos stay clean (unchanged from today).

## Phasing

- **Phase 1 (MVP — the loop closes):** structured/typed/trigger-tagged lesson schema; `/learn`
  writes it; `learnings.js` retrieves top-N + count (not all); SDD task-completion + `/handoff`
  offer one-tap capture. → capture actually happens; retrieval stops bloating.
- **Phase 2 (feed-forward):** `writing-plans` + SDD dispatch pull matching lessons; plan-review
  checks against pitfalls. → plans start smarter.
- **Phase 3 (promotion + hygiene):** `/retro` promote-to-keystone action; reinforcement/retirement.
  → the tool itself compounds.

## Non-goals

- No background daemon, no embeddings/vector DB (lean-first; revisit only if grep-by-tag proves
  insufficient at real scale).
- No auto-write without confirmation.
- Does not change where lessons live or the privacy posture.

## Open questions

1. Trigger vocabulary — free-form tags vs. a small controlled set (domains + globs)? (Lean toward
   free-form with a few conventional anchors.)
2. Should SDD task-completion capture be default-on or opt-in per run?
3. Promotion target for `process` lessons — INSTINCTS.md vs. a dedicated `docs/lessons/` in-repo?
