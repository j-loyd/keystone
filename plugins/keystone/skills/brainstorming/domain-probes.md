# Domain Probes

A cheatsheet of sharp, domain-specific follow-up questions. Generic clarifiers ("what are the
requirements?") get generic answers. When a discussion touches one of these domains, reach for
the probes below — they're the questions an expert in that domain would ask, and they surface the
decisions that quietly determine the design.

Use judgment: ask the 2–3 probes that actually matter for the task, not the whole list.

## Auth & identity

- Who are the actors (end users, admins, service accounts, third parties)?
- Session, JWT, or opaque token? Where is it stored, and what's the lifetime / refresh story?
- SSO / OAuth providers, or local credentials? MFA?
- Authorization model: roles, per-resource ownership (IDOR risk), org/tenant scoping?
- What happens on logout, password reset, or account/org deletion — are tokens revoked?

## Data & persistence

- Read/write ratio? Hot paths? Expected row counts at 1× and 100×?
- Consistency needs — is eventual consistency acceptable, or must reads see writes immediately?
- Normalized tables vs. blob; which fields are queried/filtered/sorted (→ indexes)?
- Retention, soft-delete vs. hard-delete, audit trail, PII handling?
- Migration story for existing data?

## External APIs / integrations

- Rate limits, quotas, and pricing? Sync or async?
- Failure handling: timeout, retry policy, idempotency, circuit-breaking when it's down?
- Webhooks inbound: signature verification, replay protection, ordering, at-least-once dupes?
- Sandbox vs. production credentials; where do secrets live?

## Payments / billing

- One-time, subscription, usage-based? Currency, tax, refunds, proration?
- Provider (Stripe, etc.) — webhook-driven state, or polled? Idempotency keys?
- What's the source of truth for entitlement — your DB or the provider?
- Dunning / failed-payment / chargeback handling?

## Realtime / async / jobs

- Latency budget — is "a few seconds late" fine, or must it be instant?
- Delivery guarantee: at-most-once, at-least-once, exactly-once? Ordering?
- Backpressure when the consumer is slow; dead-letter for poison messages?
- Idempotency so retries don't double-apply?

## Search / filtering

- Exact match, full-text, fuzzy, or semantic? Typo tolerance?
- Facets/filters/sort dimensions? Pagination strategy at scale (offset vs. cursor)?
- Index freshness — how stale can results be?

## File upload / media

- Max size, allowed types, and how is type actually validated (not just extension)?
- Where stored (object storage, direct-to-bucket vs. through-server)? Virus/abuse scanning?
- Access control on retrieval (signed URLs vs. public)? Path-traversal on filenames?

## Notifications / messaging

- Channels (email, SMS, push, in-app)? Per-channel deliverability and cost?
- User preferences / opt-out / quiet hours? Localization?
- Templating + dynamic data; how are sends deduped/throttled?

## LLM / agent features

- Direct vs. indirect input (does model output reach a sink — shell, SQL, file, another call)?
- Agency: what actions can it take, and which are irreversible (→ HITL gate)?
- Cost/latency: which model tier, batching, prompt caching (see `designing-agent-systems`)?
- Prompt-injection surface, system-prompt/secret leakage (see `llm-security`)?

## Reporting / analytics

- Real-time dashboards or batch? Acceptable freshness lag?
- Pre-aggregated rollups vs. query-on-read? Cardinality of group-bys?
- Who can see whose data (tenant isolation in aggregates)?
