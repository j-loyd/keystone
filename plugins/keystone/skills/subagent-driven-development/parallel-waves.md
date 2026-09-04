# Parallel Waves (opt-in)

Wave-based parallel execution cuts wall-clock on large plans by running independent,
isolated tasks concurrently. It is an **optimization you opt into — never the fallback.**
The default is **sequential**.

## Precondition — the safety gate (read this first)

Parallel dispatch is allowed **ONLY when BOTH hold**:

- **(a) Independent:** the plan marks the tasks independent (no ordering/data dependency).
- **(b) Isolated:** EITHER **disjoint file sets** (no two tasks touch the same file) OR
  **each task runs in its own worktree** (see `using-git-worktrees`; where the dispatch
  primitive itself takes a worktree-isolation option, dispatching each task into its own
  worktree is the cheapest way to satisfy this).

If isolation **cannot be proven, run sequentially.** No exceptions — the conflict risk is
real and silent. When in doubt, sequential.

## Needs coordination — earning parallelism on a coupled pair

Between "safe to parallelize" and "must be sequential" sits a third case: tasks coupled **only**
through an interface they share — a type, a schema, an endpoint contract. Those can be waved, but
the parallelism has to be earned first:

1. **Define the contract as its own step**, in an earlier wave or sequentially before any wave.
   One task, one owner — the provider side of the interface.
2. With the contract written and staged, its consumers are genuinely independent: they build
   against a fixed shape instead of negotiating one mid-flight.
3. **Then re-run the gate above.** Contract-first satisfies (a) in substance; it does not
   excuse (b) — the consumer tasks still need disjoint file sets or their own worktrees.

If the contract can't be pinned down before the work starts, the coupling is real and the tasks
are sequential. Speculating a shared interface and reconciling later is how one wave produces two
incompatible halves.

## Grouping

Partition the independent units into **waves**. The unit is a **slice** (`SKILL.md`, "Why fresh
context") — often a single task, since one-per-dispatch is what disjoint tasks earn. Every unit
in a wave is mutually independent; anything depending on another's output goes in a **later
wave**. Where a slice holds several tasks, the isolation gate applies to the **union** of its
files.

## Dispatch + barrier

- Dispatch a wave's implementers **concurrently** — in one turn, each with its **own full
  handoff packet**.
- **Don't idle during the wave.** Gates are per task and don't depend on siblings: run the
  task's tier gates on whichever unit returns first while the rest are still working, and build
  the next wave's packets in the gaps. Wait explicitly only when the next step needs a result that
  hasn't landed.
- **The barrier is for the next wave's _dispatch_, not for the gates.** Start wave N+1's
  implementers only once every wave-N task has returned and cleared its gates — a wave-N+1
  task may depend on any of them.
- **Review every task's output at its own Risk tier** — waves do **NOT** skip gates.
- On any **conflict signal** (overlapping edits, merge clash), **fall back to sequential**
  for that wave.

## When NOT to wave

- Tightly-coupled tasks — coupled beyond a single shared interface (see *Needs
  coordination*) — or any shared-file edits.
- A short plan (≤3 tasks) — coordination overhead isn't worth it.
- No worktree support and file sets aren't provably disjoint.

Scale to plan size, like everything else in this skill.
