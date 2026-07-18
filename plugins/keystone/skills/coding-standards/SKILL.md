---
name: coding-standards
description: Cross-cutting, stack-agnostic coding baseline — naming, DRY/KISS/YAGNI, type-safety, error handling, magic numbers, function length, comments, tests. Use when writing or reviewing code in any language/runtime. For framework-specific patterns use a narrower skill (impeccable for React/UI, api-security for endpoints).
---

# Coding Standards (cross-cutting baseline)

The shared floor for code quality in **any** language or runtime — TypeScript/Node,
Cloudflare Workers (Hono), Python, etc. Examples are illustrative, not stack-specific; apply
the principle, not the syntax.

**Not in scope here** (use the narrower skill): React/UI/state/rendering → `impeccable`;
endpoint/API security and authz → `api-security`; framework idioms → that framework's skill.
**Always defer to the established idioms of the file you're editing** over a generic rule.

## Principles

- **Readability first** — code is read far more than written; clear names beat clever code.
- **KISS** — the simplest thing that works; no speculative abstraction.
- **DRY** — a correctness-critical value or rule derived in two places will drift. Centralize
  it. (This is the highest-value thing to catch in review.)
- **YAGNI** — build for the requirement in front of you, not an imagined one.
- **The deletion test** — before adding any abstraction, layer, gate, or config knob, ask
  what concretely breaks without it; "nothing yet" means don't add it. AI-assisted code
  drifts over-engineered by default — write like someone who knows `/audit` will read it.

## The Boy Scout rule — leave it better than you found it (within your footprint)

Leave the code you touch a little better than you found it: while you're in a function
anyway, extract the magic number, fix the misleading name, delete the line your diff just
orphaned. Small improvements compound — and without them, entropy compounds instead.

The boundary that keeps this from becoming scope creep — a boy-scout cleanup is all three of:

1. **inside code your change already touches** (same functions/lines, not "same repo"),
2. **seconds-to-minutes** of work,
3. **zero blast radius** — behavior-preserving, no interface or contract change.

Anything bigger — refactoring an untouched module, swapping a dependency, "while I'm here"
restructuring — is not boy-scouting: record it (`/learn`, or a `keystone:` marker for
`/debt`) and stay on task. It cuts both ways in review: don't flag a genuine boy-scout
cleanup as out-of-scope noise — that's the maintenance culture working as intended.

## Naming

```ts
// good — descriptive, verb-noun for functions
const marketSearchQuery = "election";
async function fetchMarketData(id: string) {}
function isValidEmail(e: string): boolean {}

// bad — opaque
const q = "election";
function market(id) {}
```

## Type safety

Use real types; avoid `any`/untyped escapes. Make illegal states unrepresentable where the
language allows (unions, enums, branded types). In TS, prefer `unknown` + narrowing over `any`.

## Immutability — where it matters (and where it doesn't)

Immutability is about **shared or observed state**, not a blanket ban on assignment.

- **DO treat as immutable:** values others hold a reference to — framework state (e.g. React
  state/props), module-level or cached objects, function arguments you don't own, anything
  observed concurrently. Mutating these in place causes spooky action-at-a-distance bugs.

  ```ts
  const updated = { ...user, name: "New" }; // don't mutate a shared `user`
  ```

- **DON'T over-apply it:** building a **fresh local** value you own is fine to assemble by
  mutation/incremental assignment — it's often clearer than nested conditional spreads.

  ```ts
  const out: Result = { id };
  if (hasPayment) out.payment = computePayment(); // fine: `out` is local, unobserved
  if (hasAdjustment) out.adjustment = adj;
  return out;
  ```

Rule of thumb: **don't mutate what you didn't just create.** "Always spread / never mutate"
stated as an absolute generates worse code on backend/builder paths — ignore it there.

## Error handling

- Handle failure explicitly; **fail closed** for anything security- or correctness-relevant.
- Don't swallow errors silently; don't leak internals (stack traces, SQL) to callers/users.
- Validate untrusted input at the boundary (e.g. a schema like Zod) and reject clearly.

## Async

Run independent work concurrently; await sequentially only when there's a real dependency.

```ts
const [a, b, c] = await Promise.all([getA(), getB(), getC()]); // not three awaits in a row
```

## Magic numbers / strings

Name a literal **when the name adds meaning or it's used in more than one place** —
`MAX_RETRIES = 3`, `DEBOUNCE_MS = 500`. Judgment applies: a once-used, self-evident literal
(`* 0.01` for cents) may be clearer inline than behind a constant. Naming + duplication
together is the signal to extract.

## Function length & nesting

- Split functions that do too much; one clear responsibility each.
- Prefer **early returns / guard clauses** over deep nesting.

```ts
if (!user) return;
if (!user.isAdmin) return;
// ...happy path at the top indent level
```

## Comments & docs

- Comment the **why**, not the what. Don't narrate obvious code.
- JSDoc/docstrings for public/exported APIs: purpose, params, returns, throws, an example.

## Tests

- **AAA** (Arrange / Act / Assert); one behavior per test.
- Descriptive names: `returns empty array when no markets match`, not `works`.

## Deliberate shortcuts — mark them or they rot

When you knowingly take a shortcut — a stub, a hardcode, the simplest-thing-that-works you
know has a ceiling — leave a marker comment naming its limit **and** what should trigger the
upgrade. Convention: `keystone: <ceiling>, <upgrade trigger>`.

```py
# keystone: in-memory dict, fine under ~1k entries; swap for Redis when this runs multi-process.
```

`/debt` harvests these into a ledger. A shortcut with a named trigger is _managed_ debt; one
with **no trigger** is the kind that silently becomes permanent — so always name the trigger.

---

**On review:** the leverage is in correctness-critical DRY (a duplicated invariant),
real type holes, and unhandled failure paths — not stylistic nits. Flag what would cause a
bug or a drift; leave taste calls as suggestions.
