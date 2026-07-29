---
name: designing-agent-systems
description: Decide the shape of anything agent-shaped before building it — LLM tool loops, subagent dispatch, orchestration topology, HITL gates, effort and budget. Use when the user says "should I use an agent", "one agent or many", or "orchestrator", or when agent code is about to be written with no design note. Harness-neutral doctrine — load it early, before code and before plans.
---

# Designing Agent Systems

An agent is a **model plus a harness** — and on anything longer than a few turns, the harness
(what enters context, what verifies, when it stops, what persists) moves the outcome more than
prompt wording. Design the harness deliberately, keep it as small as the task allows, and write
the design note before any code encodes the guesses.

**The over-engineering check runs first and throughout.** Agent systems are where AI-built
software over-engineers hardest: agents that a function should be, crews that one agent should
be, gates that verify nothing. At every step below, apply the deletion test — _what breaks
without this piece?_ If the answer is "nothing concrete," it doesn't go in.

## Workflow (don't skip)

1. Answer the **two prior questions**. If either fails, you're done — no agent / no crew.
2. Choose the **loop and topology** from the vocabulary below, smallest that fits.
3. Write the **design note** (template at the end). The note is this skill's deliverable.
4. Only after the note is accepted: plan or code.

Shortcut: a one-line tweak to an existing agent skips this skill.

## Prior question 1 — is this an agent problem at all?

**Deterministic-first.** If a filter, regex, lookup, rule, or plain function covers 80% of it,
build that; use a model only for the residual. An agent is justified when **all four** hold:

1. Input is genuinely ambiguous or open-ended (no enumerable rule covers it)
2. The task benefits from tool use or reasoning over retrieved context
3. Task value clears the token/latency/failure-mode overhead vs. the deterministic version
4. A deterministic alternative was actually considered and rejected **with reasons**

**Red flag:** "the agent will figure it out" → constrain it or don't build it.

## Prior question 2 — one agent or many?

Default to **one**. The multi-agent question resolved into an asymmetry, not a winner
(`dispatching-parallel-agents` has the full treatment):

- **Fan out** when work is read-heavy and decomposes into genuinely independent threads
  (research, review, parallel search) — the win is breadth and wall-clock.
- **Don't fan out** entangled reasoning or write-heavy shared state: at a fixed token budget a
  single agent beats a committee on coupled work, and parallel writers need provable isolation
  (worktree/sandbox each) or they serialize.
- **Every seat must earn its coordination cost.** Multi-agent runs multiply spend
  (each agent re-pays system prompt + tools per turn — ~4x for even a two-way split); a seat
  that doesn't demonstrably add breadth, isolation, or independent judgment is over-engineering.
- Topology need not be fixed at design time — modern harnesses let the running agent compose
  orchestration (fan-out, pipelines) at runtime. Design the _gate_ ("what justifies spawning?")
  rather than hardcoding the org chart.

## The topology vocabulary (pick the smallest that fits)

| Shape                                     | Use for                                                         | Watch out                                                                          |
| ----------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Single agent + tools**                  | most things; the default                                        | too many tools degrades routing — prune or defer-load                              |
| **Deterministic backbone, agentic nodes** | production pipelines needing guarantees/observability           | build cost; keep nodes small                                                       |
| **Orchestrator → workers**                | independent parallel threads; results return compressed         | orchestrator context is precious — workers return summaries, not transcripts       |
| **Adversarial verify seat**               | anything consequential enough to check                          | verifier needs fresh context; same-context self-review shares the same blind spots |
| **Tournament**                            | one-way-door decisions — N genuinely different attempts, judged | expensive; routine work never needs it                                             |
| **Peer team (agents that discuss)**       | rare: members must genuinely negotiate/challenge                | costliest, least predictable; a handful of members max                             |

Orchestrator-mediated beats free-form peer chat in production. Workers are ephemeral, get
fresh isolated context, and return **compressed, ideally schema-constrained results**.

## Scoping any dispatched agent — the four-item recipe

Every dispatch prompt states: **objective** (specific outcome, not a domain), **output format**
(exact shape), **tool guidance** (which, preferred order), **boundaries** (explicitly out of
scope). Vague scoping is the top measured failure source in multi-agent systems — workers
duplicate, gap, and drift. Effort belongs in the prompt too (rough tool-call/token budget per
worker), not left to worker judgment.

## The harness layers — what you're actually designing

For each layer, decide something or consciously default it:

1. **Tool surface** — few, purposeful, well-described tools beat API mirrors; specialized
   beats generic; typed inputs; a terminal signal so loops can end. Past ~10 tools, prefer
   deferred loading/tool search over stuffing every schema into context.
2. **Context & memory** — curate the smallest high-signal set. Quality decays with raw length
   (context rot) even before the window fills; fresh-context workers and periodic resets are
   structural fixes, not just cost tricks. Durable state lives in files the agent reads at
   start and writes at end (`long-running-agents` owns the loop-side discipline).
3. **Verification** — the bottleneck is verifying, not generating. Verification runs _during_
   execution (fail fast), structurally separated from generation (fresh context; different
   model where stakes warrant), against **binary, machine-checkable criteria** where possible.
   A model grading its own output in-context is decoration, not verification.
4. **Guardrails** — budget **enforcement** (ceiling + a velocity check for motion-without-
   progress), sandbox/permission assumptions made explicit, HITL gates where actions are
   irreversible: **propose-then-commit** — the agent proposes, a deterministic step or human
   commits. Never auto-accept novel data on the model's self-reported confidence; agent
   confidence is input, not truth.
5. **Observability** — log model/tier choice, tokens, verdicts per run; **cost per completed
   task** is the metric that catches "cheaper model needed 3x the turns"
   (`cost-aware-llm-pipeline`). Read transcripts; scores alone lie.

**Named failure modes to design against** (these are model behaviors, not bugs you can prompt
away): _premature completion_ (declares done without verifying — counter: machine-checkable
done criteria), _one-shot overreach_ (attempts everything at once — counter: one task per
iteration), _self-preferential bias_ (trusts its own output when verifying — counter:
independent verify seat), _goal drift_ (loses the objective over many turns — counter:
re-anchor from persisted state, record locked decisions).

## Model & effort selection

Tier language only — never hardcode model names into designs (they rot; resolve current IDs
from the provider at build time, per `cost-aware-llm-pipeline`):

- **Orchestrator / synthesis / adjudication** → high or top tier; a weak orchestrator's
  mistakes are paid by every worker.
- **Focused workers** → mid tier; **mechanical transforms** → cheap tier if it clears your
  eval bar.
- **Sweep the effort control per task class** before reaching for a bigger model — it's the
  finer-grained dial, and its impact grows with each model generation.

## Scaffolding has a sunset

Harness workarounds encode assumptions about _today's_ model, and they go stale as models
improve — yesterday's necessary crutch is tomorrow's overhead that slows the run and hides
capability. Every workaround gets a marker with a **ceiling and an upgrade trigger** (the
`keystone: <ceiling>, <upgrade trigger>` convention from `coding-standards`), e.g.
`keystone: retry-parse shim for malformed JSON; remove when provider structured outputs cover
this call`. On every model migration, re-run the deletion test over the scaffolding before
re-tuning it.

## Evaluation

- Start with **20–50 tasks derived from real failures**, not a synthetic benchmark. A good
  task: two domain experts would independently reach the same pass/fail verdict.
- **End-state evaluation** for multi-step agents (did the goal land), not step-by-step
  trajectory grading — intermediate steps vary too much to assert on.
- Model-graded evals need care: single judge calls are unreliable on close calls; use strict
  binary rubrics, decompose judgments into narrow checks, and validate the judge against
  human-labeled samples before trusting it. Diverse judges beat N copies of one.
- Trace production runs from day one; evals without transcript-reading is score theater.

## Design note (the deliverable)

```
# <Feature> — Agent Design Note

## What it does
<one paragraph: problem, output, consumer>

## Justification
Agent at all? [deterministic alternative considered + why rejected]
One or many? [if many: what independent threads, what each seat earns]
Over-engineering check: [what was cut from this design and why what's left survives the deletion test]

## Topology & loop
Shape: [from the vocabulary above]  ·  Loop mode: [if long-running — see long-running-agents]

## Per-agent scoping
Objective / Output format / Tools + guidance / Boundaries / Effort budget

## Verification
What's machine-checkable · who verifies (fresh context? different model?) · binary criteria

## Guardrails
Budget ceiling + velocity check · HITL gates (propose-then-commit points) · sandbox/permission assumptions

## State
What persists between runs/iterations · idempotency keys (durable-store-checked, not memory-checked)

## Scaffolding sunset
Each workaround: ceiling + upgrade trigger

## Evaluation
Seed tasks · rubric · end-state assertions

## Out of scope
<explicit list>
```

## Red flags — stop and re-run the rubric

- "The agent will figure it out" → constrain it
- A crew where a single agent + one verify seat would do → cut seats
- A gate that has never failed anything → it's theater; delete or sharpen it
- Same-context self-review as the only verification → separate it
- Auto-accepting novel data on self-reported confidence → propose-then-commit
- Free-text returns where downstream code must decide → schema-constrain them
- Model names hardcoded in the design → tiers + build-time resolution
- Scaffolding with no upgrade trigger → it will silently outlive its reason

## Integration

- Before `writing-plans` — the design note feeds the plan.
- `dispatching-parallel-agents` — dispatch mechanics and fan-out economics.
- `long-running-agents` — loop modes, iteration contract, stuck detection.
- `cost-aware-llm-pipeline` — tiers, budgets, cache/loop cost mechanics.
- `llm-security` — the agent attack surface (prompt injection, tool trust, excessive agency).
- `adversarial-review` — stress-test the design note itself before building from it.
