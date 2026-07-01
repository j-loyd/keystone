# Parallel Waves (opt-in)

Wave-based parallel execution cuts wall-clock on large plans by running independent,
isolated tasks concurrently. It is an **optimization you opt into — never the fallback.**
The default is **sequential**.

## Precondition — the safety gate (read this first)

Parallel dispatch is allowed **ONLY when BOTH hold**:

- **(a) Independent:** the plan marks the tasks independent (no ordering/data dependency).
- **(b) Isolated:** EITHER **disjoint file sets** (no two tasks touch the same file) OR
  **each task runs in its own worktree** (see `using-git-worktrees`).

If isolation **cannot be proven, run sequentially.** No exceptions — the conflict risk is
real and silent. When in doubt, sequential.

## Grouping

Partition the independent tasks into **waves**. Every task within a wave is mutually
independent; any task that depends on another task's output goes in a **later wave**.

## Dispatch + barrier

- Dispatch a wave's implementers **concurrently**, each with its **own full handoff packet**.
- **Wait for the entire wave to finish (barrier)** before starting the next wave.
- **Review every task's output at its own Risk tier** — waves do **NOT** skip gates.
- On any **conflict signal** (overlapping edits, merge clash), **fall back to sequential**
  for that wave.

## When NOT to wave

- Tightly-coupled tasks, or any shared-file edits.
- A short plan (≤3 tasks) — coordination overhead isn't worth it.
- No worktree support and file sets aren't provably disjoint.

Scale to plan size, like everything else in this skill.
