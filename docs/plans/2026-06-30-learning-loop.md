# Spec: The Learning Loop — spec-driven development that compounds

**Status:** Phase 1 SHIPPED 2026-07-18 (in the staged v0.3.0) · Phases 2–3 open · **Date:** 2026-06-30 · **Target:** keystone v0.3 (v0.2 shipped `/challenge`)

**Phase 1 as shipped:** SDD task-done capture (fatigue-gated, one-tap `/learn` draft) +
matching-lessons slot in the SDD handoff packet and implementer template; `/investigate`
banks confirmed root causes; `/handoff` offers capture for outliving gotchas; `/learn`
entries gain a plain-text `**Triggers:**` line from a controlled vocabulary. Spec claims
re-verified against live `learnings.js` before shipping (MAX cap, `## `-parser — unchanged).

## Problem

keystone already has every ingredient of a system that learns — `/learn`, `/retro`,
`learnings.js`, run-state, `/handoff`, CONTEXT.md/ADRs, the SDD crew with QA + review gates.
But the **loop is open** in three places, so nothing compounds:

1. **Capture almost never happens.** Capture is 100% manual (`/learn`, `/retro`) and, in
   practice, run only inside the keystone repo itself (exactly one learnings file exists on the
   author's machine). The richest lesson source — what QA/review/investigation _caught_ — evaporates.
2. **Retrieval is by recency, not relevance.** `learnings.js` already caps what it injects — the
   **8 most-recent** entries (`KEYSTONE_LEARNINGS_MAX`, default 8, clamped 1–50), so volume is not
   the problem. The problem is that the 8 _newest_ lessons are rarely the 8 that _match the current
   task_, and a still-relevant older lesson silently ages out. There is no relevance matching.
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
background auto-write (archived `phase-learning-skill-promotion.md`), and that stands. But note the
honest constraint: three of the four points below are **human-invoked commands** — and "the human
doesn't invoke them" is exactly _why_ capture is ≈0 today. So the load-bearing point is the one that
fires **automatically**:

- **SDD task completion (load-bearing).** The orchestrator harvests a candidate from what
  review/QA/security actually **caught** — a bug class, a plan deviation, a surprise. This is the
  one genuinely-automatic source, so Phase 1 stands or falls on it. **Fatigue guard:** offer a
  one-tap capture **only when a gate _caught_ something** (not on clean passes), so the prompt stays
  high-signal and never trains a reflexive "no."
- **`/investigate` · `/handoff` · `/retro` (also-capture-when-invoked).** A found root cause, a
  handoff "gotcha," or an explicit sweep are all good lessons _when the human runs the command_ —
  but they don't fix the never-invoked problem, so they supplement the automatic point; they don't
  carry the loop.

Human stays in the loop everywhere; the system only ever _drafts_ and _offers_. Honest scope: this
closes the loop **inside keystone-command-driven work** — the richest, most-wasted source — not
across every ad-hoc session.

**D2 — Lessons are typed and trigger-tagged, retrieved by relevance (the relevance unlock).**
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

Retrieval is **grep-by-trigger layered on top of today's recency top-N — strictly additive, never a
replacement.** When about to work on X, surface the lessons whose `triggers` match X; **on a
no-match, fall back to the recency top-N** so retrieval is never _worse_ than today (a mis-tagged
lesson still shows by recency — it's never silently dropped to zero). To make matching reliable,
`triggers` come from a **small controlled vocabulary** — domain anchors (`auth`, `migrations`,
`money`, `llm-prompt`…) + path globs — used at **both** write and read time; free-form tags are what
make grep silently miss (an `auth`-tagged lesson, a task the model frames as `login`). SessionStart
still shows a **count + top-N** (it has no task context to grep against yet — see Phasing). (Lean +
cross-harness: plain files + `grep`, no embeddings, no daemon; semantic retrieval is a future option.)

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

_Re-sequenced after the 2026-07-01 adversarial review (see Revision log): lead with the actual open
seam (capture); defer the deferred-payoff machinery (the schema)._

- **Phase 1 (close the loop where it's actually open — capture):** SDD task-completion offers
  one-tap capture (with the D1 fatigue guard) **on the current `## `-headed format**, and folds the
  matching lessons into the SDD task packet (D3's highest-value half). → the loop closes and banked
  lessons reach the executor. No schema rewrite yet; nothing to migrate.
- **Phase 2 (relevance + feed-forward):** introduce the typed/trigger-tagged schema **with a
  migration** — rewrite the `split(/^(?=## )/m)` parser in `learnings.js` (which `recentEntries`,
  `clusterEntries`, `/learn`'s appender, and `/retro --cluster` all depend on) and one-time convert
  the existing file, or read dual-format; then add grep-by-trigger with the recency fallback (D2)
  and pull matching lessons in `writing-plans` + plan-review. Do this once volume (~30+ lessons)
  justifies the migration. → retrieval gets relevant; plans start smarter.
- **Phase 3 (promotion + hygiene):** `/retro` promote-to-keystone action; reinforcement/retirement
  (D4/D5). You can't reinforce or retire lessons you haven't captured — so this stays last. → the
  tool itself compounds.

**Reversibility flag:** the lesson **schema** is the one accumulating-data, one-way-ish door here —
every captured lesson is written in it, so migration cost grows with volume. That's the crux of the
tension recorded below.

## Non-goals

- No background daemon, no embeddings/vector DB (lean-first; revisit only if grep-by-tag proves
  insufficient at real scale).
- No auto-write without confirmation.
- Does not change where lessons live or the privacy posture.

## Open questions

1. ~~Trigger vocabulary — free-form vs. controlled?~~ **Resolved (2026-07-01):** a small **controlled
   set** (domain anchors + globs), same list at write and read time — free-form is what makes grep
   silently miss. (D2.)
2. ~~SDD capture default-on or opt-in?~~ **Resolved (2026-07-01):** default-on but **fatigue-gated** —
   offer only when a QA/review/security gate actually caught something, never on a clean pass. (D1.)
3. Promotion target for `process` lessons — INSTINCTS.md vs. a dedicated `docs/lessons/` in-repo?
   (Still open.)

## Revision log

**2026-07-01 — adversarial review** (dogfooded `/challenge` → the `adversarial-review` skill, a
fresh-context reviewer grounded against the real `learnings.js`). Survivability **2/2/2/3** →
verdict **patch-and-proceed with a mandatory re-sequence**. Applied:

- **F1 (factual, verified against code):** Problem #2's claim that `learnings.js` "surfaces **all**
  lessons… at 200 actively harmful" was **false** — the hook already caps at the 8 most-recent
  (`MAX`, learnings.js:36/220). Corrected; the real gap is **recency ≠ relevance**, which shrinks
  D2's job from "fix bloat" to "add relevance."
- **F2:** D2 now mandates a **controlled trigger vocabulary** + a **recency fallback on no-match**,
  so retrieval is strictly additive over today (never silently zero). Resolves Open Q1.
- **F3:** D1 now names **SDD-task-done as the load-bearing (automatic) capture point** with a
  fatigue guard; the three command-invoked points are demoted to supplements. Resolves Open Q2.
- **F4 (re-sequence):** Phase 1 now leads with **capture + packet-injection on the current format**;
  the typed schema moves to Phase 2 (its retrieval payoff is deferred anyway — SessionStart has no
  task context to grep against).
- **F5:** added a **migration** requirement (the new `---` frontmatter breaks the current
  `## `-parser) and a **reversibility flag** on the schema.

**Explicit tension — RESOLVED 2026-07-18:** took F4's side (defer the schema) **with a hedge
that dissolves most of the counter-argument's cost**: `/learn` writes a plain-text
`**Triggers:**` line (controlled vocabulary + path globs) inside the current `## ` format from
day one. The `## `-parser is untouched (no migration now), but every lesson is born tagged — so
Phase 2's typed-schema migration becomes a mechanical reformat of already-tagged entries, not a
re-tag-50-lessons slog. The counter's real fear (retroactive tagging at volume) no longer
applies; what remains deferred is only the frontmatter *shape*, which is cheap to convert.
