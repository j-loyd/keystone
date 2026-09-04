# Plan Levels

Every run is `SPEC → MIDDLE → EXECUTE`. At kickoff the user sets an **effort level** — Light,
Medium, or Heavy — that composes _which_ steps fire at each stage. **Propose the lowest band the
observed signals allow** (rubric below) rather than defaulting to Medium, and name the signal
that set it; the user confirms or overrides in a word. Where nothing is known yet, Medium is the
fallback. The level is
**one word in the plan header**, an effort floor declared once; it is never parsed as control
flow, never re-prompted per task, never a status enum.

## The three ladders

| Stage                  | Light                                                              | Medium                                                                                                                                      | Heavy                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Spec**               | inline one-liner, no sharpening                                    | clarify only if fuzzy                                                                                                                       | mandatory sharpening (`office-hours` and/or `grill-with-docs`; `llm-security` + `designing-agent-systems` if LLM/agent work; `research-notes` for novel domains)  |
| **Middle (plan)**      | minimal task list, LOW/MED tags, no Verified-behavior, no reviewer | full `writing-plans` (tasks + Risk tags + Verified-behavior + File Structure + lock-decisions + Self-Review; optional single reviewer pass) | folder plan (`plan.md` + `phase-N`); Self-Review + bounded `plan-convergence-loop` (≤3 cycles); `plan-eng-review`/`plan-ceo-review`; ADRs for locked architecture |
| **Execute (mode)**     | subagent-driven (LOW gates)                                        | subagent-driven                                                                                                                             | subagent-driven + `using-git-worktrees`                                                                                                                           |
| **Execute (gates)**    | LOW-tier default — see Rigor Scales to Risk                        | MED-tier default — see Rigor Scales to Risk                                                                                                 | HIGH-tier default — see Rigor Scales to Risk                                                                                                                      |
| **Execute (scaffold)** | none (in-context)                                                  | run-state (resumable, `/pickup`)                                                                                                            | run-state + run-manifest + per-task summary spillover                                                                                                             |
| **Fits**               | small, reversible, leaf/1-file                                     | real feature, bounded blast radius                                                                                                          | multi-subsystem, high-risk, hard-to-reverse                                                                                                                       |

Subagent-driven execution is the **default at every level**; inline/direct is the narrow
exception, only for a genuinely trivial single-edit change.

A level sets **defaults**. An individual task's Risk tag can still escalate its own gates above
the run default — **ceiling, not average, wins per task**. Gate definitions live in exactly one
place: `subagent-driven-development/SKILL.md`, the **Rigor Scales to Risk** section. The
Execute-gates row above names only the default tier (LOW / MED / HIGH) and **points** there — it
never restates the crew or the gate steps, so there is no second copy to drift.

## Observed-level rubric

Alongside the _declared_ level, compute the level the work **implies** from checkable signals,
not feel:

- **task count**
- **# of HIGH / MED Risk tags**
- **# subsystems / files touched**
- **safety-surface present** — the six signals: auth / secrets / money / deletion / irreversible
  / external-facing `[Source: writing-plans/SKILL.md:144]`
- **novel-domain / research need**
- **reversibility**

Rough bands:

- **Heavy** if ANY safety surface, OR ≥2 HIGH tags, OR ≥3 subsystems.
- **Light** only if all-LOW + single file + reversible.
- **Medium** otherwise.

These bands set the **proposed** level at the front door and guide the **challenge** below.
Neither is an auto-override: the user's word wins, and the delta policy's one blocking trigger
is the only place the run stops on its own.

## Delta-callback policy

At plan-finalization, compare declared vs observed:

- **observed > declared (under-scoped)** ⇒ **advisory** challenge: name the signals, recommend
  the higher level, then proceed at the declared level unless the user re-levels.
- **the delta crosses a reversibility/security line** — specifically: declared Light/Medium AND
  any safety-surface signal `[Source: writing-plans/SKILL.md:144]` is present ⇒ **blocking**:
  stop and reconfirm before execution. This is the **one** blocking trigger; everything else is
  advisory.
- **observed < declared (over-scoped)** ⇒ a one-line note, never blocking.

## Additive-and-ignorable invariant (load-bearing)

> **A resume at any level requires only the run-state task log; the manifest, research notes,
> and per-task summaries are enrichment a resume may use but never needs.**

`[Source: subagent-driven-development/run-state-format.md]`. Deepening is **monotonic** — pick a
floor, deepen mid-run if the work demands it, never silently downgrade.

## What it is NOT

- **Not a status machine** — one word in a header, not a phase/status enum any tool transitions.
- **Light is not a new tax** — it is _cheaper_ than Medium, not extra ceremony. Small,
  reversible, single-file work should land there, and proposing it is the point of the rubric.
- **One knob, declared once** — no per-task re-prompt for the level.
