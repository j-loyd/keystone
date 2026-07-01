# <Feature> Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or
> executing-plans to implement this plan task-by-task. This is the **folder-plan overview** — each
> `phase-N-<name>.md` is itself a task-based plan.

**Level:** <light | medium | heavy — see writing-plans/plan-levels.md; default medium>

**Goal:** <one sentence: what this builds>

**Architecture:** <2-3 sentences on the approach>

**Tech Stack:** <key technologies/libraries>

**Dependency check:** <N/A, or name each deceptive-complexity package + how existence was confirmed>

---

## Phase index

| Phase               | Risk (max task) | Lands in     | Status  |
| ------------------- | --------------- | ------------ | ------- |
| `phase-1-<name>.md` | <low/med/high>  | <files/area> | <state> |
| `phase-2-<name>.md` | <low/med/high>  | <files/area> | <state> |

Use a folder (this layout) when the work has ~3+ phases or spans multiple subsystems; otherwise a
single `YYYY-MM-DD-<feature>.md` file is enough.

## Verification (whole plan)

- <cross-phase wiring checks — the thing exists AND is called>
- <budgets / invariants that must hold across phases>

## Revision log

- <YYYY-MM-DD> — plan authored.
