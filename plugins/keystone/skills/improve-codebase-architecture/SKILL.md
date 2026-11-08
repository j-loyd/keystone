---
name: improve-codebase-architecture
description: Find deepening opportunities in a codebase, informed by the domain language in GLOSSARY.md, the decisions in docs/adr/, and the structural map in docs/codebase/. Use when the user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase more testable and AI-navigable.
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities**: refactors that turn
shallow modules into deep ones. The aim is testability and AI-navigability.

This is the **additive** counterpart to two neighbours; know which one you want:

- **`audit`**: whole-repo but _subtractive_. It cuts structure that costs more than it earns.
  Opposite thrust to this skill's.
- **The built-in `/simplify`**: diff-scoped, behaviour-preserving _clarity_ (flatten, rename).
  Never structural, so not this either.

They share one referee, the **deletion test**. See _Reconciling with audit_ at the end of this
file for the one case where the two collide.

## Vocabulary

Load the `codebase-design` skill (Claude Code: the Skill tool with `keystone:codebase-design`)
for the architecture vocabulary (**module**, **interface**, **depth**, **seam**, **adapter**,
**leverage**, **locality**) and its principles (the deletion test, "the interface is the test
surface", "one adapter = hypothetical seam, two = real"). Use those terms exactly in every
suggestion; don't drift into "component," "service," "API," or "boundary."

Use `GLOSSARY.md` vocabulary for the domain. If `GLOSSARY.md` defines "Order," talk about "the
Order intake module," not "the FooBarHandler," and not "the Order service." If only a legacy
`CONTEXT.md` exists, treat it as the glossary and offer `git mv CONTEXT.md GLOSSARY.md`.

## Process

### 1. Scope, then ground, then explore

**Scope before you scan (YAGNI).** Deepening pays off by making future changes easier, so weight
the parts of the codebase that actually change:

- If the user named a direction (a module, a subsystem, a pain point), take it and skip the
  inference below.
- Otherwise walk back a good stretch of history to find the hot spots, the files and areas that
  keep coming up, and let them pull your attention first:

  ```bash
  git log --since=6.months --name-only --format= | sort | uniq -c | sort -rn | head -30
  ```

  If the changes are scattered with no clear hot spot, widen the net.

**Ground candidates in what's already documented** before exploring cold:

- **`docs/codebase/CONCERNS.md`**, if `onboard-codebase` has run. Its tech-debt and
  surprising-behavior entries are pre-vetted starting candidates (`onboard-codebase` names this
  skill as their handoff), so start there instead of re-discovering the same friction.
- **`docs/codebase/ARCHITECTURE.md` / `STRUCTURE.md` / `CONVENTIONS.md`**, if present, for fast
  orientation on layers, entry points, and established idioms, so a "deepening" isn't actually
  just the codebase's existing convention. Check `INDEX.md`'s `Built at: <sha>` against `HEAD`;
  treat the map as directional if the repo has moved on since it was built.
- **`GLOSSARY.md`** and **`docs/adr/`** in the area you're touching: domain names for good
  seams, and decisions this skill should not re-litigate.

None of these replace exploration; they narrow where you look first.

**Explore.** Walk the scoped area with a read-only explorer subagent with a fresh context
(Claude Code's Agent tool with an explore-type agent, or the equivalent elsewhere; no subagent
dispatch means walk it yourself in a clean pass). Explore organically and note where you
experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow**, with an interface nearly as complex as the implementation?
  (`codebase-design`'s `DEEPENING.md` has concrete signals.)
- Where have pure functions been extracted just for testability, but the real bugs hide in how
  they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate
complexity, or just move it? A "yes, concentrates" is the signal you want.

### 2. Present candidates as an HTML report

Write a self-contained HTML file to the OS temp directory so nothing lands in the repo: resolve
the temp dir from `$TMPDIR`, falling back to `/tmp` (or `%TEMP%` on Windows), and write
`<tmpdir>/architecture-review-<timestamp>.html`. Open it for the user (`xdg-open` on Linux,
`open` on macOS, `start` on Windows) and tell them the absolute path.

Each candidate is a card with **Files**, **Problem**, **Solution** (plain English), **Benefits**
(in terms of locality and leverage, and how tests would improve), a **Before / After diagram**,
and a **Recommendation strength** badge (`Strong`, `Worth exploring`, `Speculative`). End with a
**Top recommendation**: which candidate you'd tackle first and why. See
[HTML-REPORT.md](HTML-REPORT.md) for the scaffold, diagram patterns, and styling.

**ADR conflicts**: surface a candidate that contradicts an existing ADR only when the friction is
real enough to warrant revisiting it, and mark it in the card (_"contradicts ADR-0007, but worth
reopening because…"_). Don't list every theoretical refactor an ADR forbids.

Do NOT propose interfaces yet. After the file is written, ask: "Which of these would you like to
explore?"

### 3. Grilling loop

Once the user picks a candidate, load the `grilling` skill and walk the design tree with them:
constraints, dependencies, the shape of the deepened module, what sits behind the seam, what
tests survive. Load the `domain-modeling` skill alongside it so side effects happen inline:

- **Naming a deepened module after a concept not in `GLOSSARY.md`?** Add the term (format:
  [GLOSSARY-FORMAT.md](../domain-modeling/GLOSSARY-FORMAT.md)). Create the file lazily.
- **Sharpening a fuzzy term?** Update `GLOSSARY.md` right there.
- **User rejects the candidate with a load-bearing reason?** Offer an ADR: _"Want me to record
  this as an ADR so future architecture reviews don't re-suggest it?"_ Only when a future explorer
  would need the reason; skip ephemeral ("not worth it right now") and self-evident ones. See
  [ADR-FORMAT.md](../domain-modeling/ADR-FORMAT.md).
- **Want alternative interfaces for the deepened module?** Use `codebase-design`'s
  [DESIGN-IT-TWICE.md](../codebase-design/DESIGN-IT-TWICE.md) parallel-design pattern and its
  three-question scoring.

## Reconciling with audit (the call that's easy to get wrong)

`audit` will sometimes flag the very thing this skill wants to deepen: a module with a single
current caller looks identical to a pass-through until you check. Run the **deletion test** before
you commit either direction:

> Imagine deleting the module. If the complexity **vanishes**, it was a pass-through: that's
> `audit`'s `yagni:`/`delete:` territory, not a deepening candidate. If the complexity
> **reappears across N callers** (even if N is 1 today and a second call site is imminent), it
> was earning its keep: deepen it.

Don't put a candidate in the HTML report that a straight-faced over-engineering audit would flag
for deletion instead. Run the test yourself, in the report, not after the fact.
