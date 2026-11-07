---
name: finishing-a-development-branch
description: Decide how to land completed work — merge, PR, or discard. Use when implementation is done and tests pass, and when the user says "ready to merge", "open a PR", or "clean up this branch". Presents options and never commits or pushes on its own.
---

# Finishing a Development Branch

**Core principle:** verify tests → detect the workspace → present options → execute the choice
→ clean up only what you own.

### Step 1: Verify tests, detect the workspace

Run the project's test suite first (`verification-before-completion` — read the whole output).
Failing → show the failures and stop; don't offer merge or PR on a red suite.

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
MAIN_ROOT=$(git -C "$GIT_COMMON/.." rev-parse --show-toplevel)
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null  # base branch
```

| State                                  | Menu                         | Cleanup                         |
| -------------------------------------- | ---------------------------- | ------------------------------- |
| `GIT_DIR == GIT_COMMON` (normal repo)  | 4 options                    | No worktree to clean up         |
| `GIT_DIR != GIT_COMMON`, named branch  | 4 options                    | Ownership check (Step 4)        |
| `GIT_DIR != GIT_COMMON`, detached HEAD | 3 options (no local merge)   | None (externally managed)       |

### Step 2: Present exactly these options

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work
```

On a detached HEAD, drop option 1 (option 2 becomes "push as a new branch and open a PR").
Keep the options terse; don't add explanation. Nothing here runs until the user picks.

### Step 3: Execute the choice

**Option 1 — merge locally.** Where the merge happens depends on the workspace:

- **Normal repo** (`GIT_DIR == GIT_COMMON`): this checkout is the session's own. With a clean
  tree, `git switch <base-branch>`, `git pull`, `git merge <feature-branch>`, run the test suite
  on the merged result, then `git branch -d <feature-branch>`.
- **Worktree:** the merge happens in the main checkout, which belongs to the user. Address it
  with `git -C "$MAIN_ROOT"` rather than `cd` — under native worktree isolation the session may
  not be allowed to leave its worktree, and a `cd` there doesn't persist reliably. Before
  touching it, check the main checkout is **clean and already on the base branch**
  (`git -C "$MAIN_ROOT" status --porcelain` empty, `branch --show-current` = base). If either
  fails, stop and ask — never check out a different branch over someone's work-in-progress.

  ```bash
  git -C "$MAIN_ROOT" pull
  git -C "$MAIN_ROOT" merge <feature-branch>
  # run the test suite in $MAIN_ROOT on the merged result; only then clean up (Step 4)
  git -C "$MAIN_ROOT" branch -d <feature-branch>   # only once the worktree is removed
  ```

**Option 2 — push and open a PR.** `git push -u origin <feature-branch>`, then
`gh pr create` with a summary and a test plan. **Keep the worktree** — the user needs it to
iterate on review feedback.

**Option 3 — keep as-is.** Report the branch and worktree path. Touch nothing.

**Option 4 — discard. Confirm first:**

```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for the exact word. Then: in a normal repo, `git switch <base-branch>` first (git won't
delete the checked-out branch); in a worktree, clean up (Step 4). Then
`git -C "$MAIN_ROOT" branch -D <feature-branch>`.

### Step 4: Clean up only what you own (options 1 and 4)

Options 2 and 3 always preserve the worktree. For 1 and 4:

- **`GIT_DIR == GIT_COMMON`:** normal repo, no worktree to clean up.
- **Worktree under `.worktrees/`, `worktrees/`, or `~/.config/keystone/worktrees/`:** keystone
  created it, so keystone owns cleanup. Remove it from outside itself, then delete the branch
  (a branch still checked out in a worktree can't be deleted):

  ```bash
  git -C "$MAIN_ROOT" worktree remove "$(git rev-parse --show-toplevel)"
  git -C "$MAIN_ROOT" worktree prune
  ```

- **Anywhere else:** the harness owns this workspace. Do **not** remove it — use the platform's
  workspace-exit tool if it has one, otherwise leave it in place. The feature branch is still
  checked out there, so skip the branch deletion and say so (or let the workspace exit do it).

## Red flags

- Merging or opening a PR on a failing suite, or skipping the test run on the merged result
- Deleting work without the typed `discard` confirmation
- Checking out a branch in the main checkout over uncommitted work
- Removing a worktree before the merge is confirmed, or one you didn't create
- Force-pushing without an explicit request

## If the merge conflicts

Use `resolving-merge-conflicts`. Don't resolve hunks ad hoc from here — a bad resolution
passes tests and silently drops work.
