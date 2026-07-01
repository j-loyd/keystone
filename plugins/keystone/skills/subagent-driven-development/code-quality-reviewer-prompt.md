# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

**Only dispatch after spec compliance review passes.**

```
Task tool (agent type: code-reviewer, or general-purpose if your harness has no registered agents):
  Use template at requesting-code-review/code-reviewer.md

  DESCRIPTION: [task summary, from implementer's report]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
```

**In addition to standard code quality concerns, the reviewer should check:**

- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this implementation create new files that are already large, or significantly grow existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)

**Tests and pristine output:**

- Quinn (the QA gate) already ran the suite and Mason reported RED→GREEN
  evidence for exactly this code — don't re-run the full suite to confirm it.
  Run a focused test only when reading the diff raises a specific doubt that no
  existing run answers; if heavier validation seems warranted, recommend it in
  your report rather than running it.
- Warnings, errors, or unexpected skips in the reported test output are
  **findings** — the run should be pristine, not just "N passed." A bare "tests
  pass" claim with no RED→GREEN evidence behind it is itself a finding.

**When you cannot verify a requirement from the diff alone — say so explicitly:**

Some requirements live in unchanged code or span multiple tasks, so the diff in
front of you can't settle them. When that happens, **do not** broaden your crawl
through the codebase or guess a verdict. Raise a **⚠️ "Cannot verify from diff"**
item that names the requirement and states what the orchestrator should check.
Silent uncertainty dressed up as a pass is exactly the failure this catches.
List these ⚠️ items alongside your Strengths and Issues so the orchestrator —
who holds the plan and cross-task context you lack — can resolve each one before
the task is marked done.

**Code reviewer returns:** Strengths, Issues (Critical/Important/Minor), ⚠️ Cannot-verify-from-diff items, Assessment
