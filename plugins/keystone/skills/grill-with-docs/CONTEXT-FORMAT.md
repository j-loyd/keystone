# CONTEXT.md Format

## Contents

- Structure
- Language
- Rules
- Anti-patterns
- Sharpening an existing entry
- Single vs multi-context repos
- Contexts
- Relationships

## Structure

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
- **Only include terms specific to this project's context.** General programming concepts (timeouts, error types, utility patterns) don't belong even if the project uses them extensively. Before adding a term, ask: is this a concept unique to this context, or a general programming concept? Only the former belongs.
- **Group terms under subheadings** when natural clusters emerge. If all terms belong to a single cohesive area, a flat list is fine.
- **No implementation details, ever.** `CONTEXT.md` is a glossary, not an architecture doc —
  that's `docs/codebase/ARCHITECTURE.md` if `onboard-codebase` has run. A definition that names
  a table, a class, a status code, or a function has let implementation leak into vocabulary.

## Anti-patterns

**Bad** — implementation leaking into the definition (breaks the moment the schema changes):

```md
**Order**:
A row in the `orders` table with a `status` enum (`pending`, `shipped`, `cancelled`) created by
`OrderService.create()`.
```

**Good** — what it IS, in domain terms:

```md
**Order**:
A customer's request to purchase one or more products, from placement through fulfillment or cancellation.
_Avoid_: Purchase, transaction, cart (a Cart becomes an Order once placed — they're not synonyms).
```

**Bad** — vague enough to mean anything, which means it resolves nothing:

```md
**Account**:
Represents a user in the system.
```

**Good** — forces the precision the vague version dodged:

```md
**Customer**:
A person or organization that places Orders. Has billing and shipping details.
_Avoid_: Account, client, user — Account and User describe authentication identity, a separate
concept from Customer; a User can act on behalf of multiple Customers (agency accounts).
```

## Sharpening an existing entry

Resolving a term is rarely a first write — usually it's editing a definition that was already
"close enough." When a grilling session reveals an entry was imprecise, replace it in place;
don't append a second, competing definition below it.

```diff
 **Cancellation**:
- The act of stopping an Order.
+ Marking an Order void before fulfillment begins. Does not imply a refund — see Refund.
  _Avoid_: Cancel, void (verb; use Cancellation as the noun form consistently)
```

## Single vs multi-context repos

**Single context (most repos):** One `CONTEXT.md` at the repo root.

**Multiple contexts:** A `CONTEXT-MAP.md` at the repo root lists the contexts, where they live, and how they relate to each other:

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md) — receives and tracks customer orders
- [Billing](./src/billing/CONTEXT.md) — generates invoices and processes payments
- [Fulfillment](./src/fulfillment/CONTEXT.md) — manages warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment → Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

The skill infers which structure applies:

- If `CONTEXT-MAP.md` exists, read it to find contexts
- If only a root `CONTEXT.md` exists, single context
- If neither exists, create a root `CONTEXT.md` lazily when the first term is resolved

When multiple contexts exist, infer which one the current topic relates to. If unclear, ask.
