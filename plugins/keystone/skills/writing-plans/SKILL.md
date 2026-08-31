---
name: writing-plans
description: Turn a spec or feature request into a written implementation plan on disk. Use before touching code on multi-step work, and when the user says "write a plan", "break this down", or "/spec". Produces sized, risk-tagged tasks a fresh-context agent can execute without re-deriving context.
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Small, self-contained tasks (staged, not committed — see the no-auto-commit rule).

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Context:** If working in an isolated worktree, it should have been created via the `using-git-worktrees` skill at execution time.

**Save plans to `docs/plans/` (adaptive layout):**

- **Small / medium effort → one file:** `docs/plans/YYYY-MM-DD-<feature>.md` (the
  header + `### Task N` structure below).
- **Large / multi-phase effort → a folder:** `docs/plans/YYYY-MM-DD-<feature>/` with a
  `plan.md` overview (goal, architecture, **phase index table**, revision log) plus one
  `phase-N-<name>.md` per phase — each phase file is itself a task-based plan (the structure
  below). Use a folder when the work has ~3+ phases or spans multiple subsystems. Templates:
  `keystone/templates/plans/{README,plan}.md`.
- Keep a `docs/plans/README.md` index of active plans + status; move completed plans (file
  or folder) to `docs/plans/archive/`. Versioning is git — record material re-plans in a
  `## Revision log`, not duplicate files.
- (User preferences for plan location override this default.)

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

That split needs a shape. **When the work spans more than one module, map the capabilities
before writing any plan** — a module table plus an explicit build order, agreed with the human
first. Treat that agreement as a gate: a plan written against an unagreed partition is a plan you
rewrite. Skip it for single-module work and for Light-level runs — a one-row table is not a
partition, it is ceremony.

| Module id     | Responsibility                      | Depends on   |
| ------------- | ----------------------------------- | ------------ |
| `ingest-csv`  | Parse and validate uploaded rows    | —            |
| `dedupe-rows` | Collapse duplicates on a stable key | `ingest-csv` |

- **Module ids are stable** — kebab-case, chosen once, not renamed mid-initiative, so downstream
  work (plans, branches, issues) selects by id instead of guessing which plan is the live one.
- **If two modules each need the other, the partition is wrong** — usually they are one module,
  sometimes a shared third should be extracted. Either way a cycle in `Depends on` is a
  partition error, not a sequencing problem — merge them and re-derive the build order.
- **Interfaces live at the boundary.** The map records _that_ a dependency exists; the contract
  itself lives in the **provider's** plan, so exactly one plan owns it.

The map is a different cut from the folder layout above, and from the file-level pass below:
a capability map partitions **modules**, each of which may earn its own plan; a `plan.md`
phase index sequences **phases of work** within one; `## File Structure` decomposes **files**
within a phase. On a large initiative all three apply, outermost first.

## Discuss / lock decisions first

Before decomposing into tasks, surface and **lock the decisions that would otherwise become
mid-execution overrides** — the choices an executor would have to guess at, and that you'd end
up reversing halfway through. Locking them now is far cheaper than a refactor cycle later.

Look for: defaults that change behavior (recompute vs reuse, fail-soft vs fail-loud), design
forks the spec left open (e.g. emit-as-side-effect vs return-and-accumulate), and any
"we'll decide when we get there." Present the open ones, get the human's call, and record each
locked decision in the plan so the executor inherits a decision, not a question. Skip this only
when the spec already settles every such fork.

## Splitting a task that's too big (SPIDR)

When a single task is too large to be one bite-sized unit, don't just lop off "the hard part." Split along one of these axes — each slice is independently shippable and testable:

- **Spike** — carve out the unknown as a timeboxed investigation, so the rest can be planned with confidence once it's resolved.
- **Paths** — split by workflow/branch: happy path first, then error/edge paths as their own slices.
- **Interfaces** — split by entry point or surface (one endpoint/CLI flag/UI control at a time).
- **Data** — split by data variant (one type/format/source first, more later).
- **Rules** — split by business rule (implement the core rule; add validations/special cases as follow-on slices).

**Split for constraints, not difficulty.** Legitimate reasons to defer something to a later slice: it's genuinely unknown (spike it), it depends on work not done yet, or it would blow the context budget. "It looks hard" is **not** a reason to defer — hard-but-known work belongs in the plan now, fully specified. Deferring difficulty just hides it.

**Don't shrink scope with deferral language.** "v1 just does X", "placeholder for now", "wire this up later" inside a task silently drops agreed scope and reads as done when it isn't. If something is genuinely out of this slice, make it an **explicit** later SPIDR slice with its own tasks — never a vague aside buried in a step.

## Wide refactors — the exception to vertical slicing

The slices above are vertical: each cuts a narrow but complete path and lands green on its own. A
**wide refactor** can't. That's one mechanical change whose blast radius fans across the codebase
— renaming a shared field, retyping a symbol hundreds of call sites read, swapping one library
call everywhere — so a single edit breaks every caller at once and there is no narrow end-to-end
path left to cut. Don't force it into a single narrow end-to-end slice; sequence it **expand → migrate →
contract**:

- **Expand** — add the new form beside the old so nothing breaks yet. One task.
- **Migrate in batches sized by blast radius** — per package, per directory, per subsystem;
  whatever keeps one batch reviewable. Each batch is its own task, depending on the expand, and
  stays green because the old form still exists.
- **Contract** — delete the old form once no caller remains. One task, depending on every batch.

**Does your task actually qualify? The test is shape, not size.** All three must hold: the change
is **mechanical** — one transformation applied repeatedly, correctness decidable per site; the
call sites are **too many to change in one reviewable task**; and **no subset of them can change
alone** and leave a working system. Fail any one and this isn't the exception. A big feature with
many parts is a normal SPIDR split (Paths, Interfaces, Data); a mechanical change confined to one
package is just one task; a change where some callers _can_ be cut over independently is a
vertical slice you haven't found yet. "It's a big refactor" does not qualify — a documented
exception that anything large can claim is a loophole for skipping vertical slicing.

**Prefactor before accepting the exception.** A wide blast radius is sometimes a symptom: if a
small structural change now — extracting the seam that scattered call sites can funnel through —
turns the wide change into a narrow one, do that first as its own behavior-unchanged task, then
slice normally. Make the change easy, then make the easy change; a prefactor that doesn't
measurably shrink what follows is churn, so skip it.

State those dependencies in the plan: each batch names the expand task, the contract task names
every batch. In a plan file that's task order plus one line in the task body — don't rebuild an
issue graph inside the plan (`/to-issues` owns that ground).

Where the batches genuinely can't stay green on their own, keep the sequence and add a final
**integrate-and-verify** task that every batch feeds — that task, not the batches, is where green
is promised. **Say so in writing.** A per-batch "tests pass" you know is false is worse than an
honest note that verification is deferred to the integrate task — and it puts the checkpoint
(below) where a review can actually judge something. How the batches are held until then
(a branch, a stack, a stage) is the user's call at execution time; plan tasks still leave work
staged, not committed.

Risk tags follow the shape rather than the total size: expand and contract change a shared
contract, so they're usually HIGH; migrate batches are mechanical and fail loud, so often LOW/MED.
Tag each on its own signals.

The mechanics of expand/contract for data and interfaces — nullable adds, dual-write, throttled
backfill, destructive step last and alone — live in
[`deprecation-and-migration`](../deprecation-and-migration/SKILL.md). Cite it from the plan rather
than restating it.

## Fog — what the plan deliberately leaves unspecified

A plan is _deliberately_ incomplete. Some in-scope questions can be seen coming but can't yet be
phrased sharply, because they hang on decisions this plan hasn't reached. Write them into a
`## Not yet specified` section of the plan document — the suspected question, the area to revisit
— where they stay visible until earlier work makes them specifiable and they graduate into real
tasks. This isn't a fourth partition pass: the capability map, phase index, and `## File
Structure` each cut work you can already see; fog names the edge where none of them can cut yet.

**Fog or task? The test is whether you can state the question precisely now — not whether you can
answer it now.**

- **Task (or Spike) when** the question is already sharp, even if it's blocked or unanswered. A
  sharp question you can't _answer_ is what SPIDR's **Spike** is for: timebox it, then plan the
  rest with confidence.
- **Not yet specified when** you can't yet phrase it that sharply. Don't pre-slice fog into
  task-sized pieces — sizing something you can't state produces fake tasks with invented steps,
  and one patch of fog may graduate into several tasks, or none.

Spike and fog are complements, not overlaps: Spike takes the sharp-but-unanswered case, fog holds
the not-yet-sharp one.

Fog lives in its own named section, **never inside a task's steps** — "TBD" or "v1 just does X"
inside a task is still a plan failure (see No Placeholders). And **`## Out of scope` is a separate
section**: fog is in scope and graduates into tasks, out-of-scope work never does — one line plus a
reason. Omit either heading when empty.

## Checkpoint placement

Plans get reviewed/verified at checkpoints. Place them at **natural boundaries** — after a coherent, independently-meaningful chunk of work (a vertical slice, a completed task) — not after every micro-step. Per-step gating causes verification fatigue and slows execution without adding signal; the right granularity is "enough work that a review can actually judge something." (This tempers, doesn't weaken, the per-claim verification discipline in `verification-before-completion` — that's about never _claiming_ without evidence; this is about where _human/review_ checkpoints go.)

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**

- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Leave the work staged" - step

## Plan level

A run is declared **Light / Medium / Heavy** at kickoff — **default Medium** when unstated. The
level composes the `spec → middle → execute` pipeline (which steps fire at each stage) per
[`./plan-levels.md`](./plan-levels.md), and is recorded in the plan header as
`**Level:** light | medium | heavy`.

**Light** produces a minimal plan file — no run-state, no Verified-behavior, no reviewer pass.
Deepening is **monotonic**: pick a floor, deepen mid-run if the work demands it, never silently
downgrade.

A level sets **defaults only**. An individual task's Risk tag can still escalate its own gates
above the run default — **ceiling, not average**. See `./plan-levels.md` for the three ladders,
the observed-level rubric, and the delta-callback policy; do not restate them here.

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement this plan task-by-task (its `no-subagent-fallback.md` covers harnesses without dispatch). Steps use checkbox (`- [ ]`) syntax for tracking.

**Level:** [light | medium | heavy — see plan-levels.md; default medium]

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

**Dependency check:** [If any task builds/installs in a deceptive-complexity domain (crypto, auth, date/tz, money, parsing): name each package + how existence was confirmed, mark unconfirmed ones `[assumed]`, and ensure a `checkpoint: human-verify` task precedes any `[assumed]`/new/low-trust install. Otherwise: "N/A — no deceptive-complexity dependencies."]

---
```

## Risk tagging

Every task carries a **risk** tag that scales how much review ceremony it gets at execution
time (a load-bearing task earns the full two-stage review; a mechanical port doesn't). The tag
is **derived from observable signals, not from how hard the task feels.** Three rules keep it
decidable:

1. **Ceiling, not average.** One HIGH signal makes the whole task HIGH. Never average across
   signals — that's how a dangerous task hides behind safe attributes.
2. **Unknown = HIGH.** If you can't answer the signals below, you haven't discovered enough —
   and that itself is a high-risk signal. Spike it (SPIDR) or tag it HIGH. This is what makes
   the `Verified-behavior` block below non-optional: an un-discovered task is un-scorable.
3. **Signals are checkable** from the diff/codebase, not from a gut feel.

**HIGH — if ANY:**

- **Load-bearing** — multiple call sites or the core data path depend on the code being changed
- **Shared contract** — changes a field, signature, return shape, or invariant other code reads
- **Silent-fail mode** — if wrong, produces plausible output that passes existing tests
- **Design judgment, not mechanical** — stateful, LLM-backed, side-effecting, concurrency-sensitive
- **Safety surface** — auth, secrets, money, deletion, irreversible, or external-facing
- **No test coverage** on the specific behavior being changed

**LOW — only if ALL:**

- **Leaf / isolated** — nothing depends on it (test-only, dead-code, docs)
- **Mechanical** — correctness is decidable from the diff; a one-line spec fully determines it
- **Fails loud** — a test or the type checker catches it immediately
- **No contract change, no safety surface**

**MED — everything else.** Real logic, bounded blast radius, fails loud, single responsibility.

For any task that isn't unambiguously LOW, record a **Verified-behavior** block: for each
load-bearing thing the task touches, state how it _actually_ behaves — sync vs LLM-backed, pure
vs side-effecting, the contract it relies on — confirmed against the code, not assumed. **Cite
the source** of each fact (`[Source: path/to/file.py:120-134]`) so it's auditable and the
executor inherits grounded facts, not your paraphrase. This is the discovery gate: it forces the
facts an executor would otherwise discover mid-task (and pay a refactor cycle for) into the plan
up front. A fact you can't cite is a fact you haven't verified — which makes the task HIGH.

## Anti-Reinvention & Package Legitimacy

Deceptive-complexity domains — **cryptography, authentication/sessions, date/time & timezone
math, money/decimal arithmetic, and parsing untrusted formats** — look simple and are not. A
hand-rolled version silently mishandles edge cases (leap seconds, alg-confusion, float rounding,
encoding tricks) and becomes a security liability. Treat any plan task that _builds_ logic in
these domains as a HIGH-risk **Safety surface** signal (see Risk tagging) and prefer a vetted,
widely-used library over custom code.

But a named library is its own risk: a model readily invents plausible-sounding package names.
Three failure shapes to assume:

- **Typosquat** — a near-miss of a real name (e.g. `lodahs` for `lodash`).
- **Slopsquat** — a fabricated name that _sounds_ official (e.g. `crypto-safe`) and may even have
  been squatted onto the registry.
- **Invented** — a package the model hallucinated whole (e.g. `secure-token-manager-v2`).

**Registry existence is not legitimacy.** A name confirmed only by a registry lookup (`npm view`,
`pip index versions`, `cargo search`) or by web search / training recall is **assumed**, not
verified — a slopsquatted package also passes a registry lookup. Mark such a dependency
`[assumed]` in the plan until a human confirms it.

**Plan-time gate — answer all three in the Header `Dependency check`:**

1. Does any task build or install something in a deceptive-complexity domain?
2. If yes, does the plan name the exact library/package and note how its existence was confirmed?
3. Is that package new, low-download, repo-less, or `[assumed]`?

If (3) is **yes**, the plan MUST contain an explicit
`checkpoint: human-verify "Confirm package legitimacy: <package-name>"` task placed _before_ the
step that installs or uses it. A package that cannot be confirmed at all is **removed** and
replaced with a named, known-good alternative or a spike. This catches a hallucinated or risky
dependency at the design moment, when swapping it costs nothing. (Supply-chain hallucination is an
LLM risk; see the `llm-security` skill.)

## Task Structure

````markdown
### Task N: [Component Name]

**Risk:** low | med | high _(see Risk tagging; one HIGH signal ⇒ HIGH; unknown ⇒ HIGH)_

**Verified-behavior:** _(required unless Risk is unambiguously low)_

- `touchpoint` — how it actually behaves (sync/LLM-backed, pure/side-effecting, the contract),
  confirmed against the code. `[Source: path/to/file.py:120-134]`

**Files:**

- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Leave the work staged**

```bash
git add tests/path/test.py src/path/file.py
```

_(Staging only — committing is the user's call. See the no-auto-commit rule.)_
````

## Reference in the highest-fidelity form available

A plan is read by someone with no memory of the conversation that produced it. Prose describing
an artifact is lossy; the artifact is not. Wherever a task depends on a shape — an interface, a
layout, a payload, a behavior — attach the real thing rather than a description of it:

| Instead of prose describing…    | Attach                                                     |
| ------------------------------- | ---------------------------------------------------------- |
| what the UI should look like    | an HTML/JSX mockup, or the existing component to match      |
| the shape of an API or payload  | a type definition, schema, or a real captured response      |
| how the thing should behave     | the failing test, or a golden-file fixture                  |
| the pattern to follow           | `path/to/exemplar.ts:40-88` — point at code that exists     |
| the data you're transforming    | 3–5 real rows, not an invented example                      |

Two rules of thumb. **Point at real code before writing new prose** — an exemplar in the repo
carries the conventions, error handling, and idioms that a description silently drops. And when
you must describe something in prose, ask whether a fixture or test would say it unambiguously;
if so, write that instead and reference it.

This matters most for the tasks you expect to hand to a fresh-context agent, which is all of
them.

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:

(Location is what makes this decidable: a `## Not yet specified` section may name a question the
plan can't yet phrase as a task — see Fog. That is the only place unspecified work may live.
Inside a step, all of the below are still plan failures.)

- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember

- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- DRY, YAGNI, TDD, small self-contained tasks (staged, not committed)

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps. A requirement you can't yet phrase as a task isn't a gap to wave through — put it in `## Not yet specified` (see Fog) so it stays visible.

**1b. Goal-backward:** State the phase goal in one line, then list the 3–5 truths that must hold for it. Point each truth to a task that makes it true. A truth with no covering task — or covered only by a task that creates an artifact without wiring it — is a gap; add the task. (Completeness is not achievement.)

**1c. Context budget:** Count tasks and distinct files in this plan. 2–3 tasks is the target; 5+ tasks or 15+ files means split the plan, or justify in one line why it is one indivisible unit.

**1d. Lean process:** for each gate, checkpoint, artifact, or review step the plan itself
adds — what concretely breaks without it? Cut any with no answer: ceremony is debt every
task in the run pays, and a review gate that never fails anything is theater, not rigor.
(`/plan-eng-review` scores this same question from outside as its "lean process" row.)

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them. Also scan for scope-shrinking language ("v1 just does X", "wire this up later") that drops agreed scope — if a requirement is genuinely deferred, make it an explicit later SPIDR slice, not an aside, and anything still too vague to slice belongs in `## Not yet specified`, never inside a step.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

**4. Risk + discovery:** Does every task carry a `Risk` tag? Does every task that isn't unambiguously LOW have a non-empty `Verified-behavior` block? Re-check each tag against its signals — a task that changes a shared field or swallows an exception is HIGH no matter how small the diff looks (ceiling, not average). An un-scorable task is HIGH, not MED.

**5. Anti-reinvention & package legitimacy:** Does any task build crypto/auth/date-tz/money/parsing logic by hand, or install a package in those domains? If so, is each package named with its existence-confirmation note, is every new/low-trust/`[assumed]` package preceded by a `checkpoint: human-verify "Confirm package legitimacy: <name>"` task, and were any unconfirmable packages removed? An install task with no such checkpoint and no confirmation note is an unmet gate — fix it before handoff.

**6. Level delta.** Compute the **observed level** from the rubric in [`./plan-levels.md`](./plan-levels.md) (task count, HIGH/MED Risk-tag counts, subsystems/files touched, safety-surface signals, novel-domain, reversibility) and compare it to the plan's declared `Level:`. Apply the **delta-callback policy** defined in `plan-levels.md` — do not invent a parallel threshold:

- **observed > declared (under-scoped)** ⇒ **advisory**: name the signals, recommend the higher level, then proceed at the declared level unless the user re-levels.
- **the delta crosses the reversibility/security line** — specifically **declared Light/Medium AND any safety-surface signal present** ⇒ **block** and reconfirm the level before handoff. This is the **one** blocking trigger; everything else is advisory.

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a spec requirement with no task, add the task.

For a large or high-stakes plan, follow the self-check with an independent reviewer subagent using the template in `./plan-document-reviewer-prompt.md`. To attack the plan's _assumptions_ specifically — what it treats as true, and whether its approach is the simplest/least-reinventing one — run the `adversarial-review` skill (`/challenge`) on it; that's keystone's single home for the fresh-context, zero-authorship-memory adversarial pass. Or, for the heaviest plans, run the **bounded convergence loop** in `./plan-convergence-loop.md` — it dispatches that reviewer across goal / buildability / security lenses and replans until no HIGH concern remains (capped at ~3 cycles, with stall detection). Optional; skip it for small or mechanical plans.

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session via subagent-driven-development's `no-subagent-fallback.md`, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**

- **REQUIRED SUB-SKILL:** Use subagent-driven-development
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**

- Use subagent-driven-development (see its `no-subagent-fallback.md` when subagents are unavailable)
- Batch execution with checkpoints for review
