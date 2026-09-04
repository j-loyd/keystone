# Executing a plan without subagents

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Use this file only when subagent dispatch is unavailable** (a harness without it, or a run
where isolation isn't worth it). With subagents, the main `SKILL.md` loop is strictly better —
isolated context per slice is the whole point. Everything here is the same loop, collapsed into
one window, with gates still run per task at each task's Risk tier.

## The Process

### Step 1: Load and Review Plan

1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with the user before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Tasks

For each task:

1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Complete Development

After all tasks complete and verified:

- Use `finishing-a-development-branch` to verify tests, present the landing options, and
  execute the choice.

## Handling deviations

Same triage as the main loop — see **Handling deviations** in `SKILL.md`.

## When to Stop and Ask for Help

**STOP executing immediately when:**

- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

See **Don't offload what you can do yourself** in `SKILL.md`.

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**

- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember

- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**

- **using-git-worktrees** - Ensures isolated workspace (creates one or verifies existing)
- **writing-plans** - Creates the plan this skill executes
- **finishing-a-development-branch** - Complete development after all tasks
