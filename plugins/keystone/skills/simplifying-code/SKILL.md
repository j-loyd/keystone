---
name: simplifying-code
description: Refine recently-written code for clarity WITHOUT changing behavior — flatten nesting, drop redundancy, name for intent. Use after finishing a chunk of work, and when the user says "simplify this", "clean this up", or "/simplify". Stack-agnostic — derives conventions from the surrounding repo rather than assuming a framework. Proposes when self-triggered; /simplify applies.
---

# Simplifying Code

Tidy code so the next reader (often a model) understands it faster — **without changing what
it does**. This is a clarity pass over a diff, not a redesign. For structural changes
(splitting modules, moving seams, deepening interfaces) use `improve-codebase-architecture`
instead; that's a different, larger job. To hunt over-engineering across the repo — reinvented
stdlib, one-caller abstractions, dead config — use `auditing-for-overengineering` (`/audit`).

**Core principle:** behavior is sacred. You only change _how_ the code reads, never _what it
produces_. A simplification that alters a single output, error path, or side effect is a bug,
not a simplification.

## Two modes — know which one you're in

- **You triggered this skill yourself** (you just wrote a chunk of code and want to tidy it):
  **propose, don't apply.** Surface a short ranked list of the highest-value simplifications
  and let the user pick. Unprompted edits to code the user is mid-thought on are intrusive and
  erode trust — the whole point of keystone is deliberate, no-surprise changes.
- **Invoked via `/simplify`** (the user explicitly asked): **apply**, then verify and report.
  The command is the user opting in to edits.

When in doubt, propose. It costs one message; a wrong silent edit costs debugging.

## Scope: recently-modified code only

Default to the code touched in this session or the current diff (`git diff` against the
base) — not the whole file, not the whole repo. The user wants their _new_ work tidied, not a
surprise sweep of code they didn't ask you to touch. Widen scope only when explicitly told to
("simplify the whole module").

## What to simplify

Apply the principle, not a checklist — but these are the high-value moves:

- **Flatten nesting.** Early returns / guard clauses over deep `if` pyramids. Handle the edge
  case and bail; let the happy path live at the base indent.
- **Remove redundancy.** Duplicated blocks → one named thing. Dead code, unreachable branches,
  unused vars/imports, and abstractions with exactly one caller that only obscure → gone.
- **Name for intent.** A clear name beats a comment explaining a vague one. Rename `data2`,
  `tmp`, `handleStuff` to what they actually are.
- **Drop comments that restate the code.** Keep the ones that explain _why_ (a non-obvious
  constraint, a workaround, a gotcha); delete the ones that narrate _what_ an obvious line does.
- **Untangle conditionals.** No nested ternaries — use `if/else` or a `switch`/lookup. Collapse
  `if (x) return true; else return false` to `return x`. Lift inverted/De Morgan's-law tangles
  into readable form.
- **Consolidate related logic** that's been scattered, so one concern reads top-to-bottom.

## Maintain balance — the part that's easy to get wrong

Over-simplification is its own failure mode. **Clarity wins over brevity every time.** Do NOT:

- Collapse readable code into a dense one-liner, a clever chained expression, or a nested
  ternary just to cut lines. Fewer lines is not the goal; faster comprehension is.
- Merge distinct concerns into one mega-function because they were near each other.
- Delete an abstraction that's genuinely organizing the code (a well-named helper with two+
  callers, a boundary that isolates a dependency) — that's the deletion test's job, not yours.
- "Modernize" by swapping in syntax the surrounding code doesn't use — match the file, don't
  impose your favorite idiom.
- Touch behavior to make the code prettier (reordering side effects, changing an error type,
  "tidying" a deliberate-looking quirk). If it looks intentional, leave it and flag it instead.

If a change trades a little brevity for a lot of clarity, take it. If it trades clarity for
brevity, don't.

## Follow the project's conventions, not generic ones

There is no universal "clean" style — there's _this repo's_ style. Before editing:

- Read the surrounding code and match its idioms (naming, error handling, function shape).
- Honor `CLAUDE.md` / project rules and any `CONVENTIONS.md` (or the `docs/codebase/` map if
  `onboard-codebase` produced one).
- Apply the `coding-standards` skill for the cross-cutting baseline (DRY/KISS/YAGNI, naming,
  magic numbers). For stack-specific patterns, use the narrower skill (`impeccable` for
  React/UI, `api-security` for endpoints) rather than guessing.

Don't hardcode a language's conventions here — derive them from the code in front of you.

## Prove behavior is preserved — don't assert it

This is the keystone difference: the official simplifier _claims_ "functionality intact"; you
**verify** it (see `verification-before-completion` — evidence before claims, always). After
applying simplifications:

1. **Run the checks the repo already has** — the test suite (or the subset covering the touched
   code), the type-checker, the linter. Run them _before_ you start too if you're unsure of the
   baseline, so a pre-existing failure isn't blamed on you.
2. **If there are no tests for this code, say so** — don't pretend running an unrelated suite
   proves anything. Read the call sites and reason through the behavior explicitly instead, and
   note the gap in your report.
3. **Diff your own change** and confirm every hunk is behavior-neutral. If you can't convince
   yourself a hunk preserves behavior, revert that hunk.

A green suite before and after is the bar. "It looks equivalent" is not.

## Report

End with a short summary so the change is reviewable:

- **What changed and why** — grouped (e.g., "flattened 3 nested conditionals", "removed dead
  branch", "renamed `d` → `invoiceDate`"). Skip the line-by-line narration.
- **Verification** — exactly what you ran and the result (`npm test` → 42 passing; `tsc`
  clean), or an honest "no coverage for this path; reviewed call sites manually."
- **Left alone on purpose** — anything that looked simplify-able but you judged intentional or
  behavior-bearing, so the reviewer knows it was a decision, not an oversight.

Do not commit or push (see the no-auto-commit rule) — leave the change staged for review.
