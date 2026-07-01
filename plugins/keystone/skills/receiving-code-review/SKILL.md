---
name: receiving-code-review
description: Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation
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
your human partner: "Fix 1-6"
You understand 1,2,3,6. Unclear on 4,5.

❌ WRONG: Implement 1,2,3,6 now, ask about 4,5 later
✅ RIGHT: "I understand items 1,2,3,6. Need clarification on 4 and 5 before proceeding."
```

## Source-Specific Handling

### From your human partner

- **Trusted** - implement after understanding
- **Still ask** if scope unclear
- **No performative agreement**
- **Skip to action** or technical acknowledgment

### From External Reviewers

```
BEFORE implementing:
  1. Check: Technically correct for THIS codebase?
  2. Check: Breaks existing functionality?
  3. Check: Reason for current implementation?
  4. Check: Works on all platforms/versions?
  5. Check: Does reviewer understand full context?

IF suggestion seems wrong:
  Push back with technical reasoning

IF can't easily verify:
  Say so: "I can't verify this without [X]. Should I [investigate/ask/proceed]?"

IF conflicts with your human partner's prior decisions:
  Stop and discuss with your human partner first
```

**your human partner's rule:** "External feedback - be skeptical, but check carefully"

## Reading keystone's Reviewer Output

Feedback arrives in a few known shapes depending on who produced it — read the shape before you
triage:

- **Riley (`code-reviewer` / `/review`)** — findings grouped **blocker / should-fix / nit**, each
  with a `file:line` and a suggested fix. No confidence field: severity alone doesn't tell you
  whether the finding is demonstrated or theorized — verify it yourself before treating it as
  confirmed.
- **Quinn (`qa` gate)** — a graded verdict (**PASS / CONCERNS / FAIL / WAIVED**) plus per-issue
  `file:line`, severity, the finding, and a suggested action. A **FAIL** item is a must-fix by
  definition; a **CONCERNS** item is the orchestrator's call to accept or loop — you don't get to
  unilaterally drop it, but you can make the case with verification.
- **Sage (`security-reviewer` / `/cso`)** — findings grouped **critical / high / medium / low**,
  each carrying an explicit **confidence: confirmed / suspected**, and, for confirmed findings,
  the traced source→sink path and concrete exploit. Sage already defaults to skepticism about her
  own findings — a `suspected` label means she tried and couldn't build the exploit, not that she
  didn't look.
- **Your human partner, inline** — no severity system at all. Treat every item per Handling
  Unclear Feedback above, not as a pre-triaged queue.

When a finding doesn't carry an explicit confidence label (Riley's and Quinn's formats don't by
default), treat it as **suspected until you verify it** — the absence of "confirmed" isn't a
signal the finding is weak, it just means the verification step is still yours to do.

If the orchestrator re-dispatches you with a reviewer's findings after a FAIL/CONCERNS loop, the
findings arrive **verbatim** (that's the contract on the orchestrator's side) — the triage below
applies to that batch exactly as it would to a first pass.

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

**your human partner's rule:** "You and reviewer both report to me. If we don't need this feature, don't add it."

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
- Conflicts with your human partner's architectural decisions
- A **suspected** finding you verified and couldn't reproduce — bring the verification, not just
  disagreement (see Triage above)

**How to push back:**

- Use technical reasoning, not defensiveness
- Ask specific questions
- Reference working tests/code
- State the finding's confidence explicitly — "I traced this; unreachable because X" carries more
  weight than "I disagree"
- Involve your human partner if architectural

**Signal if uncomfortable pushing back out loud:** "Strange things are afoot at the Circle K"

## Acknowledging Correct Feedback

When feedback IS correct:

```
✅ "Fixed. [Brief description of what changed]"
✅ "Good catch - [specific issue]. Fixed in [location]."
✅ [Just fix it and show in the code]

❌ "You're absolutely right!"
❌ "Great point!"
❌ "Thanks for catching that!"
❌ "Thanks for [anything]"
❌ ANY gratitude expression
```

**Why no thanks:** Actions speak. Just fix it. The code itself shows you heard the feedback.

**If you catch yourself about to write "Thanks":** DELETE IT. State the fix instead.

## Gracefully Correcting Your Pushback

If you pushed back and were wrong:

```
✅ "You were right - I checked [X] and it does [Y]. Implementing now."
✅ "Verified this and you're correct. My initial understanding was wrong because [reason]. Fixing."

❌ Long apology
❌ Defending why you pushed back
❌ Over-explaining
```

State the correction factually and move on.

## Common Mistakes

| Mistake                      | Fix                                 |
| ---------------------------- | ----------------------------------- |
| Performative agreement       | State requirement or just act       |
| Blind implementation         | Verify against codebase first       |
| Batch without testing        | One at a time, test each            |
| Assuming reviewer is right   | Check if breaks things              |
| Avoiding pushback            | Technical correctness > comfort     |
| Partial implementation       | Clarify all items first             |
| Can't verify, proceed anyway | State limitation, ask for direction |

## Real Examples

**Performative Agreement (Bad):**

```
Reviewer: "Remove legacy code"
❌ "You're absolutely right! Let me remove that..."
```

**Technical Verification (Good):**

```
Reviewer: "Remove legacy code"
✅ "Checking... build target is 10.15+, this API needs 13+. Need legacy for backward compat. Current impl has wrong bundle ID - fix it or drop pre-13 support?"
```

**YAGNI (Good):**

```
Reviewer: "Implement proper metrics tracking with database, date filters, CSV export"
✅ "Grepped codebase - nothing calls this endpoint. Remove it (YAGNI)? Or is there usage I'm missing?"
```

**Unclear Item (Good):**

```
your human partner: "Fix items 1-6"
You understand 1,2,3,6. Unclear on 4,5.
✅ "Understand 1,2,3,6. Need clarification on 4 and 5 before implementing."
```

**Triage in Action (Good):**

```
Riley: "blocker — sync.ts:42 unbounded loop can hang on empty input"
Sage: "high, confirmed — auth.ts:88 IDOR: traced request→DB row, no ownership check, exploit built"
Sage: "low, suspected — cache.ts:12 possible race under concurrent writes, not reproduced"

✅ Fix Riley's blocker and Sage's confirmed IDOR immediately — both are already demonstrated, no
   re-verification needed. Spend a few minutes trying to reproduce the suspected race before
   deciding to fix, defer, or push back on it.
❌ Fix all three in file order, or fix the "high" before the "blocker" because it sounds scarier —
   severity sets urgency, confidence sets whether verification comes first.
```

## GitHub Thread Replies

When replying to inline review comments on GitHub, reply in the comment thread (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`), not as a top-level PR comment.

## The Bottom Line

**External feedback = suggestions to evaluate, not orders to follow.**

Verify. Question. Then implement.

No performative agreement. Technical rigor always.
