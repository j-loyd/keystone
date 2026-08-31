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

## Documentation & API claims

A load-bearing claim about a third-party API — a signature, a parameter name, a default —
gets checked against that library's docs. Recalled-not-checked is a guess, and it reads
identically to a fact.

- **Take the version from the manifest, not from memory of the library.** The behavior that
  matters is the behavior of the version this project actually resolves; read that version's
  docs, not the latest ones.
- **Cite an anchored deep link, not a bare domain.** An anchor points at the claim and
  survives a doc restructure; a bare domain sends the next reader back to the search box.
- **Flag what you couldn't confirm with an explicit `UNVERIFIED:` marker.** Hedged prose
  ("should be", "I believe") reads as confidence at a glance and gets skimmed past —
  `UNVERIFIED: option name not confirmed against the pinned version` does not. Carry the
  marker into the PR description too, so the claim is reviewable and not just greppable;
  it's the concrete form of the hedge `verification-before-completion` permits.

## Tests

- **AAA** (Arrange / Act / Assert); one behavior per test.
- Descriptive names: `returns empty array when no markets match`, not `works`.

## Dependencies

Upgrading a dependency is a code change someone else wrote, landing in your build. Review it
like one.

- **Read the changelog, not the version number.** Semver is a promise the maintainer may not
  have kept — a patch release can carry behavioral change, and a major can be a no-op for how
  you use the library. The version string tells you what was intended, not what shipped.
- **One dependency per change.** A bulk bump is cheap to make and expensive to debug: when the
  build breaks you've lost which package did it. Batch only when the ecosystem forces it — a
  framework and plugins that pin each other move together or not at all.
- **Green suite before and after.** Run it before the bump too, so a failure after is
  attributable. If coverage around that dependency is thin enough that a break wouldn't show,
  that thinness is the finding — not a reason to skip the check.
- **Review the lockfile diff, not just the manifest.** Most of what's installed is transitive —
  packages nobody chose directly. A one-line manifest edit (`package.json`, `pyproject.toml`,
  `Cargo.toml`) routinely moves dozens of packages visible only in the lockfile.
- **Don't hand-edit the lockfile — regenerate it.** A hand-edited lockfile no longer describes a
  resolution the package manager would produce, which is the one thing it exists to guarantee.
  Change the manifest and let the tool rewrite it.

## Deliberate shortcuts — mark them or they rot

When you knowingly take a shortcut — a stub, a hardcode, the simplest-thing-that-works you
know has a ceiling — leave a marker comment naming its limit **and** what should trigger the
upgrade. Convention: `keystone: <ceiling>, <upgrade trigger>`.

```py
# keystone: in-memory dict, fine under ~1k entries; swap for Redis when this runs multi-process.
```

`/debt` harvests these into a ledger. A shortcut with a named trigger is _managed_ debt; one
with **no trigger** is the kind that silently becomes permanent — so always name the trigger.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "I'll clean it up in a follow-up" | The follow-up competes with the next feature and loses. It's cheapest now, with the file open and the context in your head; if it genuinely must wait, it needs a marker with a trigger, not an intention. |
| "They might diverge later" | Duplication defended by a future that hasn't happened. If they diverge, splitting one function is an afternoon; if they don't, every fix has to find both copies — and a duplicated correctness rule drifts without anything failing. |
| "The number's meaning is obvious here" | Obvious to whoever just wrote it. The next reader gets a value with no unit, no source, and no way to tell whether changing it is safe. |
| "Casting to `any` here is fine, I know the shape" | The cast doesn't record what you know — it deletes the check that would have caught you being wrong. If the shape is genuinely unknown, say unknown and narrow. |
| "The type error is the type system being wrong" | Occasionally. More often the model in the code doesn't match the model in your head, and loosening the type moves the failure to runtime, in someone else's week. |
| "There's a package for this" | A dependency is an install-time execution surface, a lockfile diff, an upgrade obligation, and someone else's release schedule. Worth it for the hard problems — crypto, parsing, time zones. Rarely worth it for a function you could read end to end. |
| "It's a small abstraction, it'll pay for itself" | Run the deletion test: name what breaks without it today. A layer with one caller is speculative, and speculative structure is harder to remove later than it was to add. |
| "I'll add the types and tests once the shape settles" | The shape settles when it ships and something else starts depending on it. That's after the window, not before it. |
| "It's long, but it's all one flow" | Length isn't the complaint; the number of reasons the function has to change is. If you can name its sections, those are the functions. |
| "Comments here would just restate the code" | True of the *what*, which is why the comment goes on the *why* — the constraint, the reason for the odd ordering, the approach that didn't work. |

## Red flags

- A `TODO` with no owner or trigger — or a marked shortcut that names its ceiling but not what should prompt the upgrade
- The same constant, regex, or business rule living in two files
- A type escape hatch added to silence an error, with no comment saying why it's sound
- An empty catch, or one that logs and continues past a failure the caller needed to know about
- A function whose name contains "and", or whose body needs section comments to be navigable
- A new dependency for something the language's standard library already does
- Names that only make sense from the line they sit on — `d`, `tmp`, `data2`, `handle`
- A test named after the function rather than the behavior, or named `works`
- A comment restating the line beneath it, next to an exported function with no docstring
- A change that renames or restructures files the work didn't need to touch
- A claim about a third-party API with no anchored link, or hedged prose standing in for a checked fact
- A hand-edited lockfile, or several unrelated packages bumped in one change

---

**On review:** the leverage is in correctness-critical DRY (a duplicated invariant),
real type holes, and unhandled failure paths — not stylistic nits. Flag what would cause a
bug or a drift; leave taste calls as suggestions.
