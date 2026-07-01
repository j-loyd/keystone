---
name: adversarial-review
description: Use to stress-test a finished doc — a spec, plan, PRD, or ADR — before building from it. A reviewer with zero authorship memory (ideally a different model) enumerates and attacks the doc's assumptions AND challenges whether its chosen approach is the simplest/most-scalable/least-reinventing one, then reconciles the findings back into the doc. The independent second opinion self-review structurally can't give.
---

# Adversarial Review

**Announce at start:** "I'm using the adversarial-review skill to challenge this doc's assumptions and approach."

Take a fresh, hostile pass over a finished doc whose only job is to find what it **assumes** and
whether the **approach it chose** is right — before any code encodes the mistake. Two axes, both
required:

- **Assumption-integrity** — is what the doc takes as true actually true? (moves 1–2)
- **Approach-optimality** — even if the assumptions hold, is this the best/simplest/most-scalable
  way, or does it reinvent something we have? (move 2b)

A planner optimizes for **completeness** (the steps are all there); this optimizes for
**survivability** (assumptions are visible, bounded, and either validated or consciously accepted;
the approach was chosen against real alternatives). A complete plan still dies on one hidden
assumption or one needlessly-complex approach.

## Why this can't be a self-review

A model grading its own plan mostly rationalizes it — intrinsic self-correction without an
external signal is unreliable, and same-provider review shares the same blind spots and approval
bias. The author is the worst person to find their own assumptions. The value is **entirely in
the independence**, not in re-reading harder.

## The independence rule (non-negotiable)

Run the pass in a **fresh context with zero authorship memory** — dispatch a subagent via this
harness's subagent-dispatch primitive (Claude Code's Task tool, or the equivalent elsewhere) that
never saw the doc get written. It receives **only the doc + the codebase**, never this session's
reasoning, so it isn't anchored by it. Where the harness allows, run the reviewer on a
**different model tier** than the author to decorrelate the biases. If no subagent primitive
exists, the fallback is to re-open the doc cold in a new session and run the same moves — always
do at least that much.

> The true cross-model version (paste a self-contained packet into a different provider — the
> Claude→Codex→Claude hop by hand) is a documented **fast-follow**; the fresh subagent is the
> always-available baseline.

## Opening frame (set before attacking)

1. **Steelman first.** Restate the doc's plan in its **strongest** form in 2–3 sentences — the
   version its author would endorse. You attack _that_, never a strawman. If you can't steelman
   it, the doc is too vague to review; that's finding #1.
2. **Pre-mortem.** Assume it shipped and **failed badly six months out**. Write the most likely
   cause _first_, before the line-by-line pass — prospective hindsight surfaces risks a forward
   read misses. Every later move is hunting evidence for or against that failure story.

## The three moves

### 1. Build the Assumption Ledger

Enumerate every load-bearing thing the doc **takes as true** — explicit _and_ implicit (unstated
defaults, "obviously" facts, the happy-path shape of an external dependency). One row each:

| #   | Assumption (what the doc treats as true) | Type | Status | If wrong → | How to validate |
| --- | ---------------------------------------- | ---- | ------ | ---------- | --------------- |

- **Type:** `explicit` (written down) · `implicit` (never stated, but the plan depends on it).
- **Status:** `visible` · `bounded` · `validated` · `accepted` · **`UNEXAMINED`**.
- **If wrong →** the blast radius in one phrase (this ranks the row).

The output is not the table — it's the **`UNEXAMINED` × high-blast-radius** rows. An implicit
assumption with a large blast radius that nobody has looked at is the finding.

### 2. Red-team the assumptions (the Architect checklist)

Force each surviving assumption to become explicit where plans actually break:

- **Interfaces** — concrete, not vague ("returns the user" → which shape, which nulls?).
- **Invariants** — the constraints the system must always hold; are they stated?
- **Coupling** — which modules move together; what breaks if one changes?
- **Failure modes** — each external dependency slow/down/wrong: named and handled, or assumed-happy?
- **Acceptance criteria** — observable and fixed, not elastic.

Stress them against the **real codebase**, don't theorize — this is what `grill-with-docs` does
(challenge the plan against `CONTEXT.md`/ADRs/running code). Compose it; don't restate it. When
the code contradicts the doc, that contradiction _is_ a finding.

### 2b. Challenge the approach, not just the assumptions

Even a fully-sound set of assumptions can wrap a needlessly-complex or already-solved approach.
Ask all four — each routes to the keystone skill that owns the judgment, so answer with that
skill's rigor, don't hand-wave:

- **Is this the simplest way?** Apply the **deletion test** — what's the smaller-or-no-build
  version, and what actually breaks without the extra? (`auditing-for-overengineering` /
  `simplifying-code`.) Deferring difficulty is not simplifying it.
- **Have we already built something like this?** Name the existing module, pattern, or library
  this reinvents — reuse beats rebuild, and a hand-rolled version in a deceptive-complexity domain
  (crypto/auth/date/money/parsing) is a liability. (`writing-plans` anti-reinvention +
  `/review`'s reuse lens.)
- **Is this the most scalable way?** Where does it break at 10×/100× the data, calls, or team —
  and is any of that a one-way-door structural choice that must be right _now_?
  (`improve-codebase-architecture`.)
- **Is there a materially better alternative?** State one genuinely different approach and why the
  doc's is better — or isn't. One is enough; if none exists, say so. (From `/plan-eng-review`.)

A "yes, this is simplest/best" with no alternative named is not an answer — it's an unexamined
assumption, back to the ledger.

### 3. Reconcile

- **Accepted findings → update the doc, not the code.** A gap the implementer would otherwise fill
  with a silent guess belongs back in the spec. Rewrite the affected section; promote each fixed
  `UNEXAMINED` row to `bounded`/`validated`/`accepted` in the ledger.
- **Genuine disagreement → an explicit tension,** never silently resolved: record the reviewer's
  objection, your call, and why — the same convention the eng/ceo reviews use. The next reader
  inherits the debate, not just the winner.

When the reviewer is a **dispatched, edit-restricted subagent**, it can't rewrite the doc — it
**emits each edit as a proposal** (section + change), and the orchestrator reconciles and applies
them (verifying, not rubber-stamping — a fresh reviewer can be confidently wrong).

## Survivability score

Score the doc 1–5 (5 = strong) so runs are comparable and there's a bar — findings, not vibes:

| Dimension                                                                    | Score | Why |
| ---------------------------------------------------------------------------- | ----- | --- |
| Assumptions visible — implicit load-bearing assumptions surfaced, not buried | _/5   |     |
| Approach justified — a real alternative was weighed, simplest/reuse checked  | _/5   |     |
| Failure-handled — each external dependency's slow/down/wrong path is named   | _/5   |     |
| Reversibility — one-way-door choices are flagged and spent rigor accordingly | _/5   |     |

Any dimension at 1–2 blocks a plain "sound" verdict — say so explicitly rather than averaging it
away.

## Stopping (value-based, not exhaustive)

Only surface a finding that points to a **concrete failure mode likely in _this_ codebase, this
release, under these constraints** — plausible is not the same as important. Stop when the
criticism starts **repeating**: a looping critique is the done signal, not a reason to dig deeper.

## Depth: one pass by default; escalate by re-running, not new machinery

- **Default — one pass.** A single fresh reviewer runs the moves above. Cheap; right for most
  docs. This is the simplest thing that works — don't reach past it without cause.
- **Higher stakes — add independent seats, reuse what exists.** For a HIGH-stakes doc
  (auth/money/data-deletion, a one-way-door migration, a new external dependency, or a
  survivability dimension already at 1–2), don't build a bespoke panel — run the pass **again as a
  second independent seat** (a different lens, or a heavier model tier). For a bounded
  replan-until-converged loop, hand off to `writing-plans/plan-convergence-loop.md` (owned by
  writing-plans — don't re-implement it here). This skill **is** the independent-pass mechanism
  that `/plan-eng-review` and `/plan-ceo-review` escalate into, so there's no deeper independence
  tier to reach for: depth here means more seats, not more machinery.

Cost scales with seats — be deliberate (that's `cost-aware-llm-pipeline`'s discipline applied to
review): a routine doc earns the one same-tier pass; a HIGH-stakes one earns a heavier second seat.

## Capture

An assumption that got **challenged and turned out wrong** is the highest-signal lesson there is.
Offer a one-tap `/learn` for each — a `type: gotcha`, trigger-tagged to the domain it bit — so the
_next_ doc's ledger starts pre-loaded with "last time we assumed X here, it broke." No silent
writes — the pass drafts, you approve. (When the Learning Loop lands this becomes one of its
planned capture points — `docs/plans/2026-06-30-learning-loop.md`, still a draft; today it's a
plain `/learn`.)

## Output

End with: the ranked `UNEXAMINED`/high-blast findings, the survivability score, the updated
ledger, the doc edits made (or proposed), any explicit tensions, and a one-line verdict —
**sound / patch-and-proceed / rethink** — plus the next step (`writing-plans` to re-plan,
`/plan-eng-review` for architecture, or back to scoping).
