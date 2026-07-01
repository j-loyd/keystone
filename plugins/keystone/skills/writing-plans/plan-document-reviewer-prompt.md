# Plan Document Reviewer Prompt Template

Use this template when dispatching a plan document reviewer subagent.

**Purpose:** Verify the plan is complete, matches the spec, and has proper task decomposition.

**Dispatch after:** The complete plan is written.

Dispatch a fresh reviewer subagent with whatever subagent-dispatch primitive your harness
provides (e.g. Claude Code's Task tool with a `general-purpose` agent, or the equivalent
runner on another harness). If the harness has no subagent dispatch, run this review inline
in a clean pass instead — the review still needs to happen, just without the fresh-context
isolation.

```
Reviewer subagent:
  description: "Review plan document"
  prompt: |
    You are a plan document reviewer. Verify this plan is complete and ready for implementation.

    **Plan to review:** [PLAN_FILE_PATH]
    **Spec for reference:** [SPEC_FILE_PATH]

    ## First: Goal-Backward Pass (run before the table)

    Plan completeness is not goal achievement — a task "create the endpoint" can be
    fully written while the thing that makes the goal true (e.g. the hashing, the wiring)
    has no task at all. Before checking individual tasks:

    1. State the phase **goal** in one line (from the plan header `Goal:`; if absent, infer it and say so).
    2. List the 3–5 **truths that must hold** for that goal to be achieved.
    3. For each truth, point to the task(s) that make it true. A truth with **no covering task**,
       or one covered only by a task that creates an artifact without wiring it to where the goal
       needs it, is a **HIGH** finding — name the uncovered truth.

    ## What to Check

    | Category | What to Look For |
    |----------|------------------|
    | Completeness | TODOs, placeholders, incomplete tasks, missing steps |
    | Spec Alignment | Plan covers spec requirements, no major scope creep |
    | Task Decomposition | Tasks have clear boundaries, steps are actionable |
    | Buildability | Could an engineer follow this plan without getting stuck? |
    | Risk + Discovery | Every task has a `Risk` tag; every non-LOW task has a non-empty `Verified-behavior` block |
    | Context Budget | Task/file count is justifiable for one plan (see budget note below) |

    ## Risk + Discovery Gate (blocking)

    Two checks here are not advisory — they FAIL the plan:

    - **Empty discovery on a HIGH task** → FAIL. Any task tagged `Risk: high` (or that should be,
      see below) with an empty or hand-waved `Verified-behavior` block is not ready: the
      implementer will discover those facts mid-task and pay a refactor cycle. Name the missing
      touchpoint.
    - **Risk tag contradicts its signals** → CHALLENGE (treat as an issue). A task marked `low`
      that changes a shared field/signature, can fail silently (wrong output passes existing
      tests), touches a safety surface, or is LLM-backed/side-effecting is mis-tagged — it's HIGH
      (ceiling, not average; one HIGH signal wins). Unknown behavior ⇒ HIGH, never LOW. Quote the
      signal you saw and state the tag it should carry. Also scan task actions for scope-shrinking
      language — "v1 just does X", "static for now", "hardcoded", "placeholder", "wire this up
      later", "future enhancement." If such language delivers only a shadow of a requirement the
      spec or a locked decision says to fully deliver, that is scope reduction disguised as
      versioning → **FAIL**. Quote the line and name the requirement it contradicts.
    - **Context budget breach** → CHALLENGE. A single plan that packs too many tasks or touches
      too many files exceeds what one execution context can hold reliably. Defaults: **2–3 tasks**
      is the target, **5+ tasks** or **15+ files** is a breach. Not an automatic FAIL — but the
      plan must either split, or carry a one-line justification for why these tasks are one
      indivisible unit (e.g. a mechanical rename across many files). No justification and over the
      threshold → FAIL with "split this plan."

    ## Calibration

    **Only flag issues that would cause real problems during implementation.**
    An implementer building the wrong thing or getting stuck is an issue.
    Minor wording, stylistic preferences, and "nice to have" suggestions are not.

    Approve unless there are serious gaps — missing requirements from the spec,
    contradictory steps, placeholder content, tasks so vague they can't be acted on,
    or a failure of the Risk + Discovery Gate above (these are blocking).

    ## Output Format

    ## Plan Review

    **Status:** Approved | Issues Found

    **Issues (if any):** tag each `HIGH` (goal not achieved / gate failure / cannot proceed) or
    `actionable` (proceed at risk; the planner can fix it). `HIGH` is the concern the optional
    convergence loop counts for its stop condition — one severity vocabulary across this file.
    - **[HIGH | actionable]** [Task X, Step Y]: [specific issue] - [why it matters for implementation]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for improvement]
```

**Reviewer returns:** Status, Issues (if any), Recommendations

## Lens Variants (for the convergence loop)

When running the bounded convergence loop (`./plan-convergence-loop.md`), dispatch the base
prompt above **once per lens** — each pass keeps the full template (including the blocking Risk +
Discovery Gate) and adds one focused checklist. This gives multi-perspective coverage from one
model, no external tools.

- **Goal lens** — dispatch as Riley (`code-reviewer`). Checklist: every spec requirement maps to
  a task; no silent scope drop ("v1 just does X", "wire up later", placeholder-for-now); no major
  scope creep.
- **Buildability lens** — dispatch as Riley (`code-reviewer`). Checklist: a zero-context engineer
  can execute each task; no placeholders (TBD/TODO/"add validation"); type & signature
  consistency across tasks; exact paths and commands present.
- **Security lens** — dispatch as Sage (`security-reviewer`), **only if a sensitive surface is in
  scope**. Checklist: auth / secrets / money / deletion / irreversible / external-input / LLM-trust
  touchpoints have explicit handling in the plan; every safety-surface task is tagged HIGH per the
  rubric.

**Severity vocabulary (shared, canonical):** each lens tags every finding **`HIGH`** or
**`non-HIGH (actionable)`** so the loop can count unresolved HIGHs for its stop condition. A Risk

- Discovery Gate failure is always `HIGH`. Any other gate or check that needs to signal a blocking
  problem maps its blocker to `HIGH` — there is exactly one severity vocabulary in this file.
