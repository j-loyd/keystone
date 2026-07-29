---
name: writing-skills
description: Author or revise an agent skill so it actually fires and actually helps — description triggers, freedom calibration, progressive disclosure, and the conflict sweep. Use when creating a skill, editing one, or when the user says "this skill never fires", "write a skill for", "clean up this skill", or "why didn't that trigger". Covers this kit's house rules and the structural checks that catch silent breakage.
---

# Writing Skills

Two failure modes, and they are not the same problem. A skill that **never fires** is a
description problem. A skill that fires and **makes the work worse** is a calibration problem.
Diagnose which one you have before editing anything.

## Descriptions — the only part that is always loaded

Every skill's description sits in context on every turn, whether or not the skill is used. It is
the entire basis on which the skill gets selected. Everything else in the file is free until
something loads it.

**Shape:** what it does, then when to reach for it, in that order.

```yaml
description: Scan for over-engineering and report what to cut — reinvented stdlib, unneeded
  dependencies, abstractions with one caller. Use when the user says "audit this codebase",
  "what can I delete", or "/audit". Scope boundary — code and dependencies, not UI or design.
```

- **Quote the phrases a user actually types.** "Use when implementing a feature" describes a
  state the model has to infer it is in. `"write a test"`, `"TDD this"` are strings that match.
- **One trigger per branch.** Multiple phrasings of the *same* path are waste; phrasings that
  route to *different* paths through the skill are not. `finishing-a-development-branch` keeps
  merge / PR / cleanup because those are three real endings.
- **Lean pushy.** Models under-trigger skills more often than they over-trigger them. When in
  doubt, include the trigger.
- **State the boundary when a neighbour exists.** If another skill, a built-in, or another
  plugin claims adjacent ground, say what this one does that the neighbour doesn't — otherwise
  they split the vote and neither wins.
- Keep it under 1024 characters. Avoid `: ` inside a plain YAML scalar.

## Calibrate freedom to fragility

The most common authoring mistake is applying one voice to everything — either rules for
material that needs judgment, or judgment for material that needs rules.

| The task is | Write it as | Because |
| ----------- | ----------- | ------- |
| **A narrow bridge** — destructive, irreversible, or corrupts downstream work when wrong | An explicit ordered sequence. Name the steps that get skipped. | Variance is expensive and the failure is often silent |
| **An open field** — many valid routes, context decides | Direction and heuristics. Trust the model to route. | Prescription here buys a worse answer at higher token cost |

Merge conflicts, migrations, and completion claims are narrow bridges. Code review, exploration,
and design are open fields. Most skills contain both — calibrate per section, not per file.

**Rigidity should arrive as specificity, not as volume.** "Run the full command in this turn and
read the exit code" constrains behavior. "This is MANDATORY, no exceptions, violating the letter
is violating the spirit" does not — it is scaffolding written against a model generation that
looked for loopholes, and it costs tokens without changing outcomes.

Prefer stating the target behavior over prohibiting its opposite. Reach for a prohibition when
the wrong action is genuinely destructive and specific — `never --abort as an escape from
tedium` earns its phrasing; `never write bad code` does not.

## Structure

- **`SKILL.md` under 500 lines.** Past that, push depth into sibling files.
- **References one level deep.** Every sibling links from `SKILL.md`; siblings do not link each
  other. Nested references get previewed with `head` instead of read.
- **Table of contents on reference files over 100 lines** — so a partial read still shows scope.
  Skip it on single-template files, where it is noise and risks being copied into a dispatch.
- **Co-locate a concept's definition, rules, and caveats** under one heading. Splitting them
  means one gets loaded without the other.
- **Name files for their content** — `harness-notes.md`, not `extra.md`.

Push inline what every path needs. Push behind a pointer what only some paths reach.

## Before you ship it — the conflict sweep

The failure that survives review is not a bad instruction; it is **two good instructions that
contradict each other**, sitting in files that are never read together. Grep the kit for the
subject you just wrote about:

```bash
# whatever your skill now asserts, check who else asserts something about it
grep -rniE "commit|push|test first|never|always" skills commands agents --include='*.md'
```

Real examples this kit has shipped: a skill instructing an agent to commit the design doc while
twelve other files said never auto-commit; a plan template handing an implementer a `git commit`
step its own agent definition forbade. Both read fine in isolation.

Check specifically for: verbs another skill owns, rules stated with different thresholds, and
anything the harness or a house rule already covers.

## Structural checks that catch silent breakage

Markdown fails quietly. Run these on anything you split or restructure:

```bash
# balanced code fences (an odd count means a block got cut in half)
grep -cE '^\s*`{3,}' FILE

# headings that live INSIDE a fence are not sections — never split on them
# (a `## Summary` inside a `gh pr create` heredoc is PR body text, not a document section)

# every relative .md link resolves, and every sibling is reachable from SKILL.md
```

A regex that splits on `^## ` without tracking fence depth will eventually cut a heredoc in
half. It has happened here.

## House rules for this kit

- **Harness-neutral.** Skills run on more than one agent harness. Name orchestration primitives,
  subagent dispatch, and hooks as *instances* with a graceful fallback — the prose gate is the
  cross-harness baseline; a hook is enforcement teeth on the harnesses that have them.
- **No hardcoded model names, IDs, or prices.** Tier language only (cheap / mid / high / top),
  plus instructions to resolve current values live. Pricing tables rot within weeks.
- **No auto-commit.** Skills prepare work and stop. Staging is fine; committing is the user's call.
- **No announcement preamble.** The harness already shows which skill fired.
- **Record provenance.** Anything adapted from an upstream project gets an `ATTRIBUTION.md`
  entry with its license notice. Credit is never removed, only kept current.

## Anti-patterns

- **Sediment** — layers accumulated across edits that no longer agree with each other. Prune
  deliberately; a skill that has been edited five times has usually never been *read* once.
- **No-op lines** — sentences that change no behavior. Test each one: if deleting it changes
  nothing about what the agent does, delete it.
- **Duplication** — the same meaning in two skills. Give it one owner and point at it.
- **Restating the model's defaults** — if a capable model already does it, the line is waste.
- **Adding a skill when an existing one should grow a branch.** Every new skill makes every
  other skill harder to retrieve. Merging is a legitimate outcome of this skill.

## Verifying it works

Structure checks tell you the file is well-formed, not that the skill is any good.

1. **Name the gap first.** Run a representative task *without* the skill and note what actually
   went wrong. If nothing did, you do not need the skill.
2. **Write the minimum that closes that gap** — not everything you know about the subject.
3. **Test on a fresh context**, not this conversation. You know what you meant; a cold session
   does not.
4. **Watch what gets read.** A sibling file nothing ever opens is either mis-signposted or
   unnecessary. A file read on every run belongs in `SKILL.md`.
5. **Test on the weakest model you ship to.** Guidance calibrated for a top-tier model can be
   too sparse for a cheaper one running the same skill in a subagent.
