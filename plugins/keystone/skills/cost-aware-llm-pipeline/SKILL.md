---
name: cost-aware-llm-pipeline
description: Use when building or reviewing code that calls an LLM API (Claude/OpenAI/etc.) — tiered model routing, budget tracking, retry logic, batching, and prompt caching. Trigger whenever a task involves multiple model calls, batch/bulk processing, cost or latency tradeoffs, or choosing which model tier (or effort level) to use.
---

# Cost-Aware LLM Pipeline

Patterns for controlling LLM API costs while maintaining quality: tiered model routing, budget
tracking, retry logic, batching, and prompt caching, composed into one pipeline.

## When to Activate

- Building applications that call LLM APIs (Claude, GPT, etc.)
- Processing batches of items with varying complexity
- Need to stay within a budget for API spend
- Optimizing cost without sacrificing quality on complex tasks

## Core Concepts

### 1. Tiered model routing

Route by task complexity across tiers — cheapest first, escalate only when the cheap tier's
output signals it can't carry the task. This is the same principle keystone applies to its own
subagent dispatch: `/review` fans a large diff out per-file to the cheap tier to flag
candidates, escalates only the flagged spots to the mid tier, and reserves the top tier for
genuinely ambiguous calls — never the biggest model for every request.

```python
# Pin exact model IDs in one place. Tier names, IDs, and prices change every few months —
# verify at https://docs.claude.com/en/docs/about-claude/pricing (or query the Models API,
# GET /v1/models, to enumerate what's actually available) before hardcoding a new one.
# A date-suffixed ID (older models) is a hard pin; a dateless ID on current-generation models
# (Sonnet 5, Opus 4.8 and later) is *also* a pinned snapshot, not a floating alias — see
# docs.claude.com/en/docs/about-claude/models/model-ids-and-versions.
MODEL_HAIKU = "claude-haiku-4-5-20251001"  # cheapest, fastest — classify, extract, triage
MODEL_SONNET = "claude-sonnet-5"           # default mid tier — most application logic
MODEL_OPUS = "claude-opus-4-8"             # top tier — ambiguous judgment calls, high stakes

_SONNET_TEXT_THRESHOLD = 10_000  # chars
_SONNET_ITEM_THRESHOLD = 30      # items

def select_model(
    text_length: int,
    item_count: int,
    force_model: str | None = None,
) -> str:
    """Route by task complexity. Escalate one tier at a time — never jump straight to the top."""
    if force_model is not None:
        return force_model
    if text_length >= _SONNET_TEXT_THRESHOLD or item_count >= _SONNET_ITEM_THRESHOLD:
        return MODEL_SONNET
    return MODEL_HAIKU
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

### 2. The `effort` parameter — a lever before you reach for a bigger model

Recent Sonnet/Opus models expose an `effort` parameter that trades intelligence for latency and
cost **within the same model**, independent of which tier you picked. Turning it down is often
a cheaper win than tier-switching for a task that's borderline-easy on the current tier; turning
it up is cheaper than escalating a whole tier for one that's borderline-hard. Check current
defaults and guidance at
[docs.claude.com/en/docs/build-with-claude/effort](https://docs.claude.com/en/docs/build-with-claude/effort)
before assuming a specific default — it varies by model and by surface (API vs. Claude Code).

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
from anthropic import (
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

## Verifying current facts before you rely on them

Model names, tier boundaries, and prices move every few months — faster than this file gets
updated. Don't treat a pricing table (including the one below) as a source of truth for a
budget decision that matters:

- **Pricing**: [docs.claude.com/en/docs/about-claude/pricing](https://docs.claude.com/en/docs/about-claude/pricing)
- **Model IDs and lifecycle**: [docs.claude.com/en/docs/about-claude/models/overview](https://docs.claude.com/en/docs/about-claude/models/overview)
- **Programmatically**: the Models API (`GET /v1/models`) returns the live list with
  capabilities and context/output limits — prefer querying it over hand-maintaining a model ID
  list that can silently drift out of date.

## Pricing Reference (snapshot, verified 2026-06-30 — re-check before budgeting)

| Tier  | Model (this snapshot)                                                                                           | Input ($/MTok) | Output ($/MTok) | Use for                                              |
| ----- | --------------------------------------------------------------------------------------------------------------- | -------------: | --------------: | ---------------------------------------------------- |
| Cheap | Haiku 4.5                                                                                                       |             $1 |              $5 | classification, extraction, triage, per-file fan-out |
| Mid   | Sonnet 5 (introductory rate through Aug 31 2026, standard rate after — see the pricing page for the exact date) |        $2 → $3 |       $10 → $15 | most application logic, escalated findings           |
| Top   | Opus 4.8                                                                                                        |             $5 |             $25 | ambiguous judgment calls, high-stakes output         |

Batch API: roughly 50% off standard pricing for async processing; stacks with caching. Cache
writes: roughly 1.25x base (5-minute TTL) / 2x base (1-hour TTL). Cache hits: roughly 0.1x base.
Every number above is this snapshot's — the routing _principle_ (cheapest tier that clears the
bar, escalate on signal, cache/batch what repeats) outlives any specific figure.

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
- **Never retry on authentication or validation errors** — only transient failures (network, rate limit, server error)

## Anti-Patterns to Avoid

- Using the most expensive model for all requests regardless of complexity
- Jumping straight to the top tier on the first failure instead of escalating one tier at a time
- Retrying on all errors (wastes budget on permanent failures)
- Mutating cost tracking state (makes debugging and auditing difficult)
- Hardcoding model names throughout the codebase instead of one constant/config source
- Ignoring prompt caching for repetitive system prompts — or caching a prefix that's never reused
- Sending synchronous requests for bulk/async-tolerant work that the batch endpoint would discount
- Trusting a vendored pricing table indefinitely — re-verify before a budget decision that matters

## When to Use

- Any application calling Claude, OpenAI, or similar LLM APIs
- Batch processing pipelines where cost adds up quickly
- Multi-model architectures that need intelligent routing
- Production systems that need budget guardrails
