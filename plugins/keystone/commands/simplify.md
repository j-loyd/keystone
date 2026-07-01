---
name: simplify
description: Apply a behavior-preserving clarity pass to recently-modified code — flatten nesting, remove redundancy, name for intent, then verify the change didn't alter behavior. Scoped to the current diff by default.
argument-hint: "[optional: paths, a base branch, or 'whole file']"
allowed-tools:
  - Bash
  - Read
  - Edit
  - Grep
  - Glob
---

# Simplify — make it clearer, change nothing it does

Apply a clarity pass to the code in **$ARGUMENTS** (default: the current diff against its
base — the work just written, not the whole repo). This command is **apply mode**: the user
asked, so make the edits, then prove behavior is preserved.

Follow the **`simplifying-code`** skill for the full method. The short version:

## Process

1. **Set scope.** Default to recently-modified code: `git diff` against `git merge-base`, or
   the paths in `$ARGUMENTS`. Don't sweep code the user didn't touch unless they said so
   ("whole file" / a path).

2. **Read before you cut.** Read the surrounding code and the project's conventions
   (`CLAUDE.md`, `CONVENTIONS.md`, the `docs/codebase/` map if present) so you match _this
   repo's_ idioms, not generic ones. Apply the `coding-standards` baseline.

3. **Establish the baseline.** Run the repo's tests / type-checker / linter _now_, before
   editing, so a pre-existing failure isn't mistaken for one you caused. Note what's green.

4. **Simplify — clarity over brevity.** Flatten nesting with guard clauses, remove dead code
   and redundancy, rename for intent, drop comments that restate the code, untangle
   conditionals (no nested ternaries). Do **not** trade clarity for fewer lines, merge distinct
   concerns, delete load-bearing abstractions, or touch anything that looks behavior-bearing —
   flag those instead. (See the skill's "Maintain balance" section.)

5. **Prove it's behavior-neutral** (`verification-before-completion` — evidence, not claims).
   Re-run the suite/type-checker/linter; it must be as green as the baseline. No coverage for
   the touched path? Say so and reason through the call sites by hand. Diff each hunk and revert
   any you can't convince yourself preserves behavior.

6. **Report.** Group what changed and why; state exactly what you ran to verify; list anything
   you left alone on purpose. Leave the change **staged, not committed** (the
   no-auto-commit rule).
