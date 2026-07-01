---
name: audit
description: Whole-repo scan for over-engineering — a ranked list of what to delete, replace with stdlib/native, or inline, ending in a net-lines scoreboard. Reports only; applies nothing.
argument-hint: "[optional: a path or subtree to scope the scan]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# Audit — what can this repo lose?

Scan **$ARGUMENTS** (default: the whole tree) for over-engineering and report what to cut.
This command **reports only** — it applies nothing, so it's safe to run anywhere.

Follow the **`auditing-for-overengineering`** skill for the taxonomy and the boundaries. The
short version:

## Process

1. **Set scope.** Default to the whole repo; narrow to the path(s) in `$ARGUMENTS` if given.
   Skip `node_modules`, `.git`, build output, and vendored/generated code.

2. **Read the conventions first.** `CLAUDE.md`, `CONVENTIONS.md`, and the `docs/codebase/` map
   if present — so you don't flag an idiom the repo deliberately uses as bloat.

3. **Hunt.** Dependencies the stdlib/platform already ships, single-implementation interfaces,
   factories with one product, wrappers that only delegate, files exporting one thing, dead
   flags and config, hand-rolled stdlib. Apply the **deletion test** before tagging anything
   that might be a genuinely deep module (see the skill's _Reconciling with deepening_).

4. **Rank and report.** One line per finding, biggest cut first:
   `<tag> <what to cut>. <replacement>. [path:line]`. End with
   `net: -<N> lines, -<M> deps possible.` Nothing to cut → `Lean already. Ship.`

5. **Stay in lane.** Over-engineering only. Park correctness for `/review`, security for `/cso`,
   and never flag tests as bloat. To act on a finding, point the user at `/simplify` (for the
   clarity-safe cuts) or an implementer (for the structural ones).
