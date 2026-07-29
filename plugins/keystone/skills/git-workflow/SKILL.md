---
name: git-workflow
description: Branch-naming and commit-message conventions for this kit — feat/fix/chore prefixes, conventional-commit messages, and when to branch. Use when creating a branch, writing a commit message, or starting a unit of work in a git repo.
---

# Git workflow conventions

Keystone's baseline for branches and commits. Pairs with `using-git-worktrees` (isolate
work), `/ship` (prepare to ship), and `finishing-a-development-branch` (integrate).

> **No auto-commits:** these are the conventions to _follow_ when you
> commit — they do not authorize committing. Stage freely; commit/push only when the user
> explicitly asks.

## Branch naming

`<type>/<short-kebab-summary>` — optionally `<type>/<ticket>-<summary>`.

| Type        | For                                              | Example                     |
| ----------- | ------------------------------------------------ | --------------------------- |
| `feat/`     | a new capability                                 | `feat/learnings-hook`       |
| `fix/`      | a bug fix                                        | `fix/guard-relative-path`   |
| `chore/`    | tooling, deps, config, non-shipping housekeeping | `chore/bump-prettier`       |
| `docs/`     | docs only                                        | `docs/readme-install`       |
| `refactor/` | behavior-preserving restructuring                | `refactor/extract-repo-key` |
| `test/`     | tests only                                       | `test/freeze-coverage`      |

Rules:

- **Never work directly on `main`/`master`.** If you're on it when work starts, branch first.
- Keep summaries short, lowercase, kebab-case. Prefix with the Linear/issue id when one exists.

## Commit messages (Conventional Commits)

```
<type>(<optional scope>): <imperative summary, ≤ ~72 chars>

<body: what & why, not how — wrap ~72 cols. Optional.>

<footer: BREAKING CHANGE: …, or Refs ABC-123. Optional.>
```

- Same `type` vocabulary as branches (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`,
  plus `perf`, `build`, `ci`).
- Summary in the imperative ("add", not "added"/"adds"). No trailing period.
- `feat:` / `fix:` map to minor / patch bumps; mark breaking changes with `!` after the
  type or a `BREAKING CHANGE:` footer.
- One logical change per commit. If a message needs "and", it's probably two commits.

## When to branch

Branch per unit of shippable work (mirrors how `/to-issues` slices). Long-lived or risky
work → use a worktree (`using-git-worktrees`) so it's isolated from the current workspace.

## Conflicts

When a merge or rebase stops with conflicts, use `resolving-merge-conflicts` — resolving by
intent rather than by picking a side, and finishing the operation rather than leaving the
repo mid-merge.
