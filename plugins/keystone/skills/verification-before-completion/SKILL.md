---
name: verification-before-completion
description: Run the check and read its output before claiming anything works. Use before saying done, fixed, passing, or "should work", before opening a PR, and when the user asks "did you actually run it" or "are you sure". Evidence first — a completion claim with no command behind it is a guess.
---

# Verification Before Completion

A completion claim is a factual assertion about the state of the world. Most of this kit is
heuristics you apply with judgment. This one is not — it is a narrow bridge, because a false
completion claim silently corrupts every decision made downstream of it, and the corruption is
invisible until something breaks in production.

So treat the gate below as a fixed sequence, not a checklist to adapt.

## The gate

**Run this in order before stating any completion status. Do not reorder or skip steps.**

1. **Identify** — name the exact command that would prove this specific claim.
2. **Run** it — in full, in this turn. A run from earlier in the session does not count; the
   code has changed since.
3. **Read** the whole output — exit code, failure count, skip count. Not just the last line.
4. **Compare** — does that output establish *this* claim, or a neighboring one?
5. **State** it with the evidence attached, or state the real status instead.

The two steps that actually get skipped are 2 and 3 — a remembered run substituted for a fresh
one, and a glance at the tail of the output instead of the whole thing. If you are about to
claim something is done, check those two specifically.

**Scope:** the gate applies to every phrasing of completion, not just the word "done" —
"fixed", "passing", "working", "ready", "that should do it", and any expression of satisfaction
that implies the work is finished.

## What each claim actually requires

| Claim                 | Requires                        | Not sufficient                 |
| --------------------- | ------------------------------- | ------------------------------ |
| Tests pass            | Test command output, 0 failures | A previous run, "should pass"  |
| Linter clean          | Linter output, 0 errors         | Partial check, extrapolation   |
| Build succeeds        | Build command, exit 0           | Linter passing, logs look fine |
| Bug fixed             | Original symptom retested       | Code changed, assumed fixed    |
| Regression test works | Red-green cycle verified        | Test passes once               |
| Agent completed       | VCS diff shows the changes      | The agent reported success     |
| Requirements met      | Line-by-line checklist          | Tests passing                  |

The recurring shape: each right-hand column is evidence for a *neighboring* claim, not the one
being made. A linter says nothing about compilation; a passing test says nothing about whether
the code is reachable in production.

**Delegated work is the sharpest case** — a subagent's "done" is a claim, not a result. Check
the diff yourself before repeating it.

## Passing ≠ real

A green suite proves the commands ran, not that the work is real. Two failure modes survive a
passing run.

### Is the code actually wired?

Walk the ladder for the thing you just built. A claim fails at the first rung it cannot clear:

1. **Exists** — the file/function/route is present.
2. **Substantive** — not a stub: no lone `TODO`/`FIXME`, no empty or `return null`/`pass` body,
   no hardcoded value standing in for real logic.
3. **Wired** — imported AND called from a real path, not merely defined. New code nothing calls
   is a dead export; grep for the caller before claiming it works.
4. **Functional** — runs and produces the right output for a real input.

"The tests pass" usually proves rung 4 for the *tested* path only. Confirm the new thing is
wired into the *real* path, not just exercised by a test that imports it directly.

### Are the tests worth anything?

A passing test that asserts nothing is theater. Before trusting a suite:

- **Circular test** — does it assert the implementation back at itself (recomputing the expected
  value with the code under test, or snapshotting whatever the function currently returns)? It
  will pass for any behavior. Rewrite against an independently-derived expected value.
- **Assertion strength** — rank each assertion: existence (`toBeDefined`) < type < status/no-throw
  < exact value < behavioral (observable effect). A suite stuck at the weak end proves little;
  push the important ones up the ladder.
- **Disabled tests** — scan for `.skip`/`.only`/`xit`/commented-out tests. A suite is only as
  honest as the tests that actually run.
- **Expected-value provenance** — for each key assertion, can you say where the expected value
  came from (spec, hand-calculation)? "It's what the code returned" is not provenance.

Don't invent tests where they don't belong — pure infrastructure or config changes may have no
meaningful unit test. Say so and verify behaviorally rather than fabricating a green check.

### Acceptance criteria traceability

List **every** acceptance criterion from the plan. For each, name the test(s) that prove it with
`[Source: path:line]`. If none exists, write `[UNCOVERED] — gap` rather than omitting the row.

- `AC1 (user can edit name) → test_edit_name [Source: tests/profile.spec:42]`
- `AC3 (invalid email shows error) → [UNCOVERED] — gap`

Row count must equal the AC count — an AC with no row is a hidden gap, a row with no AC is scope
creep. An `[UNCOVERED]` row blocks a completion claim the same way a failing test does.

### Acceptance criteria vs. Definition of Done

Two different bars, and a task is done only when both are met.

- **Acceptance criteria** are written per task and vary with it. They answer *did we build the
  right thing?* — the traceability table above is how you prove them.
- **A Definition of Done** is fixed across the project and reused every increment. It answers
  *is this finished to our standard?* — the bar that applies whether the increment was a bugfix
  or a feature (typical entries: tests written and passing, reviewer comments addressed, docs
  updated wherever behavior changed).

Both must hold. Where a project has no written Definition of Done, name the standing checks you
applied rather than reading the absence as "no bar."

## Reporting honestly

When verification fails or was not possible, say so plainly and specifically — which command,
what output, what remains unknown. A partial result reported accurately is useful; a complete
result reported on faith is not.

Hedging language ("should work", "seems to", "probably passing") is appropriate *only* when you
are explicitly flagging something as unverified. Used to soften an untested claim into sounding
finished, it is the failure this skill exists to prevent.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "I ran the tests a few steps ago" | That run describes a state the code is no longer in. This is step 2, and it is the step that actually gets skipped. |
| "The last line said passing" | The tail hides the exit code, the skip count, and the suite that errored before it ever reported. The whole output is the evidence; its final line is a summary of part of it. |
| "The change is too small to break anything" | Then the run is cheap. Size predicts nothing about whether the file still parses or the test still loads. |
| "It should work" | A prediction wearing the clothes of a result. Run the check, or say plainly that it's unverified — those are the two honest options. |
| "The fix is obviously correct" | Obviously-correct fixes are how you find out the bug was somewhere else. The symptom is what gets retested, not the diff. |
| "It compiles and the linter's clean" | Evidence for neighboring claims. Neither says anything about whether the behavior changed the way you intended. |
| "The suite was green before the fix, so the suite is fine" | Green before the fix is evidence about the old code. It also means nothing in it covered the bug — otherwise it would have been red. |
| "The subagent reported success" | A report is a claim, not a result. Read the diff before repeating it upward. |
| "The tests pass, so the feature works" | Passing tests prove the tested path runs. Confirm the new code is reached from the real path, not only from the test that imports it directly. |
| "Everything's green except a couple of unrelated failures" | "Unrelated" is a conclusion and needs the same evidence as any other: name the failures and say why this change can't be their cause. |
| "There's nothing meaningful to test here" | Sometimes true — a config or infrastructure change may have no useful unit test. Then say that and verify behaviorally; it isn't a licence to verify nothing. |

## Red flags

- A completion claim with no command anywhere above it
- "Should", "seems to", "probably", or "I believe" in a status line that isn't explicitly flagging something as unverified
- Output quoted from a run that predates the most recent edit
- A test result cited as a single tail line, with no exit code, failure count, or skip count
- A "fixed" claim where the original reproduction was never re-run
- A regression test that was never observed failing
- Skipped, focused, or commented-out tests inside a run being cited as green
- An acceptance criterion with no row in the traceability table
- A subagent's summary passed upward as fact, with no diff read
- A new function whose only caller is its own test
- An expected value that came from what the code returned
- A green suite offered as proof of a claim about docs, config, or deployment that the suite never touches
