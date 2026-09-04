# Worked example, advantages, and red flags

A full run end to end, why the pattern wins, and the failure modes that mean you have
drifted out of it. Read on your first run of a plan, or when a run feels off.

## Contents

- Example Workflow
- Advantages
- Red Flags

## Example Workflow

```
You: I'm using Subagent-Driven Development to execute this plan.

[Read plan file once: docs/plans/feature-plan.md]
[Extract all 5 tasks with full text and context]
[Create TodoWrite with all tasks]
[Level: heavy — task 4 touches auth, and ANY safety surface puts the observed rubric at Heavy.
 Had this run been declared Light or Medium, that safety signal is the ONE blocking delta
 trigger: stop and reconfirm with the user before executing. See plan-levels.md.]
[Risk tags from the plan: 1=MED, 2=MED, 3=LOW, 4=HIGH, 5=MED]
[Slice: tasks 1-2 share the install path -> ONE dispatch carrying both packets;
        3-5 are disjoint -> one dispatch each]

Slice A = Tasks 1-2: hook install script + recovery modes (MED, MED)

[ONE dispatch: both task texts, both sets of ACs, shared context — one packet per task]

Implementer: NEEDS_CONTEXT — "user or system level for the hook install?"

[Re-dispatch the slice, packet now says: user level (~/.claude/hooks/)]

Implementer: [ONE report, per-task evidence]
  Task 1:
  - Implemented install-hook command
  - TDD: RED (test_install fails, no command yet) → GREEN, 5/5 passing, output pristine
  - Packet check: caught a missing --force flag, added it
  Task 2:
  - Added verify/repair modes
  - TDD: RED → GREEN, 8/8 passing, output pristine
  - Packet check: complete, in scope, evidenced
  - Committed both

[Gates run PER TASK off that single dispatch — slicing changes what gets DISPATCHED,
 never what gets REVIEWED. Both tasks are MED, so one Riley pass each.]

[Task 1, MED -> one Riley pass, carrying the AC trace]
Riley: Strengths: good coverage, clean. AC trace: 3/3 covered. Scope: every hunk traces. Issues: none. PASS.

[Mark Task 1 complete; run-state Gates: Riley PASS · Quinn — · Sage —]

[Task 2, MED -> one Riley pass]
Riley: FAIL. Critical: none. Important:
  - Missing: progress reporting (spec says "report every 100 items") — AC2 [UNCOVERED]
  - Extra: --json flag, not requested (scope: traces to nothing)
  - Magic number 100

[Implementer fixes — findings passed verbatim]
Implementer: Removed --json, added progress reporting, extracted PROGRESS_INTERVAL;
             re-ran covering tests, 9/9 green

[Re-review — framed "find what's still wrong", not "is it fixed?"]
Riley: AC trace 3/3 covered. PASS.

[Mark Task 2 complete; run-state Gates: Riley FAIL(3)→PASS · Quinn — · Sage —]

Task 4 (HIGH: touches auth) is the one that earns the full sequence:
Mason -> Quinn (QA gate) -> Riley spec -> Riley quality -> Sage (safety surface)

...

[After all tasks]
[Dispatch final code-reviewer over the whole implementation]
Final reviewer: All requirements met, ready to merge

[finishing-a-development-branch Step 7: tally the gates before retiring the run-state]
Gate tally: Riley 6 dispatches over 4 tasks / 1 FAIL · Quinn 1 / 1 PASS · Sage 1 / 1 PASS
  (task 3 was LOW — no Riley; task 4 was HIGH — Quinn + spec + quality + Sage; task 2 took a re-review)
  -> Quinn ran once and caught nothing: one run is a data point, not a verdict. Sage is
     excluded from deletion candidacy on a clean record by rule — a clean security pass is the
     expected outcome, not an idle seat.

Done!
```

## Advantages

**vs. Manual execution:**

- Subagents follow TDD naturally
- Fresh context per slice (no confusion)
- Context-isolated (each slice gets a clean window; no cross-slice confusion)
- Subagent stops cleanly — NEEDS_CONTEXT before work, NEEDS_CONTEXT/BLOCKED mid-task — and is re-dispatched with the answer

**vs. Executing Plans:**

- Same session (no handoff)
- Continuous progress (no waiting)
- Review checkpoints automatic

**Efficiency gains:**

- No file reading overhead (controller provides full text)
- Controller curates exactly what context is needed
- Subagent gets complete information upfront
- Questions surfaced before work begins (not after)

**Quality gates:**

- The implementer's packet check catches gaps before handoff
- Review scaled to Risk: one Riley pass at MED; Quinn plus spec-then-quality at HIGH
- Review loops ensure fixes actually work
- Spec compliance prevents over/under-building
- Code quality ensures implementation is well-built

**Cost:**

- More subagent invocations (implementer + 1 reviewer per MED task; + Quinn and 2 reviewers at HIGH; none at LOW)
- Controller does more prep work (extracting all tasks upfront)
- Review loops add iterations
- But catches issues early (cheaper than debugging later)

## Red Flags

**Never:**

- Start implementation on main/master branch without explicit user consent
- Skip a gate the task's **Risk tier requires** (see Rigor Scales to Risk — LOW skips Riley by design; MED/HIGH do not)
- Proceed with unfixed issues
- Dispatch multiple implementation subagents in parallel **on shared files / without isolation** (conflicts) — parallel **waves** are allowed only when tasks are independent AND isolated; see ./parallel-waves.md
- Make subagent read plan file (provide full text instead)
- Skip scene-setting context (subagent needs to understand where task fits)
- Ignore subagent questions (answer before letting them proceed)
- Accept "close enough" on spec compliance (spec reviewer found issues = not done)
- Skip review loops (reviewer found issues = implementer fixes = review again)
- Let the implementer's own packet check replace actual review (both are needed)
- **At HIGH, start code quality review before spec compliance is ✅** (wrong order — at MED there's only the one pass)
- Move to next task while either review has open issues

**If subagent asks questions:**

- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**If reviewer finds issues:**

- Implementer (same subagent) fixes them
- Reviewer reviews again
- Repeat until approved
- Don't skip the re-review

**If subagent fails task:**

- Dispatch fix subagent with specific instructions
- Don't try to fix manually (context pollution)
