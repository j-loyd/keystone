---
name: debt
description: Harvest deliberate-shortcut markers (keystone: comments) into a ledger and flag the ones with no revisit trigger — the kind that silently become permanent. Reports only; optionally persists.
argument-hint: "[optional: 'save' to write the ledger to a file]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# Debt — what did we mark to revisit?

Collect the deliberate shortcuts left in the code into one ledger, so a deferral can't quietly
become permanent. Deliberate shortcuts are marked `keystone: <ceiling>, <upgrade trigger>`
(see the `coding-standards` skill). This command **reports only** unless asked to save.

## Process

1. **Scan** for the markers, skipping `node_modules`, `.git`, and build output:

   ```bash
   grep -rnE '(#|//|/\*) ?keystone:' . \
     --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build
   ```

   The comment prefix keeps prose that merely _mentions_ the convention out of the ledger. Add
   other comment prefixes if the stack uses them.

2. **Build one row per marker, grouped by file.** Pull the ceiling and trigger straight from
   the comment (`keystone: <ceiling>, <upgrade trigger>`):

   `<file>:<line> — <what was simplified>. ceiling: <the limit>. upgrade: <the trigger>.`

   Want an owner per row? add `git blame -L<line>,<line> -- <file>`.

3. **Flag the rot risk.** Any marker that names **no upgrade trigger** gets a `no-trigger` tag —
   those are the ones that silently rot. End with `<N> markers, <M> with no trigger.`
   Nothing found → `No deferred shortcuts marked. Clean ledger.`

4. **Persist only if asked.** If `$ARGUMENTS` is `save`, write the ledger to `DEBT.md` at the
   repo root (confirm the path first). Otherwise leave it in the reply. Do not commit or push
   (the no-auto-commit rule).
