---
name: auditing-for-overengineering
description: Scan for over-engineering and report what to cut — reinvented stdlib, unneeded dependencies, abstractions with one caller, dead flexibility. Use when the user says "audit this codebase", "audit for over-engineering", "what can I delete", "find bloat", "is this over-engineered", or "/audit". Whole-repo by default; the same lens runs diff-scoped inside /review. One-shot report — lists findings, applies nothing.
---

# Auditing for Over-Engineering

Find structure that costs more than it earns and report **what to cut**. The best
outcome of this pass is the codebase getting **smaller**. You list findings; you
apply nothing (that keeps the pass cheap to run and safe to ignore).

This is the **subtractive** counterpart to two neighbouring skills — know which one you want:

- **`simplifying-code`** — diff-scoped, behaviour-preserving _clarity_ (flatten, rename). Not this.
- **`improve-codebase-architecture`** — whole-repo but _additive_: deepen shallow modules. Its
  opposite thrust. See **Reconciling with deepening** below — they share one referee.

## Scope: one lens, two ranges

The taxonomy below is the same whether you scan a diff or the tree. The range is set by
how you were invoked:

- **`/audit`** (or "audit this repo") → **whole tree**, ranked biggest cut first.
- **`/review`** → the **diff**, as its reuse-and-over-engineering pass.

## Tags

One per finding. Every tag **names the replacement** — a finding without one is a taste call, not a cut.

- `delete:` dead code, unused flexibility, a speculative feature. Replacement: nothing.
- `stdlib:` a hand-rolled thing the standard library already ships. Name the function.
- `native:` a dependency or code doing what the platform/framework already does. Name the feature.
- `yagni:` an abstraction with one implementation, config nobody sets, a layer with one caller. Inline it until a second case exists.
- `shrink:` same behaviour, fewer lines. Show the shorter form.

## Hunt

Dependencies the stdlib or platform already ships; single-implementation interfaces;
factories with one product; wrappers that only delegate; files exporting one thing;
dead flags and config; hand-rolled stdlib; retry/cache/abstraction layers around
something that doesn't need them.

## Output

One line per finding, ranked biggest cut first:

`<tag> <what to cut>. <replacement>. [path:line]`

End with the only metric that matters: `net: -<N> lines, -<M> deps possible.`
If there is nothing to cut: `Lean already. Ship.` and stop.

```
stdlib: 27-line email-validator class. "@" check + the confirmation mail is the real validation. [auth/validate.py:12]
native: moment.js for one format call. Intl.DateTimeFormat, 0 deps. [web/date.ts:4]
yagni: AbstractRepository with one implementation. Inline it until a second exists. [data/repo.py:88]
delete: retry wrapper around an idempotent local call. Nothing replaces it. [jobs/run.ts:52]
shrink: manual loop builds a dict. dict(zip(keys, values)), 1 line. [etl/map.py:30]

net: -180 lines, -1 dep possible.
```

## Boundaries

- **Over-engineering only.** Correctness bugs → `/review`. Security holes → `security-review`
  / `/cso`. Performance → out of scope. Route them; don't fold them in here.
- **Tests are not bloat.** A smoke test or an `assert`-based self-check is the minimum, not
  excess — never flag it for deletion. (Missing tests are `/review`'s problem, not this pass's.)
- **Lists, applies nothing.** One-shot. To act on the findings, the user runs `simplify`
  for the clarity-safe cuts or hands the structural ones to an implementer.

## Reconciling with deepening (the call that's easy to get wrong)

`improve-codebase-architecture` will sometimes _add_ an abstraction (consolidate scattered
logic into one deep module); this skill _removes_ them. They only collide on one thing — a
module with a single current caller — and the **deletion test** is the shared referee:

> Imagine deleting the module. If the complexity **vanishes**, it was a pass-through → tag it
> `yagni:` / `delete:`. If the complexity **reappears across N callers**, it was earning its
> keep → leave it, even at one caller today.

A genuinely deep module that hides real complexity behind a small interface is **not**
over-engineering, even with one caller — run the deletion test before you tag it. What you're
hunting is the inverse: an interface nearly as complex as the implementation behind it.
"One adapter = hypothetical seam; two = real seam" — flag the hypothetical seams, keep the real ones.
