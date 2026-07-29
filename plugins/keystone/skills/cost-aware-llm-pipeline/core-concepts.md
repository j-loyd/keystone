# Cost mechanics — the detailed reference

## Contents

- Core Concepts
  - 1. Tiered model routing
  - 2. The reasoning-effort control — a lever before you reach for a bigger model
  - 3. Immutable Cost Tracking
  - 4. Narrow Retry Logic
  - 5. Batching — the discount routing alone can't buy
  - 6. Prompt Caching
- Build your own pricing snapshot — this file deliberately carries none

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
