---
name: auditing-for-overengineering
description: Scan for over-engineering and report what to cut — reinvented stdlib, unneeded dependencies, abstractions with one caller, dead flexibility. Use when the user says "audit this codebase", "what can I delete", or "/audit". Scope boundary — code architecture and dependencies, whole-repo; not UI, accessibility, or design quality. One-shot report that applies nothing.
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
- `defend:` error handling, validation, or a fallback for a case that cannot occur on any real
  path — a null check on a value the caller just constructed, a `try` around code that doesn't
  throw, re-validating a value a private helper was handed by its only in-process caller, a
  default branch for an exhaustive enum. Replacement: let it fail. Name the guarantee that makes
  the check dead. **If the "internal caller" is a separate service, process, or agent, that is a
  trust boundary, not an internal caller** — `api-security` puts it exactly: an internal caller
  is an unauthenticated caller with a friendlier name until something verifies it, and it
  forwards whatever a user handed it. Read the two cautions below before applying this tag.

## Hunt

Dependencies the stdlib or platform already ships; single-implementation interfaces;
factories with one product; wrappers that only delegate; files exporting one thing;
dead flags and config; hand-rolled stdlib; retry/cache/abstraction layers around
something that doesn't need them; defensive scaffolding for impossible states.

Two cautions on the `defend:` tag specifically, because it is the easiest one to get wrong.
**Trust boundaries are not bloat** — validation of anything crossing one (user input, a network
or tool response, a file, another service, model output) is load-bearing no matter how unlikely
the bad case looks, and cutting it is a security finding waiting to happen. And **"cannot occur"
must be a guarantee you can name** — a type, an invariant, a caller you have actually read — not
an assumption that the value looks fine today. If you cannot name it, the check stays.

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

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "It might be needed later" | Later has a cost today — tests, docs, review, and a shape every nearby change has to fit. If it's needed later it gets written later, with the actual requirement in hand. |
| "One caller now, but it's future-proofing" | Run the deletion test rather than the forecast. A seam built for a second case that hasn't arrived is a guess with maintenance attached. |
| "Removing the wrapper touches a lot of files" | A mechanical rename across many files is cheap to make and cheap to review. The wrapper is a concept every future reader carries. Diff breadth isn't difficulty. |
| "We cut 400 lines — that's the win" | Lines are the scoreboard, not the score. Removing one concept a reader had to hold beats deleting four files of boilerplate. |
| "I can't see why this exists, so it's bloat" | Not from the diff, you can't. The purpose usually lives outside the file — a caller, a config key, a scheduled job, an incident. Not finding the reason isn't evidence there isn't one. |
| "It's more flexible this way" | Flexibility nobody has exercised is untested by construction. Name the second case that would use it; if you can't, it's an option set with an audience of zero. |
| "The dependency is tiny, dropping it isn't worth it" | Size isn't the cost. A dependency is supply chain, upgrades, and a pin held forever. The question is whether the platform already does the job. |
| "It's only one more layer" | Layers are counted by the reader traversing them, not by the author adding them — each one is another file to open before the real work appears. |
| "The extra error handling is harmless — it just never fires" | It is not free: it is code a reader has to decide the meaning of, a branch tests must either cover or leave uncovered, and a claim that the impossible case is possible. Handling that can't fire also hides the real bug, converting a loud crash into a plausible wrong answer. Delete it, or name the trust boundary that makes it real. |

## Red flags

- An abstraction defended by a use case nobody has requested or scheduled
- A wrapper or adapter whose interface is roughly as large as the thing behind it
- Flags, options, or config where nothing in the tree sets anything but the default
- "Generic" machinery with one concrete implementation, named for the category rather than the case
- A net-lines total reported with no statement of which concepts went away
- Code called dead with no sweep for dynamic callers — reflection, string dispatch, scheduled jobs, config
- The deletion test skipped on a one-caller module, so a deep module and a pass-through get the same tag
- A dependency carried for a single function the standard library or platform already provides
