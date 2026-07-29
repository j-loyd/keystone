---
name: cost-aware-llm-pipeline
description: Use when building or reviewing code that calls an LLM API (Claude/OpenAI/etc.) — tiered model routing, budget tracking, retry logic, batching, prompt caching, and the agentic-loop cost layer (cache hit rate, subagent fan-out, budget circuit breakers). Trigger whenever a task involves multiple model calls, an agent loop or subagent fan-out, batch/bulk processing, cost or latency tradeoffs, or choosing which model tier (or effort level) to use.
---

# Cost-Aware LLM Pipeline

Patterns for controlling LLM API costs while maintaining quality: tiered model routing, budget
tracking, retry logic, batching, and prompt caching, composed into one pipeline.

## When to Activate

- Building applications that call LLM APIs (Claude, GPT, etc.)
- Processing batches of items with varying complexity
- Need to stay within a budget for API spend
- Optimizing cost without sacrificing quality on complex tasks

## The unit of cost is the completed task, not the token

Sticker price ($/MTok) is one input, not the answer. What a pipeline actually spends is
`tokens-to-clear-the-quality-bar × rate` — retries, extra agentic turns, and verbose output
all bill at the same rates as first-try success. Two consequences that invert the old
"cheaper model = cheaper" intuition:

- **A pricier-per-token model can be cheaper per task.** On hard agentic work at high
  effort, a top-tier model that finishes in fewer turns with fewer retries and terser
  output can undercut a mid-tier model's total bill despite a 2–3x sticker gap. On simple
  tasks the ranking flips back. The crossover moves with task complexity and effort level —
  there is no fixed rule, which is exactly why you **measure cost per completed task** in
  your logs, not cost per token.
- **Route by expected total cost to clear the bar.** The tier ladder below still applies to
  high-volume single-call work (classification, extraction) where cheap tiers genuinely
  clear the bar. For agentic work, add turns-to-done and retry rate to the routing signal
  before trusting the sticker comparison.

## Agentic loops — where the money actually goes

Everything above prices a _call_. An agent loop re-sends its history every turn, and that
changes which lever dominates. If you're building or reviewing an agent (tool loop, subagent
fan-out, long-running worker), audit these before touching the model tier:

### Cache hit rate beats model choice

In a typical agentic loop, **re-sent context is the majority of the bill** — an uncached loop's
cumulative token cost grows quadratically with turn count, while cache reads at ~0.1x flatten it
to near-linear. Relocating one cache breakpoint has cut real systems' total LLM spend by half
with zero model change. Concretely:

- **Keep the prefix byte-stable.** Anything that varies per-request in the cached prefix —
  timestamps, unsorted JSON keys, a tool list that changes between turns — invalidates the
  cache from that point on. This is the most common silent cost bug in agent code.
- **Watch the diagnostic, not the vibes.** `cache_read_input_tokens` in the usage block should
  be nonzero and stable across loop turns; if it drops to zero mid-loop, something upstream
  perturbed the prefix. Providers now ship first-party cache-diagnostic tooling — use it before
  hand-debugging.
- **Injecting instructions mid-loop:** newer models/APIs support mid-conversation system
  messages that don't invalidate the cached prefix — prefer that over editing the system prompt
  (which blows the whole cache) where the API offers it.

### Subagent fan-out multiplies super-linearly

Each dispatched subagent re-pays its own system prompt + tool definitions every turn,
independent of the parent's cache. Measured real-world overhead runs **~4x for even a two-agent
fan-out**, not 2x. Budget fan-out as `agents × (task tokens + per-agent cold-start overhead)`,
and prefer compressed returns (a ~1–2k-token summary, not the transcript) so the parent doesn't
re-pay the children's verbosity every subsequent turn. `dispatching-parallel-agents` owns the
"is the fan-out worth it" call; this is the number to plug into it.

### Budgets are loop control, not ledgers

A cumulative spend ceiling alone trips too late on a runaway loop — a stuck agent burns fast
without ever crossing a per-call threshold. Pair two mechanisms:

- **Hard ceiling** — the budget check the `CostTracker` below already does; on breach, stop.
- **Velocity circuit breaker** — sustained token burn with **no state change** (no new files,
  no test-status change, same commands repeating) is the stuck-loop signature; trip on that,
  don't wait for the ceiling. `long-running-agents` owns the loop-side discipline; enforce the
  money side here.

Where the API offers a **task-level budget** the model can see mid-run (a countdown it winds
down against gracefully), prefer it over a bare `max_tokens` cap — the model finishes cleanly
instead of truncating mid-thought.

### Context reduction is now a platform feature — don't hand-roll it

Before writing custom history-truncation logic, check what the API already offers; current
platforms ship (as separate features — don't conflate them):

- **Context editing** — surgically clears stale tool results/thinking from history; the
  default first reach for most loops.
- **Server-side compaction** — automatic whole-history summarization past a token threshold,
  for loops that may outrun even a 1M window.
- **Deferred tool loading / tool search** — keeps tool schemas out of context until needed
  (~85% cut on tool-definition overhead once you're past ~10 tools, with _better_ selection
  accuracy, not worse).
- **Programmatic tool calling** — the model writes code that calls tools and filters results
  before they enter context (~35–40% cut on tool-heavy tasks).
- **Structured outputs** — strict schemas kill the malformed-JSON→full-retry tax; architect the
  retry away rather than budgeting a percentage for it.

Hand-rolled versions of these are now over-engineering (the deletion test applies): they
duplicate a platform feature, drift as APIs evolve, and cost review attention forever.

### Billing axes beyond tokens (know they exist)

Hosted-agent platforms increasingly bill **session-hours alongside tokens**; some providers
price long-context windows at a premium above a threshold while others bill flat; priority/flex
latency tiers exist on some providers and not others. Don't assume provider parity on any of
these — check the pricing page for the axis, not just the rate.

## Going deeper

- [`core-concepts.md`](core-concepts.md) — tier routing, caching, batching mechanics, and how to
  build a current pricing snapshot. Read when you need the numbers or the API-level detail.
- [`practices.md`](practices.md) — best practices, anti-patterns, and how this composes with the
  other keystone skills. Read when reviewing an existing pipeline rather than designing one.
