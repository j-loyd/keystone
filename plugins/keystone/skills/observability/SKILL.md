---
name: observability
description: Instruments a feature so production behavior is answerable from the outside — structured logs, metrics, traces, and alerts tied to real on-call questions. Use when adding logging, metrics, tracing, or alerting, when shipping anything that will run in production, and when the user says "add logging", "we can't tell why prod is failing", "set up alerts", or "instrument this". Scope boundary — not for diagnosing a failure happening right now; that's systematic-debugging.
---

# Observability

Code you can't observe is code you can't operate. The test of instrumentation is not how much
telemetry a feature emits — it's whether someone paged at 3am can answer *what is this doing and
why* without opening the source. Plenty of features emit a lot and still fail that test.

Telemetry is written alongside the feature, the way tests are. Deferred, it becomes archaeology:
the first bug report arrives and there's nothing to query.

**Not for diagnosing a failure happening right now** — that's `systematic-debugging`. This skill
is what makes that one fast the next time.

## Step 1 — write down the questions

Before adding a single log line, write the 2–4 questions an on-call engineer will actually ask
about this feature. Not categories of question. The literal questions.

```
FEATURE: payment retry on checkout

ON-CALL WILL ASK:
1. What share of payments succeed first try vs. only after a retry?
2. When one fails permanently, why — provider decline, timeout, or bad input?
3. Is the provider slower than it was yesterday?

Every signal below has to answer one of these. If it answers none, it doesn't ship.
```

**If you can't name the questions, you're not ready to instrument — you'll log everything and
learn nothing.** This is the step that gets skipped, and skipping it is why dashboards end up
showing everything except the answer.

Keep the list next to the code — a comment block, the PR description, the runbook. It is the
acceptance criteria a reviewer checks the instrumentation against.

## Step 2 — pick the signal that answers each question

Three signal types, three jobs. **Metrics tell you THAT something is wrong, traces tell you
WHERE, logs tell you WHY.** Reaching for the wrong one is how you end up with a log pipeline
priced like a metrics backend.

| Signal | Answers | Rough cost profile |
| ------ | ------- | ------------------ |
| **Metric** | "How often, how fast, in aggregate?" | Cheap and flat — cost scales with *series count*, not traffic. Cheap to query. |
| **Trace** | "Where did the time go across hops?" | Per-request, so normally sampled. Storage is the constraint. |
| **Structured log** | "What exactly happened in this one case?" | Per-event, scales linearly with traffic. Usually the largest bill. |

A question like "is checkout slow?" is a metric. "Which hop is slow?" is a trace. "Why did *this*
customer's charge fail?" is a log. Most features need all three, in small amounts.

## Metrics — RED for request paths, USE for resources

For anything request-driven (endpoints, handlers, outbound calls to a dependency), instrument
**RED**: **R**ate, **E**rrors, **D**uration. For anything with finite capacity (queues,
connection pools, worker threads, disks), instrument **USE**: **U**tilization, **S**aturation,
**E**rrors. Every external dependency gets its own RED set — otherwise a provider's outage looks
like your latency regression.

**Percentiles always, averages never.** Record duration as a histogram and read p50/p95/p99. An
average blends the 1% of users having a terrible time into the 99% who are fine, which is exactly
the population you need to see. Keep an average around as a secondary series if you like, but
never alert on one and never judge a release by one.

### Cardinality is THE failure mode

Every distinct combination of label values is a separate time series that gets stored and indexed
forever. One unbounded label multiplies your series count by the size of an unbounded set. This
is the single most common way a metrics backend gets taken down by the team that owns it, and the
damage is retroactive — the series already written don't disappear when you fix the code.

Labels come from small, fixed, enumerable sets:

```
OK as label:      route pattern ("/api/orders/:id")   status class ("5xx")
                  provider name   region   plan tier   boolean flags

NEVER a label:    user_id   email   request_id   full URL (with query string)
                  raw error message text   timestamps   anything user-supplied
```

The rule of thumb: if you cannot write down the complete list of possible values, it is not a
label. Those high-cardinality details are what logs and trace attributes are for — put them there
and join at query time. Where a value set is bounded but large (a few hundred tenants), treat it
as a budget decision rather than a free choice, and measure the series count before shipping.

## Logs — structured events with a correlation ID

Log events, not prose. A log line is a record with a stable event name and machine-readable
fields, so it can be filtered, counted, and joined. String interpolation destroys all three:
`"Payment 8821 failed for user 40 after 3 retries"` cannot be grouped by error code, and the
format changes the next time someone edits the sentence.

Use levels consistently, defined by what on-call should *do*: `error` = an invariant broke,
someone may need to act; `warn` = degraded but handled (a retry saved it, a fallback fired) —
watch the trend; `info` = a significant business event; `debug` = off in production by default.

**Correlation IDs are mandatory across service boundaries.** Without one, concurrent requests
interleave into a log stream that cannot be untangled, and the request that failed is
unreconstructable. Accept an inbound ID or mint one, bind it to everything the request touches,
propagate it outward, and **echo it on the response** — that last part is what lets a user or a
support ticket hand you the exact request.

```
on inbound request:
    id = inbound_header("x-request-id") or new_uuid()
    bind id to the request-scoped logger and to the active trace span
    set response header "x-request-id" = id

on every outbound call (HTTP, queue publish, job enqueue, scheduled retry):
    carry id in headers or message metadata

on log emit:
    id is already on the line — it was bound, not passed by hand
```

The mechanism differs per stack — middleware plus a child logger in one web framework (an Express
`app.use` that stamps `req.id` is the canonical one-liner), a context variable in another, an
interceptor in a third. The shape doesn't change. What does change is where the chain breaks:
async boundaries, queue hops, and retry paths are where the ID silently stops propagating.

**Never log secrets, tokens, credentials, or unredacted PII.** Allowlist the fields you emit
rather than dumping request bodies or error objects wholesale — a serialized exception often
carries the credential that caused it. `security-review` owns this rule in full; telemetry
pipelines are one of the most common paths it gets violated on.

## Tracing

Use a vendor-neutral standard (OpenTelemetry being the common one) so the backend stays
replaceable. Auto-instrumentation covers HTTP, RPC, and most database clients for near-zero code,
which is usually enough on day one. Add manual spans only around meaningful internal units of
work, and attach the attributes on-call will filter by. Sample at a low rate by default, but keep
errors — a sampled-away trace of a failure is the one you needed. Traces die at unpropagated
context, same as correlation IDs and for the same reasons.

If the traced path calls an LLM, the token and cost dimensions belong here too —
`designing-agent-systems` covers what to record per run.

## Alerts — symptoms, not causes

Alert on what users feel. Cause-based alerts fire when nothing is wrong, and stay silent through
every failure mode you didn't anticipate.

| Page-worthy (a symptom) | Dashboard only (a cause) |
| ----------------------- | ------------------------ |
| Error rate above 1% for 5 minutes | CPU at 85% |
| p99 latency above 2s | A pod restarted |
| Queue age above 10 minutes | Disk at 70% |
| Checkout success rate below its SLO | Cache hit rate dipped |

Nothing in the right column is a fact about a user's experience. Watch them, graph them, link
them from the runbook — but don't wake anyone for them.

Every alert you create carries three things:

1. **An action.** If the honest response is "ignore it, it recovers," delete the alert. A pager
   that cries wolf trains the exact behavior that makes the real page get missed.
2. **A runbook link.** Three lines is a legitimate runbook: what this means, the first query to
   run, who to escalate to.
3. **A threshold justified by an SLO or by historical data** — not by a round number that felt
   about right. Write the justification down next to the threshold.

Use exactly **two severities**: *page* (user-facing, act now) and *ticket* (degraded, act this
week). A third tier trains people to ignore everything, because the middle tier becomes the bin
where anything ambiguous gets filed and then never looked at. (If your org's incident taxonomy
already fixes the tiers, map into it rather than inventing a parallel scheme — the discipline to
keep is that every alert maps to a defined *action*, not that the count is two.)

## Verify the telemetry itself

Instrumentation is code, and it can be wrong in all the usual ways — a field that serializes to
`[object Object]`, a metric registered but never incremented, an alert wired to a channel nobody
reads. None of that shows up until the incident, which is the worst possible moment to discover
it. So exercise it deliberately:

- **Force an error in staging and find it by correlation ID.** This one check covers propagation,
  binding, and log shipping in a single pass.
- **Read the raw output, don't trust the code.** Confirm fields actually serialize — nested
  objects, errors, and dates are where structured logging quietly degrades to string soup.
- **Send test traffic and check the metric series appear** with the labels you expect and values
  in a sane range. A histogram with everything in the top bucket means bad bucket boundaries.
- **Follow one request end-to-end in the trace UI** and look for gaps — a missing span is an
  unpropagated context, not a fast hop.
- **Test-fire each new alert once** by temporarily lowering its threshold. Confirm it lands in the
  right channel and that the runbook link resolves. Restore the threshold and note that you did.

**The final gate:** someone induced a failure in staging and located it using telemetry alone,
without reading the source. Until that's happened, the instrumentation is untested — you have
evidence the code runs, not evidence it answers anything.

## Rationalizations

| Rationalization | Reality |
| --------------- | ------- |
| "I'll add logging once it works" | "Once it works" becomes "after the first incident," which is the most expensive hour to discover you're blind. |
| "More logs means more observability" | Volume without structure makes incidents slower. Three queryable events beat three hundred prose lines. |
| "Plain print statements are fine for now" | Unstructured output can't be filtered, correlated, or alerted on. Reaching for the structured logger costs minutes, once. |
| "We'll check the dashboards when something breaks" | A dashboard built without defined questions shows everything except the answer. Start from the on-call questions. |
| "User ID as a label makes debugging easier" | It also makes the metrics backend fall over, permanently. That detail belongs in logs and trace attributes. |
| "Alert on everything now, tune it later" | The tuning never happens; the ignored page does. Ship few alerts and add on evidence. |
| "Tracing is overkill for two services" | Two services already produce cross-service latency questions that logs cannot answer. |
| "The instrumentation is simple, it obviously works" | Instrumentation fails silently by construction — nothing breaks when a metric never increments. |

## Red flags

- A PR adding retries, queues, or external calls with zero new telemetry
- Log lines assembled by string interpolation instead of fields
- No correlation ID — every log line is an orphan
- Metrics labeled with user IDs, raw URLs, or error message text
- Latency reported as an average, with no percentiles available
- An alert that fires most days and gets acknowledged without anyone acting
- Alerts paging humans about CPU and memory while user-facing error rate is unmonitored
- Secrets, tokens, or whole request bodies visible in log output
- Any alert with no runbook, or a threshold nobody can justify
- "It works on my machine" as the only evidence a production feature is healthy
