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

## Core Concepts

### 1. Tiered model routing

Route by task complexity across tiers — cheapest first, escalate only when the cheap tier's
output signals it can't carry the task. This is the same principle keystone applies to its own
subagent dispatch: `/review` fans a large diff out per-file to the cheap tier to flag
candidates, escalates only the flagged spots to the mid tier, and reserves the top tier for
genuinely ambiguous calls — never the biggest model for every request.

```python
# Resolve exact model IDs in ONE config place, from your provider's live model list
# (a models API endpoint) or pricing page — never scattered through call sites, and
# never copied from docs or examples (including this one): names, tiers, and prices
# change every few months. Beware of aliases — on several providers a dateless ID is
# still a pinned snapshot, not a floating "latest"; check the versioning rules.
MODELS = load_model_config()  # {"cheap": ..., "mid": ..., "high": ..., "top": ...}
# cheap — classify, extract, triage, per-item fan-out
# mid   — default tier: most application logic
# high  — ambiguous judgment calls, high-stakes output
# top   — hardest judgment; adjudication/adversarial seats, NOT a routing default

_MID_TEXT_THRESHOLD = 10_000  # chars
_MID_ITEM_THRESHOLD = 30      # items

def select_model(
    text_length: int,
    item_count: int,
    force_tier: str | None = None,
) -> str:
    """Route by task complexity. Escalate one tier at a time — never jump straight to the top."""
    if force_tier is not None:
        return MODELS[force_tier]
    if text_length >= _MID_TEXT_THRESHOLD or item_count >= _MID_ITEM_THRESHOLD:
        return MODELS["mid"]
    return MODELS["cheap"]
```

**When to escalate a tier** — concrete triggers, not "when it feels hard":

- The cheap tier's output fails schema/structural validation **twice**, not once (one failure
  is often a prompt problem, not a capability ceiling).
- The task requires weighing multiple plausible-but-conflicting signals (genuine ambiguity)
  rather than pattern-matching against a well-defined category list.
- The output is safety- or money-relevant enough that a wrong answer is expensive to have
  shipped (payments, destructive actions, anything a human won't independently re-check).
- The model self-reports low confidence, if you asked it to — treat that as a routing signal,
  not a result to accept as-is.

**When NOT to escalate** — high-volume classification against a well-defined category list,
extraction against a strict schema with low ambiguity, or any task where a cheap-tier pass
already runs near 95%+ agreement against spot-checked ground truth. Escalating there just
spends money to buy back a percent or two.

### 2. The reasoning-effort control — a lever before you reach for a bigger model

Current frontier models expose a reasoning-effort control (the name varies by provider — an
`effort` level, adaptive thinking, a reasoning setting) that trades intelligence for latency
and cost **within the same model**, independent of which tier you picked. Turning it down is
often a cheaper win than tier-switching for a task that's borderline-easy on the current tier;
turning it up is cheaper than escalating a whole tier for one that's borderline-hard. Its
impact has grown with each model generation — **sweep effort per task class in a small eval**
rather than defaulting everything to the top setting (on current top-tier models, a low
setting frequently beats the previous generation's high), and re-tune on every model
migration rather than carrying an old setting forward. Note that fixed thinking-token budgets
are deprecated or rejected outright on current models where adaptive reasoning replaced them —
treat a hardcoded thinking budget in code you're reviewing as a migration bug, not a tuning
choice. Check your provider's docs for the current levels and defaults — they vary by model
and by surface.

### 3. Immutable Cost Tracking

Track cumulative spend with frozen dataclasses. Each API call returns a new tracker — never mutates state.

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class CostRecord:
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float

@dataclass(frozen=True, slots=True)
class CostTracker:
    budget_limit: float = 1.00
    records: tuple[CostRecord, ...] = ()

    def add(self, record: CostRecord) -> "CostTracker":
        """Return new tracker with added record (never mutates self)."""
        return CostTracker(
            budget_limit=self.budget_limit,
            records=(*self.records, record),
        )

    @property
    def total_cost(self) -> float:
        return sum(r.cost_usd for r in self.records)

    @property
    def over_budget(self) -> bool:
        return self.total_cost > self.budget_limit
```

### 4. Narrow Retry Logic

Retry only on transient errors. Fail fast on authentication or bad request errors.

```python
# Map YOUR SDK's error taxonomy to the same split — every provider SDK has one:
# transient (connection, rate-limit, server error) → retry with backoff;
# permanent (auth, bad request, validation) → raise immediately.
from anthropic import (  # or your provider's SDK equivalents
    APIConnectionError,
    InternalServerError,
    RateLimitError,
)

_RETRYABLE_ERRORS = (APIConnectionError, RateLimitError, InternalServerError)
_MAX_RETRIES = 3

def call_with_retry(func, *, max_retries: int = _MAX_RETRIES):
    """Retry only on transient errors, fail fast on others."""
    for attempt in range(max_retries):
        try:
            return func()
        except _RETRYABLE_ERRORS:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
    # AuthenticationError, BadRequestError etc. → raise immediately
```

### 5. Batching — the discount routing alone can't buy

Model routing picks the cheapest _model_; batching picks the cheapest _lane_. For anything that
doesn't need a synchronous response — bulk classification, backfills, nightly reprocessing —
submit through the provider's async batch endpoint instead of the normal request path. It runs
at a flat discount off standard pricing (confirm the current rate — historically ~50% off — at
the pricing page below) in exchange for a processing window instead of an immediate response,
and the discount **stacks** with prompt caching for a compounded saving.

Batch when the item count is large enough that the discount outweighs the latency you're giving
up, and nothing downstream needs the result synchronously. Don't batch a single interactive
request, and don't batch when the processing window (can run to the better part of a day for a
large or busy queue) blows the task's actual deadline.

### 6. Prompt Caching

Cache long, repeated prefixes — system prompts, few-shot examples, a large retrieved document
reused across turns — so you pay full price once and a fraction on every reuse:

```python
messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},  # Cache this prefix
            },
            {
                "type": "text",
                "text": user_input,  # Variable part — not cached
            },
        ],
    }
]
```

Writing to the cache costs _more_ than a normal input token (roughly 1.25x base for a
short-lived 5-minute cache, ~2x base for a 1-hour cache, by current pricing) — a cache **hit**
is what pays for itself, at roughly a tenth of the base input rate. That means caching only
wins when the same prefix is reused enough times within the TTL to amortize the write; a prefix
used exactly once is a pure loss. Long multi-turn conversations and repeated system prompts are
the common win; a one-shot batch job with no repeated prefix usually isn't.

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

## Composition

Combine the techniques above in a single pipeline function:

```python
def process(text: str, config: Config, tracker: CostTracker) -> tuple[Result, CostTracker]:
    # 1. Route model (escalate one tier at a time; consider `effort` before jumping tiers)
    model = select_model(len(text), estimated_items, config.force_model)

    # 2. Check budget
    if tracker.over_budget:
        raise BudgetExceededError(tracker.total_cost, tracker.budget_limit)

    # 3. Call with retry + caching (or route to the batch endpoint if async is acceptable)
    response = call_with_retry(lambda: client.messages.create(
        model=model,
        messages=build_cached_messages(system_prompt, text),
    ))

    # 4. Track cost (immutable)
    record = CostRecord(model=model, input_tokens=..., output_tokens=..., cost_usd=...)
    tracker = tracker.add(record)

    return parse_result(response), tracker
```

## Build your own pricing snapshot — this file deliberately carries none

No model names, no dollar figures here: they go stale faster than any skill gets updated, and
this skill serves any provider (Claude, OpenAI, Gemini, ...). At project start — and again
before any budget decision that matters — snapshot the live facts into **your project's
config**, not into prose:

- **Pricing**: your provider's pricing page. Record the as-of date next to every number you
  copy; promotional/introductory rates carry sunset dates — record those too.
- **Model IDs and lifecycle**: prefer querying the provider's models API for the live list over
  hand-maintaining IDs that silently drift; note deprecation dates.
- **Shape of the snapshot**: one row per tier (`cheap / mid / high / top`), columns for model
  ID, input rate, output rate, as-of date. The tier names are yours and stable; only the cells
  churn.

What generalizes across providers (verify your provider's exact figures — the _shape_ is what's
stable):

- **Batch/async lanes** run at a flat deep discount (half price is common) in exchange for a
  processing window, and the discount stacks with caching.
- **Cache writes** often bill at a premium over base input; **cache hits** at a small fraction
  of it (~10% is common); longer TTLs trade a higher write premium for lifetime. Store the
  _ratios_ in config, not the dollars — ratios survive price changes that strand dollar
  constants. Pick TTL deliberately: long TTL for a long-lived agent session, short for bursty
  traffic.
- **Tokenizers differ** across model generations and providers — the same text can tokenize
  materially differently (double-digit percentages). Compare costs via the provider's
  token-counting endpoint, never by porting token counts across models.
- **Non-token billing axes exist and vary by provider**: session-hour billing on hosted agent
  platforms, long-context premiums above a window threshold (flat on some providers, doubled
  on others), priority/flex latency tiers on some and not others. Check for the _axis_, not
  just the rate.

Every snapshot ages; the routing _principle_ (cheapest tier that clears the bar, escalate on
signal, cache/batch what repeats, measure per completed task) outlives any specific figure.

## Best Practices

- **Start with the cheapest model** and only route to more expensive tiers when a concrete
  escalation trigger fires — not "this feels important"
- **Try tuning `effort` before jumping a whole tier** for a task that's borderline on the
  current one
- **Set explicit budget limits** before processing batches — fail early rather than overspend
- **Batch anything that doesn't need a synchronous response** — the discount stacks with caching
- **Log model selection decisions** so you can tune thresholds based on real data
- **Use prompt caching** for repeated prefixes over ~1024 tokens reused within the cache TTL —
  saves both cost and latency; a prefix used once is a net loss, not a win
- **In agent loops, audit cache hit rate before model tier** — it's usually the bigger lever,
  and a byte-unstable prefix silently forfeits it
- **Measure cost per completed task in your logs** (tokens × rate ÷ tasks cleared) — it's the
  only number that catches the "cheaper model needed 3x the turns" failure
- **Never retry on authentication or validation errors** — only transient failures (network, rate limit, server error)

## Anti-Patterns to Avoid

- Using the most expensive model for all requests regardless of complexity
- Jumping straight to the top tier on the first failure instead of escalating one tier at a time
- Retrying on all errors (wastes budget on permanent failures)
- Mutating cost tracking state (makes debugging and auditing difficult)
- Hardcoding model names throughout the codebase instead of one constant/config source
- Ignoring prompt caching for repetitive system prompts — or caching a prefix that's never reused
- Sending synchronous requests for bulk/async-tolerant work that the batch endpoint would discount
- Comparing models on sticker $/MTok when the real question is total tokens-to-done (turns,
  retries, tokenizer differences included)
- A per-request timestamp, unsorted JSON, or varying tool list inside a cached prefix (silent
  full-cache invalidation every call)
- Hand-rolling history truncation, tool-result pruning, or JSON-repair retries that a platform
  feature (context editing, compaction, deferred tools, structured outputs) already does better
- A spend ceiling with no velocity check — runaway loops burn budget long before a cumulative
  cap notices
- Trusting a vendored pricing table indefinitely — re-verify before a budget decision that matters

## When to Use

- Any application calling Claude, OpenAI, or similar LLM APIs
- Batch processing pipelines where cost adds up quickly
- Multi-model architectures that need intelligent routing
- Production systems that need budget guardrails
