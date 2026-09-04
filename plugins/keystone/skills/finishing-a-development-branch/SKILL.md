---
name: finishing-a-development-branch
description: Decide how to land completed work — merge, PR, or discard. Use when implementation is done and tests pass, and when the user says "ready to merge", "open a PR", or "clean up this branch". Presents options and never commits or pushes on its own.
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Detect environment → Present options → Execute choice → Clean up.

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**If tests fail:**

```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Detect Environment

**Determine workspace state before presenting options:**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

This determines which menu to show and how cleanup works:

| State                                  | Menu                         | Cleanup                         |
| -------------------------------------- | ---------------------------- | ------------------------------- |
| `GIT_DIR == GIT_COMMON` (normal repo)  | Standard 4 options           | No worktree to clean up         |
| `GIT_DIR != GIT_COMMON`, named branch  | Standard 4 options           | Provenance-based (see Step 6)   |
| `GIT_DIR != GIT_COMMON`, detached HEAD | Reduced 3 options (no merge) | No cleanup (externally managed) |

### Step 3: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main - is that correct?"

### Step 4: Present Options

**Normal repo and named-branch worktree — present exactly these 4 options:**

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Detached HEAD — present exactly these 3 options:**

```
Implementation complete. You're on a detached HEAD (externally managed workspace).

1. Push as new branch and create a Pull Request
2. Keep as-is (I'll handle it later)
3. Discard this work

Which option?
```

**Don't add explanation** - keep options concise.

### Step 5: Execute Choice

#### Option 1: Merge Locally

```bash
# Get main repo root for CWD safety
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"

# Merge first — verify success before removing anything
git checkout <base-branch>
git pull
git merge <feature-branch>

# Verify tests on merged result
<test command>

# Only after merge succeeds: cleanup worktree (Step 6), then delete branch
```

Then: Cleanup worktree (Step 6), then delete branch:

```bash
git branch -d <feature-branch>
```

#### Option 2: Push and Create PR

```bash
# Push branch
git push -u origin <feature-branch>

# Create PR
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

**Do NOT clean up worktree** — user needs it alive to iterate on PR feedback.

#### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree.**

#### Option 4: Discard

**Confirm first:**

```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed:

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
```

Then: Cleanup worktree (Step 6), then force-delete branch:

```bash
git branch -D <feature-branch>
```

### Step 6: Cleanup Workspace

**Only runs for Options 1 and 4.** Options 2 and 3 always preserve the worktree.

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

**If `GIT_DIR == GIT_COMMON`:** Normal repo, no worktree to clean up. Done.

**If worktree path is under `.worktrees/`, `worktrees/`, or `~/.config/keystone/worktrees/`:** keystone created this worktree — we own cleanup.

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git worktree remove "$WORKTREE_PATH"
git worktree prune  # Self-healing: clean up any stale registrations
```

**Otherwise:** The host environment (harness) owns this workspace. Do NOT remove it. If your platform provides a workspace-exit tool, use it. Otherwise, leave the workspace in place.

### Step 7: Retire the run-state (subagent-driven-development runs only)

**Skip this step for non-run work** — a plain `/handoff` note is disposable and is already marked
`resumed` by `/pickup`; it needs no retirement.

If this work executed a `subagent-driven-development` run, its run-state file
(`docs/plans/<plan>/RUN-STATE.md` or `docs/plans/<plan>.run-state.md`) has now served its purpose.
A completed run-state that lingers will **shadow every newer `/handoff`** at `/pickup` time, since
`/pickup` weighs a run-state ahead of a freeform note. So on completion, retire it:

1. **Tally the gates before you retire the file.** Read the `Gates:` line of every task's
   summary block and print the run's totals — for each gate, how many tasks it ran on and what
   it returned. Any gate that ran on 3+ tasks and returned **PASS on every one** caught nothing
   this run: offer a one-tap `/learn` entry recording that (`gate X: N runs, 0 findings, run
   <plan>`), so the evidence accumulates across runs instead of dying with the file. A gate that
   has never failed anything is theater; this is the only place keystone can notice. Don't
   editorialize beyond the counts — one run is a data point, not a verdict.

   Two exclusions keep the tally from arguing for something dangerous: a **security or
   safety-surface gate (Sage) is never a deletion candidate on a clean record** — a clean
   security review is the *expected* outcome, not evidence the seat was idle — and **the last
   remaining gate at a tier is out of scope**, because a tier with no gate isn't a cut, it's an
   unreviewed tier. If the run had **no run-state file** (optional on short runs, absent at
   Light), skip the tally and say so rather than inventing counts.
2. **Archive or delete the run-state file** so it is no longer discoverable as live work:
   - Options 1–2 (Merge / PR): move it with the plan — `git mv` it into `docs/plans/archive/`
     (or delete it; git retains the history).
   - Option 4 (Discard): delete it alongside the discarded work.
   - Option 3 (Keep as-is): only if the run is genuinely finished — otherwise leave it live.
3. **Clear its row from the continuity index** `docs/handoffs/README.md`: remove the run's entry
   from the **Active run-state** table (or mark it `superseded`). This is what guarantees a
   completed run can never shadow a newer handoff note.

## Going deeper

- [`reference.md`](reference.md) — command quick-reference, common mistakes, and the red
  flags that mean the branch is not actually ready to land.

## If the merge conflicts

Use `resolving-merge-conflicts`. Don't resolve hunks ad hoc from here — a bad resolution
passes tests and silently drops work.
