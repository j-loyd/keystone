---
name: performance-optimization
description: Find what is actually slow, fix that, and keep only the changes whose numbers hold up. Use when something feels slow, when a latency or size budget is missed, when a change may have regressed performance, and when the user says "why is this slow", "optimize this", "speed this up", or "make it faster". Scope boundary — this measures and optimizes; a slowdown that appeared suddenly and needs explaining is systematic-debugging first.
---

# Performance Optimization

## Measurement first, always

A performance claim without a number is a guess. It is a guess whether it comes from reading the
code, from a strong prior about which layer is slow, or from a change that "obviously" helps —
and unlike most guesses, this one is expensive when wrong, because the complexity it adds stays
in the codebase forever while the speedup it promised was never there.

**The one rule worth holding firm:** nothing lands on a performance justification without a
before number and an after number, taken the same way.

Everything below is technique. The technique exists because intuition about where time goes is
unreliable in a specific direction — people optimize the code they find ugly, and the profiler
keeps pointing somewhere else.

**When not to reach for this:** there is no complaint, no budget, and no measurement showing a
problem. Speculative optimization buys complexity now against a slowdown that may never arrive.

## The loop

```
MEASURE  → a recorded baseline you can reproduce
IDENTIFY → the bottleneck the data points at, not the one you suspected
FIX      → one change
VERIFY   → re-measure identically, then keep or revert
GUARD    → make the next regression visible without anyone looking for it
```

## 1. Measure

Pick the metric that matches the complaint. "The app is slow" is not measurable; "the dashboard
takes 6s to first render on a cold cache" is.

Two kinds of measurement, and they answer different questions:

- **Synthetic** — a controlled, repeatable run (e.g. a benchmark harness, a browser performance
  trace, a timed script against fixed input). Reproducible enough to attribute a change to a
  number. This is what the keep/revert decision runs on.
- **Observed** — real traffic in real conditions (e.g. production telemetry, APM traces,
  field-collected user metrics). The only evidence that users actually got faster. Slower to
  read, and rarely clean enough to attribute a single change.

Use synthetic to decide, observed to confirm. If only one is available, say which one you have.

**Record the baseline as a fact, not a memory:** the exact command, the input or dataset, the
environment, cold vs. warm state, how many runs, and the spread across those runs — not just the
mean. The spread is what makes the verify step possible at all.

**Measure on a quiet machine.** A build, a test suite, or another agent running concurrently
moves the numbers more than most optimizations do. Where the harness supports backgrounding a
long run, still don't overlap it with the run you are timing; otherwise run them serially.

If nothing can measure the thing being complained about, building that measurement is the first
task, not a detour from it.

### What is slow? — pick the measurement from the symptom

```
What is slow?
├── First useful output — startup, cold path, time-to-something
│   ├── web page      → e.g. LCP, TTFB, render-blocking resources in the network waterfall
│   ├── CLI / desktop → process start to first output; module-load and config-read time
│   └── service       → cold start / init, connection-pool warm-up, first-request penalty
├── Response to an action — someone did a thing and waited
│   ├── UI interaction → e.g. INP, long tasks on the main thread, re-render cascades
│   ├── API request    → per-endpoint p50/p95/p99, per-layer spans, queries issued per request
│   └── CLI subcommand → wall clock per invocation, then a profiler on the hot path
├── Steady state under load — each unit is fine, the aggregate is not
│   ├── throughput ceiling → requests/sec vs. the saturation point; queue depth; pool exhaustion
│   ├── resource growth    → memory or handles over time; unbounded caches; retained references
│   └── only the tail bad  → lock contention, GC pauses, external dependency, noisy neighbours
└── Bulk work — a job, build, or pipeline too slow end to end
    ├── stage timing    → which stage owns the wall clock (usually one does)
    ├── unit × count    → is it cost per item or number of items? they have different fixes
    └── serialization   → what waits that could overlap; I/O the CPU is idle through
```

The branches are examples of each shape, not a taxonomy to fit into. The point of the tree is to
stop the reflex of profiling whatever is easiest to profile.

## 2. Identify the bottleneck

**The bottleneck is where the time is, not where the code is ugly.** Read the profile before
forming an opinion, and when the profile disagrees with the opinion, the profile wins.

**Check the share before optimizing the part.** A component that owns 8% of wall clock caps your
possible win at 8% even if you make it free. Confirm what fraction of the total the candidate
actually holds — this one check kills most bad optimization projects before they start.

Recurring shapes worth checking for, across stacks:

| Shape | What it looks like | How to confirm |
| --- | --- | --- |
| **Repeated work per item** | Cost scales with rows/items instead of staying flat (the N+1 family: a query, a request, or a file read inside a loop) | Count operations per unit of work, not just total time |
| **Unbounded fetch** | Everything loaded when a page or window was needed | Check for a limit, a paginator, or a streaming read |
| **Work on the critical path** | Something blocking that nobody is waiting on | Ask what happens if it moves after the response, or runs concurrently |
| **Cache absent or useless** | Recomputing a stable value, or a cache whose hit rate nobody has looked at | Measure the hit rate; a 5% hit rate is not a cache |
| **Oversized payload** | Shipping or serializing far more than is consumed | Compare bytes sent to bytes used |

If the slowdown is new and unexplained — it was fast last week and nothing obvious changed —
root-cause it with `systematic-debugging` before optimizing. Speeding up a regression's symptom
leaves the regression in place.

## 3. Fix — one change at a time

Bundled optimizations produce one number that belongs to no single change. When three land
together and the result is 20% better, you have learned that the set is 20% better; you have not
learned that any individual one helps, and at least one of them is usually neutral or negative
complexity you now maintain forever.

If several changes genuinely must ship together, measure each in isolation first, then measure
the combination.

**Correctness gates the metric.** The suite stays green *and* the number moves. Before believing
a win, ask what work disappeared — a change is a regression, not an optimization, when it gets
faster by dropping something the product needed:

- validation, authorization, or an error path skipped
- a cache serving data that had to be fresh
- an `await`/`join`/flush removed that was load-bearing for ordering or durability
- retries, timeouts, or backpressure weakened
- precision, pagination completeness, or result ordering quietly changed

A number that improved because the code stopped doing required work is the most dangerous result
in this skill, because it looks exactly like success.

## 4. Verify — keep or revert

Re-measure the way you measured the baseline: same command, same input, same environment, same
cold/warm state, same run count. A cold-cache baseline against a warm-cache result measures the
cache.

**Beat the noise, not the mean.** Compare the delta against run-to-run variance. A 3% gain inside
±5% variance is not a gain, it is a different sample. Decide the threshold that would count as a
win *before* looking at the result — a threshold chosen afterward is a rationalization with a
number attached.

Then decide, strictly:

| Result vs. baseline | Tests | Decision |
| --- | --- | --- |
| Past the threshold | Green | **Keep.** Carry the before/after numbers into the commit message or PR description. |
| Within noise | Green | **Revert.** |
| Worse | Green | **Revert.** |
| Past the threshold | One went red | **Revert.** A regression wearing a win's clothing. |

**Neutral is a revert, not a keep.** This is the step that gets skipped, and the reason is
always the same: the change is already written, discarding it feels wasteful, so it lands as
"well, it doesn't hurt." It does hurt. Code you keep, you read, review, debug, and migrate
forever. A change that bought nothing still charges rent. Make it pay for itself or take it out.

Before reporting the result, `verification-before-completion` applies in full — the numbers you
quote must come from a run in this turn, not a remembered one.

### The attempt ledger

Reverted work leaves no trace in git history, which is exactly why the same dead idea gets
proposed again next quarter — by a person, or by an agent reading the same code with the same
plausible instinct. Keep a short ledger so a discarded idea stays discarded:

| Idea | Baseline → Result | Verdict | Why |
| --- | --- | --- | --- |
| Memoize the row component | 240ms → 235ms | reverted | Inside noise (±15ms). Rows weren't the bottleneck. |
| Virtualize the list | 240ms → 90ms | kept | Long tasks gone from the trace. |
| Batch the per-item lookup | 4.2s → 1.1s | kept | Query count per job went 1,800 → 12. |
| Add a read-through cache | 1.1s → 1.1s | reverted | 4% hit rate; the keys were effectively unique. |

A section in the PR description works; a `PERF.md` at the repo root works better for anything
long-lived. What matters is that the next person reads it before proposing an experiment, and
that a failed idea is recorded with *why* it failed — "reverted" alone invites a retry.

## 5. Guard

A win with no guard decays quietly. Before closing out, make the regression detectable by
something other than a user complaint:

- a budget enforced in CI (e.g. bundle size, benchmark wall clock, query count per request) that
  fails the build when crossed
- a benchmark or timing assertion checked in alongside the fix
- an alert or dashboard on the production metric that motivated the work
- at minimum, the number and its measurement command written down where the next person finds it

Budgets are only real when they are numbers with a failure mode. "Keep the bundle small" guards
nothing; a threshold that turns CI red does.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "It's obviously faster, no need to measure" | Then measuring is cheap and settles it. Unmeasured wins are how neutral complexity lands. |
| "It didn't help much, but it doesn't hurt" | It costs maintenance forever and returned nothing. Neutral is a revert. |
| "We already wrote it, may as well keep it" | Sunk cost. The measurement doesn't care how long the change took to write. |
| "It's fast on my machine" | Your machine is not the user's hardware, network, or dataset size. |
| "Let's land all three and measure after" | One number, three changes, zero attribution. At least one of them is dead weight. |
| "The test only failed because it was too strict" | Assume the opposite until proven otherwise: the test caught work you dropped. |
| "We'll optimize it later" | Fine for micro-optimizations. Not fine for an anti-pattern that scales with data you're about to accumulate. |
| "The framework/runtime handles performance" | It prevents some classes of problem and none of the ones in your own data access. |
| "Users won't notice 100ms" | They notice in aggregate, and it stacks with every other 100ms on the path. |

## Red flags

- An optimization proposed before any profile was read
- A speedup claimed with no baseline number, or with a baseline taken under different conditions
- A delta smaller than the run-to-run spread, reported as a win
- A win threshold chosen after seeing the result
- Several changes measured together and kept together
- A change kept because reverting it felt wasteful
- A test changed, skipped, or deleted to make an optimization pass
- A performance win that quietly removed validation, freshness, ordering, or durability
- Optimizing a component without knowing what share of total time it holds
- The same failed idea attempted twice because nobody wrote down the first attempt
- A landed win with no budget, benchmark, or alert to catch its regression
