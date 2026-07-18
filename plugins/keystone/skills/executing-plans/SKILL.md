---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** This skill works much better with access to subagents — quality is significantly higher on a platform with subagent support. If subagents are available, use subagent-driven-development instead of this skill.

## The Process

### Step 1: Load and Review Plan

1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Tasks

For each task:

1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Complete Development

After all tasks complete and verified:

- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## Handling deviations (auto-fix vs ask vs defer)

Plans meet reality. When you hit something the plan didn't anticipate, don't silently expand scope and don't stop dead — triage it with one question: **does this affect correctness, security, or your ability to complete the task?**

- **YES → fix it now.** Real bugs, missing validation on something you're touching, and blockers that stop the task are in-scope. Fix, verify, note it in your report.
- **MAYBE / it's a judgment call → ask.** Anything with a blast radius beyond the task: a new DB table or migration, swapping or adding a dependency, changing a shared interface, or expanding scope. Surface the choice; don't decide unilaterally.
- **NO → note and defer.** Tangential improvements, "while I'm here" refactors, unrelated debt. Record them (a `/learn` candidate) and move on. Resist the "while I'm here" reflex — it's how scope creep and unrelated breakage get in. One carve-out: a **boy-scout cleanup** in lines you're already editing (a misleading name, a magic number, code your diff orphaned — seconds of work, zero blast radius) is part of doing the task well; do it and mention it in the report (`coding-standards` has the three-part boundary).

This replaces the old binary of "execute or stop": most deviations are a fix or a deferral, and only the genuinely consequential ones need to interrupt you.

## When to Stop and Ask for Help

**STOP executing immediately when:**

- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

**But don't offload work you can do yourself.** Before asking the human to run a command, edit a file, fetch a value, or perform a step, check whether you can do it via the tools available (CLI, API, file edits). "Stop and ask" is for genuine blockers and judgment calls — missing context, ambiguous intent, consequential decisions — not for handing back automatable mechanics. Asking the human to be your terminal is friction, not diligence. (Exception: a step that genuinely needs them — an interactive login, a secret you don't have, a physical/account action — which you should name explicitly.)

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
