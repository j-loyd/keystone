---
name: plan-ceo-review
description: CEO-mode review of a plan or feature — scope, ambition, and whether it's the right thing to build at all. Challenges premises before execution.
argument-hint: "[plan, feature, or PR to review]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - WebSearch
---

# CEO Review — is this the right thing to build?

Review **$ARGUMENTS** from the seat of someone accountable for the product's direction,
not its implementation. The eng review (`/plan-eng-review`) handles "can we build it
well" — this handles "should we build it, and is it ambitious/scoped right."

## Pick a scope mode and say which one

- **EXPANSION** — this is under-ambitious; the real opportunity is bigger.
- **SELECTIVE** — roughly right; sharpen what's in vs out.
- **HOLD** — not yet; a premise is unvalidated or a dependency isn't ready.
- **REDUCTION** — over-scoped; cut to the smallest thing that proves the value.

## Do

1. **Restate the bet** in one sentence: who benefits, and what changes for them.
2. **Challenge the premises.** What has to be true for this to matter? Is any of it
   assumed rather than known? Name the riskiest one.
3. **Pressure-test scope** against the mode you picked. Be specific about what to add
   or cut and why.
4. **Opportunity cost.** What does building this instead of the alternative cost?
5. **Recommendation.** A clear call (build / cut / hold / expand) with the reasoning,
   and the single most important thing to get right.

## Lenses (apply the ones that fit — don't recite all four)

- **Pre-mortem** — assume it shipped and flopped six months out. What's the likeliest
  cause: wrong bet, wrong scope, or wrong sequencing? Plan against that now.
- **10x / platonic-ideal test** (EXPANSION mode) — what would the no-constraints version
  of this look like? Is the proposal a scoped-down shadow of a bigger opportunity, or
  genuinely the right size already?
- **Base-rate neglect** — what usually happens to bets shaped like this one (scope creep,
  adoption lag, a dependency slipping)? Weight that over inside-view optimism.
- **Reversibility test** — is the scope call itself a one-way door (locks the roadmap,
  spends a relationship, ships a public commitment) or a two-way one? Spend rigor in
  proportion — don't over-deliberate a call you can reverse next week.

## Scored rubric

Score each 1–5 (5 = strong) so the verdict is comparable across reviews, not just a vibe:

| Dimension                                                                        | Score | Why |
| -------------------------------------------------------------------------------- | ----- | --- |
| Ambition — does the mode match the real opportunity?                             | _/5   |     |
| Scope fit — the in/out list actually matches the chosen mode                     | _/5   |     |
| Premise strength — validated vs. merely assumed                                  | _/5   |     |
| Opportunity-cost clarity — the alternative was named and weighed, not hand-waved | _/5   |     |

Any dimension at 1–2 is a blocking finding for the recommendation, not a footnote — name
it explicitly in the verdict.

## Adversarial pass (before you present the verdict)

Don't let your own first read be the only one. State the strongest argument _against_
your recommendation — the steelman for the opposite call — in 2–3 sentences, then say
whether it moved you. For HIGH-stakes bets (locks the roadmap, spends real budget or
relationship capital, hard to reverse), escalate beyond self-critique: dispatch a
fresh-context instance of whatever subagent-dispatch primitive this harness offers
(Claude Code's Task tool, or the equivalent on another harness) with only the plan and
the question "what's wrong with this recommendation" — no visibility into your reasoning,
so it isn't anchored by it. Route the escalation through keystone's cost tiers: routine
plans get a same-pass self-critique, HIGH-stakes plans earn the heavier Opus-tier
independent second pass. If no subagent-dispatch primitive is available, the self-critique
above is the fallback — always do at least that much. A genuine disagreement between
passes goes into the write-up as an explicit tension (your view vs. the second pass's,
and why you land where you do) — never silently resolved.

Be direct and decisive — this is a forcing function, not a hedge. End with the scored
rubric and the recommended next step (e.g. `/plan-eng-review`, `writing-plans`, or back
to scoping).
