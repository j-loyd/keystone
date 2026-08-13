---
name: office-hours
description: Heavy feature-scoping session — forcing questions, landscape scan, and 3 distinct approaches before any code. Use for net-new features or ambiguous problems.
argument-hint: "[what you want to build / the problem]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Office Hours — scope before you build

Heavy scoping session for a net-new feature or an ambiguous problem: **$ARGUMENTS**

For lightweight idea exploration, the `brainstorming` skill is the lighter tool — use
this command when the problem is big or fuzzy enough to deserve a real interrogation.

## Process

### 1. Map the context (read, don't assume)

- Explore the codebase for what already exists in this area. Reuse beats build — name
  the existing functions/modules/patterns you find.
- If a `CONTEXT.md` glossary or `docs/adr/` exists, read them and speak the project's
  language. (Pairs with the `grill-with-docs` and `zoom-out` skills.)

### 2. Six forcing questions

Ask these **one at a time**, waiting for an answer before the next. Give your
recommended answer with each.

1. **Who is this for, and what do they do today instead?**
2. **What's the smallest version that delivers real value?** (Cut scope to the bone.)
3. **What's the riskiest assumption?** If it's wrong, the whole thing changes.
4. **What does "done" look like** — concretely, observably?
5. **What are we explicitly NOT doing** in this version?
6. **What does this make harder later?** (The cost nobody mentions.)

While the answers come back, listen for what the user thinks they *should* want rather than
what they want: best-practice talk with no specifics ("scalable", "clean architecture"),
deference to convention, "I should probably…", a buzzword standing in for an outcome. The
`brainstorming` skill carries the full detector and the sycophancy caveat; the probe that
unlocks it is *"if you didn't have to justify this to anyone, what would you actually want?"*

Then, once the shape is clear, go domain-deep: when the feature touches auth, data, payments, realtime, search, file upload, LLM/agent, etc., pull targeted follow-ups from the `brainstorming` skill's `domain-probes.md` cheatsheet — the expert-level questions that surface design-determining decisions.

### 3. Landscape scan

Before proposing a custom build, search for how this is normally solved (libraries,
prior art, existing internal patterns). Surface what you'd reuse vs. build.

### 4. Three distinct approaches

Present **three genuinely different** approaches — not one idea with variations.
Frame each as a trade-off (e.g. MVP-first / robust-but-slower / buy-vs-build). For each:
scope, effort estimate (honest, with assumptions stated), and what it forecloses. For each
approach, reach for the type-matched lenses in the `brainstorming` skill's `section-lenses.md`
(e.g. a decision section → pre-mortem + adversarial pass; a data section → MECE + constraint
analysis) before recommending.

### 5. Recommend + hand off

State your recommendation and why. Then offer to write it up with the `writing-plans`
skill, or to interrogate it further with `grill-with-docs`.

**Do not write implementation code in this command.** This is scoping only.
