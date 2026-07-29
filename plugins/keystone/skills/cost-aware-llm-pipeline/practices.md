# Practices, anti-patterns, and composition

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
