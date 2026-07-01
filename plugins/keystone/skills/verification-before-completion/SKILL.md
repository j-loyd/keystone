---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim                 | Requires                        | Not Sufficient                 |
| --------------------- | ------------------------------- | ------------------------------ |
| Tests pass            | Test command output: 0 failures | Previous run, "should pass"    |
| Linter clean          | Linter output: 0 errors         | Partial check, extrapolation   |
| Build succeeds        | Build command: exit 0           | Linter passing, logs look good |
| Bug fixed             | Test original symptom: passes   | Code changed, assumed fixed    |
| Regression test works | Red-green cycle verified        | Test passes once               |
| Agent completed       | VCS diff shows changes          | Agent reports "success"        |
| Requirements met      | Line-by-line checklist          | Tests passing                  |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse                                  | Reality                |
| --------------------------------------- | ---------------------- |
| "Should work now"                       | RUN the verification   |
| "I'm confident"                         | Confidence ≠ evidence  |
| "Just this once"                        | No exceptions          |
| "Linter passed"                         | Linter ≠ compiler      |
| "Agent said success"                    | Verify independently   |
| "I'm tired"                             | Exhaustion ≠ excuse    |
| "Partial check is enough"               | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter     |

## Key Patterns

**Tests:**

```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**

```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**

```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**

```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**

```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```

## Passing ≠ Real

A green suite and a clean exit code prove the commands ran — not that the work is real. Two
failure modes survive a passing run; check both before claiming done.

### Is the code actually wired? (Existence → Substantive → Wired → Functional)

Walk the ladder for the thing you just built. A claim fails at the first rung it can't clear:

1. **Exists** — the file/function/route is present.
2. **Substantive** — it's not a stub: no lone `TODO`/`FIXME`, no empty/`return null`/`pass`
   body, no `lorem ipsum`, no hardcoded value standing in for real logic.
3. **Wired** — it's actually reached: imported AND called from a real path (not just defined).
   New code that nothing calls is a dead export; grep for the caller before claiming it works.
4. **Functional** — it runs and produces the right output for a real input.

"The tests pass" usually proves rung 4 for the _tested_ path only. Confirm the new thing is
wired into the _real_ path, not just exercised by a test that imports it directly.

### Are the tests worth anything? (test-quality audit)

A passing test that asserts nothing is theater. Before trusting a suite:

- **Circular test** — does the test assert the implementation back at itself (e.g. recomputing
  the expected value with the same code under test, or snapshotting whatever the function
  currently returns)? It will pass for any behavior. Rewrite to an independently-derived expected
  value.
- **Assertion strength** — rank each assertion: existence (`toBeDefined`) < type < status/no-throw
  < exact value < behavioral (observable effect). A suite stuck at the weak end proves little;
  push the important ones up the ladder.
- **Disabled tests** — scan for `.skip`/`.only`/`xit`/commented-out tests. A suite is only as
  honest as the tests that actually run.
- **Expected-value provenance** — for each key assertion, can you say _where the expected value
  came from_ (spec, hand-calculation)? "It's what the code returned" is not provenance.

Don't invent tests where they don't belong: pure-infrastructure/config changes may have no
meaningful unit test — say so and verify behaviorally instead of fabricating a green check.

### Acceptance Criteria Traceability

List **every** acceptance criterion from the plan. For each, name the one or more tests that
prove it, with `[Source: path:line]`. If none exists, write `[UNCOVERED] — gap` — do not omit
the row. Example:

- `AC1 (user can edit name) → test_edit_name [Source: tests/profile.spec:42]`
- `AC3 (invalid email shows error) → [UNCOVERED] — gap`

**Row count must equal the AC count** — an AC with no row is a hidden gap; a row with no AC is
scope creep. An `[UNCOVERED]` row blocks a completion claim exactly the way a failing test does.

## Why This Matters

From 24 failure memories:

- your human partner said "I don't believe you" - trust broken
- Undefined functions shipped - would crash
- Missing requirements shipped - incomplete features
- Time wasted on false completion → redirect → rework
- Violates: "Honesty is a core value. If you lie, you'll be replaced."

## When To Apply

**ALWAYS before:**

- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**

- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.
