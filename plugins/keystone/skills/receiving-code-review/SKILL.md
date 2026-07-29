---
name: receiving-code-review
description: Evaluate review feedback on its merits before acting on it. Use when a reviewer, agent, or CI leaves comments and the user says "address the review" or "is this feedback right", or pastes review output. Verify each claim and push back on the wrong ones rather than complying reflexively.
---

# Code Review Reception

## Overview

Code review requires technical evaluation, not emotional performance.

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort.

## The Response Pattern

```
WHEN receiving code review feedback:

1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

## Forbidden Responses

**NEVER:**

- "You're absolutely right!" (explicit `CLAUDE.md` / instruction-file violation)
- "Great point!" / "Excellent feedback!" (performative)
- "Let me implement that now" (before verification)

**INSTEAD:**

- Restate the technical requirement
- Ask clarifying questions
- Push back with technical reasoning if wrong
- Just start working (actions > words)

## Handling Unclear Feedback

```
IF any item is unclear:
  STOP - do not implement anything yet
  ASK for clarification on unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

**Example:**

```
User: "Fix 1-6"
You understand 1,2,3,6. Unclear on 4,5.

❌ WRONG: Implement 1,2,3,6 now, ask about 4,5 later
✅ RIGHT: "I understand items 1,2,3,6. Need clarification on 4 and 5 before proceeding."
```

## Triage: Severity × Confidence

Two independent axes, not one queue. **Severity** is "how bad if true." **Confidence** is "how
sure are we it's true." Collapsing them into a single priority list is how a confidently-worded
nitpick jumps the line, or a real blocker gets buried because it was hedged.

|                         | **Confirmed** (reproduced, traced, or a working counter-example exists) | **Suspected** (pattern/smell, not yet demonstrated)                                                                                            |
| ----------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker / Critical**  | Fix now — the reviewer already did the verification work.               | **Verify first.** Reproduce or trace it yourself before touching code; if it doesn't reproduce, say so instead of silently "fixing" a phantom. |
| **Should-fix / Medium** | Fix in this pass, after blockers.                                       | Verify if cheap (a few minutes); otherwise schedule it and say so rather than guessing.                                                        |
| **Nit / Low**           | Fix if trivial, otherwise note and move on.                             | Lowest priority — verify only if you're already touching that code, otherwise a candidate to defer or push back on.                            |

**The rule this produces:** confidence gates whether you verify before acting; severity gates how
much it matters once you have. A confirmed nit and a suspected blocker can cost the same amount
of your time — don't let severity alone set the queue.

**Confidence is a property of the finding, not the reviewer.** Ego creeps in sideways — agreeing
fast to look cooperative, or resisting on principle to look rigorous. Neither is about the code.
"Confirmed" means someone did the work of demonstrating it, not that they outrank you;
"suspected" means the work isn't done yet, not that it's wrong. Route your energy at the
verification, not at the social read.

## YAGNI Check for "Professional" Features

```
IF reviewer suggests "implementing properly":
  grep codebase for actual usage

  IF unused: "This endpoint isn't called. Remove it (YAGNI)?"
  IF used: Then implement properly
```

**The user's rule:** "You and reviewer both report to me. If we don't need this feature, don't add it."

## Implementation Order

```
FOR multi-item feedback:
  1. Clarify anything unclear FIRST
  2. Then implement in this order:
     - Blocking issues (breaks, security)
     - Simple fixes (typos, imports)
     - Complex fixes (refactoring, logic)
  3. Test each fix individually
  4. Verify no regressions
```

Within each tier, the Triage matrix above sets what to verify before touching code — severity
picks the queue, confidence picks whether you reproduce first.

## When To Push Back

Push back when:

- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Legacy/compatibility reasons exist
- Conflicts with the user's architectural decisions
- A **suspected** finding you verified and couldn't reproduce — bring the verification, not just
  disagreement (see Triage above)

**How to push back:**

- Use technical reasoning, not defensiveness
- Ask specific questions
- Reference working tests/code
- State the finding's confidence explicitly — "I traced this; unreachable because X" carries more
  weight than "I disagree"
- Involve the user if architectural

**Signal if uncomfortable pushing back out loud:** "Strange things are afoot at the Circle K"

## The Bottom Line

**External feedback = suggestions to evaluate, not orders to follow.**

Verify. Question. Then implement.

No performative agreement. Technical rigor always.

## Going deeper

- [`source-handling.md`](source-handling.md) — how the source changes the weight of feedback
  (human reviewer, agent, CI, keystone's own graded reviewers) and GitHub thread mechanics.
- [`worked-examples.md`](worked-examples.md) — end-to-end examples, common mistakes, and how to
  acknowledge correct feedback or walk back an incorrect pushback.
