# ADR Format

ADRs live in `docs/adr/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create the `docs/adr/` directory lazily — only when the first ADR is needed.

**Check for an existing template first.** If the target repo already has an ADR convention —
a `docs/adr/0000-template.md`, a `template.md`, a `.github/ADR_TEMPLATE.md`, or just a handful
of existing ADRs with a consistent shape — match that shape instead of introducing a second
format. The template below is the fallback for repos that don't have one yet.

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

That's it. An ADR can be a single paragraph. The value is in recording _that_ a decision was made and _why_ — not in filling out sections.

## Optional sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — useful when decisions are revisited
- **Considered Options** — only when the rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need to be called out

A repo that wants every section every time (Status, Date, Deciders, Context, Decision,
Consequences, Alternatives) can use a fuller scaffold — that's a legitimate house style, and if
the repo already has one, defer to it (see above). The discipline that travels either way: fill
in only what earns its place. An empty "Alternatives considered" section is worse than no
section at all.

## Numbering

Scan `docs/adr/` for the highest existing number and increment by one.

## Worked example

```md
# 0007: Ordering and Billing communicate via domain events, not synchronous HTTP

Ordering needs Billing to know when an order ships, but a synchronous call would cap Ordering's
availability at Billing's. We're emitting `OrderShipped` as a domain event instead; Billing
consumes it asynchronously. Trade-off: the invoice can now lag shipment by seconds, which is
fine for our SLA — but would have been a silent regression if a future engineer "simplified"
this back into a direct call.
```

Three sentences, no sections beyond the title. It passes the test below — hard to reverse (both
services need a coordinated migration to go back to synchronous), surprising (a direct call is
the obvious naive choice), a real trade-off (synchronous is simpler code; async was chosen for
availability) — and it names the exact mistake a future reader would otherwise reintroduce.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it — you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, deployment target. Not every library — just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected alternatives when the rejection is non-obvious.** If you considered GraphQL and picked REST for subtle reasons, record it — otherwise someone will suggest GraphQL again in six months.

### What doesn't qualify (and why it fails the test)

- **"We used lodash for array helpers."** Reversible in an afternoon — fails #1.
- **"We named the handler `processOrder`."** Not surprising to anyone reading it — fails #2.
- **"We used Postgres because it's what the team already knows, no other option was seriously considered."** No real trade-off was weighed — fails #3.
- **"We fixed the off-by-one in the pagination loop."** A bug fix, not a decision — nothing was chosen between alternatives, so there's nothing to record.

When in doubt, don't write it. A missing ADR costs one Slack question later; a junk drawer of
non-decisions costs every future reader who has to page past them looking for the ones that
matter.
