---
name: using-git-worktrees
description: Get an isolated workspace before risky or parallel work. Use when the user says "do not touch main", "run these in parallel", or "use a worktree", or before executing a plan that spans many files. Prefers native harness isolation, falls back to git worktree.
---

# Using Git Worktrees

## Overview

Ensure work happens in an isolated workspace. Prefer your platform's native worktree tools. Fall back to manual git worktrees only when no native tool is available.

**Core principle:** Detect existing isolation first. Then use native tools. Then fall back to git. Never fight the harness.

## Step 0: Detect Existing Isolation

**Before creating anything, check if you are already in an isolated workspace.**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside git submodules. Before concluding "already in a worktree," verify you are not in a submodule:

```bash
# If this returns a path, you're in a submodule, not a worktree — treat as normal repo
git rev-parse --show-superproject-working-tree 2>/dev/null
```

**If `GIT_DIR != GIT_COMMON` (and not a submodule):** You are already in a linked worktree. Skip to Step 2 (baseline). Do NOT create another worktree.

Report with branch state:

- On a branch: "Already in isolated workspace at `<path>` on branch `<name>`."
- Detached HEAD: "Already in isolated workspace at `<path>` (detached HEAD, externally managed). Branch creation needed at finish time."

**If `GIT_DIR == GIT_COMMON` (or in a submodule):** You are in a normal repo checkout.

Has the user already indicated their worktree preference in your instructions? If not, ask for consent before creating a worktree:

> "Would you like me to set up an isolated worktree? It protects your current branch from changes."

Honor any existing declared preference without asking. If the user declines consent, work in place and skip to Step 2.

## Step 1: Create Isolated Workspace

**You have two mechanisms. Try them in this order.**

### 1a. Native Worktree Tools (preferred)

The user has asked for an isolated workspace (Step 0 consent). Do you already have a way to create a worktree? It might be a tool with a name like `EnterWorktree`, `WorktreeCreate`, a `/worktree` command, or a `--worktree` flag. If you do, use it and skip to Step 2.

Native tools handle directory placement, branch creation, and cleanup automatically. Using `git worktree add` when you have a native tool creates phantom state your harness can't see or manage.

Some harnesses also take an isolation option **on the subagent dispatch itself** (e.g. a worktree-isolation parameter on Claude Code's Agent tool). When the isolated work IS a subagent's task — parallel implementers, an isolated experiment — prefer dispatching it straight into its own worktree over creating one by hand: same isolation, and the harness cleans up an unchanged worktree automatically.

Only proceed to Step 1b if you have no native worktree tool available.

### 1b. Git Worktree Fallback

**Only use this if Step 1a does not apply** — you have no native worktree tool available. Create a worktree manually using git.

#### Directory Selection

Follow this priority order. Explicit user preference always beats observed filesystem state.

1. **Check your instructions for a declared worktree directory preference.** If the user has already specified one, use it without asking.

2. **Check for an existing project-local worktree directory:**

   ```bash
   ls -d .worktrees 2>/dev/null     # Preferred (hidden)
   ls -d worktrees 2>/dev/null      # Alternative
   ```

   If found, use it. If both exist, `.worktrees` wins.

3. **Check for an existing global directory:**

   ```bash
   project=$(basename "$(git rev-parse --show-toplevel)")
   ls -d ~/.config/keystone/worktrees/$project 2>/dev/null
   ```

   If found, use it.

4. **If there is no other guidance available**, default to `.worktrees/` at the project root.

#### Safety Verification (project-local directories only)

**MUST verify directory is ignored before creating worktree:**

```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If it isn't ignored:** add it to `.gitignore` and stage that change (leave committing it to
the user), then proceed.

**Why critical:** Prevents accidentally committing worktree contents to repository.

Global directories (`~/.config/keystone/worktrees/`) need no verification.

#### Create the Worktree

```bash
project=$(basename "$(git rev-parse --show-toplevel)")

# Determine path based on chosen location
# For project-local: path="$LOCATION/$BRANCH_NAME"
# For global: path="~/.config/keystone/worktrees/$project/$BRANCH_NAME"

git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

**Sandbox fallback:** If `git worktree add` fails with a permission error (sandbox denial), tell the user the sandbox blocked worktree creation and you're working in the current directory instead. Then run the baseline (Step 2) in place.

## Step 2: Verify a Clean Baseline

A fresh worktree has none of the main checkout's installed dependencies. Install them with the
project's own package manager and lockfile (whatever its README or CI uses), then run its
test command so the workspace starts from a known state:

- **Tests pass:** report `Worktree ready at <full-path> — <N> tests, 0 failures`.
- **Tests fail:** report the failures and ask whether to proceed or investigate. Without a
  green baseline you can't tell new bugs from pre-existing ones.

## Quick Reference

| Situation                      | Action                                             |
| ------------------------------ | -------------------------------------------------- |
| Already in linked worktree     | Skip creation (Step 0)                             |
| In a submodule                 | Treat as normal repo (Step 0 guard)                |
| Native worktree tool available | Use it (Step 1a)                                   |
| No native tool                 | Git worktree fallback (Step 1b)                    |
| Both `.worktrees/` and `worktrees/` exist | Use `.worktrees/`                       |
| Neither exists                 | Check instruction file, then default `.worktrees/` |
| Directory not ignored          | Add to `.gitignore` and stage it                   |
| Permission error on create     | Sandbox fallback, work in place                    |
| Tests fail during baseline     | Report failures + ask                              |

## Red Flags

- Creating a worktree when Step 0 detects existing isolation (nested worktrees)
- Using `git worktree add` when you have a native worktree tool (e.g. `EnterWorktree`) — the
  harness can't see or clean up what you made by hand
- Creating a project-local worktree without verifying it's ignored
- Skipping the baseline, or proceeding past a failing one without asking
