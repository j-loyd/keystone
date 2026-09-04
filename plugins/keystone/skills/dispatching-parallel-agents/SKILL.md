---
name: dispatching-parallel-agents
description: Decide inline vs. subagent vs. multi-agent orchestration, then dispatch well. Use when facing 2+ independent tasks, and when the user says "do these in parallel", "fan these out to subagents", or "is this worth delegating". Covers self-contained context packets, token cost, and cross-harness fallbacks. Distinct from designing-agent-systems, which designs the system — this one runs the dispatch.
---

# Dispatching Parallel Agents

## Overview

You delegate tasks to specialized agents with isolated context. By precisely crafting their instructions and context, you ensure they stay focused and succeed at their task. They should never inherit your session's context or history — you construct exactly what they need. This also preserves your own context for coordination work.

When you have multiple unrelated failures (different test files, different subsystems, different bugs), investigating them sequentially wastes time. Each investigation is independent and can happen in parallel.

**Core principle:** Dispatch one agent per independent problem domain. Let them work concurrently.

## Escalation ladder: inline → delegate → orchestrate

Match the machinery to the work. Most tasks don't need agents at all; reach up the ladder only
when the rung below can't carry the job.

| Reach for                                                    | When                                                                                                                                                                                                                                                    | Cost                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Inline / direct**                                          | anything you can finish in a handful of tool calls — a fact, an edit, a targeted search. Reading the file yourself is cheaper than briefing someone to read it for you                                                                                 | ~free                       |
| **One subagent**                                             | a bounded task whose _read volume_ would swamp your window (a wide sweep, a long investigation) — you want the conclusion, not the file dumps. One agent, not several, whenever one can do it                                                            | one agent                   |
| **Orchestrated workflow** (deterministic fan-out / pipeline) | the work is genuinely **broad** (sweep many files/sources), needs **confidence** (independent perspectives + adversarial verification before you commit), or **exceeds one context** (migration, audit, large refactor) — **and the user has opted in** | many agents — be deliberate |

A workflow is only as good as its **decomposition** and its **verification stage**. If you can't
say what fans out and what checks it, you're not ready to launch one — scout inline first to
discover the work-list, then orchestrate over it.

## Is a workflow worth the tokens?

Orchestration is leverage, not a default — it can spend many agents' worth of tokens in one go.
Be thoughtful:

- **Opt-in, never inferred.** Launch a multi-agent workflow only when the user asked for that
  scale, a command/skill dispatched it, or they named one. A task that would merely _benefit_ from
  parallelism doesn't qualify — describe the option and the rough cost, and ask.
- **Scale rigor to the ask.** "Find any bugs" → a few finders + single-vote verify. "Exhaustively
  audit" → a larger pool + a 3–5-vote adversarial pass + synthesis. Don't apply max ceremony to a
  quick check.
- **Estimate before you spend.** Budget `agents × (task tokens + per-agent cold start)` —
  each dispatched agent re-pays its own system prompt and tool definitions every turn, so
  real fan-out overhead runs closer to ~4x for even a two-agent split, not the naive 2x
  (`designing-agent-systems` has the loop-cost mechanics). If it's large, say so.
- **Never spawn a seat to settle what a command settles.** A verify seat is _judgment_ on an
  artifact — a reviewer on a diff, a skeptic on a design, including one **you** authored — and
  it earns its cost by bringing blind spots the author doesn't have (`harness-notes.md`;
  `adversarial-review` is exactly this pass on your own document). A seat to confirm a **fact**
  — the tests pass, the file exists, the grep is empty — buys nothing the command doesn't and
  compounds with the checking you already do. Run the command.
- **Keep spawn counts low, and cap them deterministically where you can.** A prompt line
  saying "few agents" is a wish; a harness limit on spawn depth, concurrency, or spend is a
  control, and it still holds when a worker spawns workers of its own (`harness-notes.md`).

## Batch what's independent — tool calls and dispatches alike

Before each turn, privately list what you need next; then request every item that doesn't
depend on another's result in that one response — file reads, greps, test runs, and worker
dispatches together. This matters most in coding loops, where the next calls are _implied_ by
the task rather than named by anyone: that is exactly where a model drifts to one call per
turn, and every extra turn is a round trip, a re-sent context, and wall-clock the user waits
through. Dispatch on the same rule — launch every independent worker before waiting on any.

## Don't idle while workers run

Carrying the baton is not the same as standing still. When the dispatch primitive returns
immediately (workers run in the background and their results arrive later), keep doing the
work that doesn't depend on the result: build the next packet, scout the next domain, run the
gate on whichever result has already landed. Wait only at the point where the next step
genuinely needs an outstanding result — and wait explicitly, through the harness's wait
primitive, not by polling. On coding work this lowers time-to-completion at similar quality
and token cost. When nothing independent is left, waiting is the right call; the savings come
from the turns where something was.

## Read-heavy fans out; write-heavy stays serialized (or isolated)

The industry's multi-agent debate settled on an asymmetry, not a winner:

- **Read-heavy work parallelizes beautifully** — research, review, search, parallel
  hypothesis testing. Independent readers can't corrupt shared state, and their findings
  merge cheaply. This is where fan-out earns its tokens.
- **Write-heavy work punishes naive parallelism** — concurrent editors on shared state
  conflict and interfere. Parallel writers need **provable isolation** (disjoint file sets,
  or a worktree/sandbox per agent — the vendor-converged default for parallel coding
  agents) or they run sequentially. One writer at a time isn't a limitation; it's the cheap
  correctness guarantee.
- **Entangled reasoning doesn't decompose.** At a fixed total token budget, one agent beats
  a committee on tightly-coupled reasoning — coordination overhead eats the budget the
  reasoning needed. Fan out for breadth and wall-clock, never expecting the split itself to
  add intelligence.

Peers reporting to a coordinator beat peers chatting freely: the orchestrator-mediated
shape — you carry the baton; workers return **compressed results (a ~1–2k-token summary,
not a transcript)** — is the converged production pattern. Where the dispatch primitive
supports schema-constrained returns, use them: parsing prose out of a worker's reply is a
failure mode you can simply delete.

## When to Use

```dot
digraph when_to_use {
    "Multiple failures?" [shape=diamond];
    "Are they independent?" [shape=diamond];
    "Single agent investigates all" [shape=box];
    "One agent per problem domain" [shape=box];
    "Can they work in parallel?" [shape=diamond];
    "Sequential agents" [shape=box];
    "Parallel dispatch" [shape=box];

    "Multiple failures?" -> "Are they independent?" [label="yes"];
    "Are they independent?" -> "Single agent investigates all" [label="no - related"];
    "Are they independent?" -> "Can they work in parallel?" [label="yes"];
    "Can they work in parallel?" -> "Parallel dispatch" [label="yes"];
    "Can they work in parallel?" -> "Sequential agents" [label="no - shared state"];
}
```

**Use when:**

- 3+ test files failing with different root causes
- Multiple subsystems broken independently
- Each problem can be understood without context from others
- No shared state between investigations

**Don't use when:**

- Failures are related (fix one might fix others)
- Need to understand full system state
- Agents would interfere with each other

## When NOT to Use

**Related failures:** Fixing one might fix others - investigate together first
**Need full context:** Understanding requires seeing entire system
**Exploratory debugging:** You don't know what's broken yet
**Shared state:** Agents would interfere (editing same files, using same resources)

## Going deeper

- [`patterns.md`](patterns.md) — the dispatch pattern, context-packet structure, a worked
  example, and how to verify what came back. Read before your first dispatch of a run.
- [`harness-notes.md`](harness-notes.md) — what each harness gives you and the graceful
  degradation path when a primitive is missing.
