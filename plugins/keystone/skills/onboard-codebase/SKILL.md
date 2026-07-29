---
name: onboard-codebase
description: Orient in a codebase on first contact and leave a durable map behind. Use when starting work in an unfamiliar repo and when the user says "what is this codebase" or "map this repo". Detects greenfield vs. brownfield and writes a committed docs/codebase/ map plus seeded domain docs — more than a one-file summary.
---

# Onboard to a codebase

Get productive in a repo you don't know yet — or set one up right from scratch. First
decide which situation you're in, then follow that track.

## Detect: greenfield or brownfield

- **Brownfield** — meaningful existing source (more than scaffolding). There's a system to
  understand before changing it.
- **Greenfield** — empty or freshly initialized (just a README/boilerplate). There's
  nothing to learn yet; the job is to set conventions.

Quick check: count source files, read the README, look at `git log` depth.

## Brownfield → map before you touch

The goal is a **durable, committed map** in `docs/codebase/` — so what you learn survives the
session and a teammate (or a future agent with fresh context) can read it instead of
re-deriving it. The map records facts about the code as it is.

### 1. Check for an existing map

If `docs/codebase/INDEX.md` exists, read its `Built at: <sha>` line and compare to `HEAD`.
Offer the user **Refresh** (rebuild the map) or **Skip** (the map is current enough). Only map
from scratch when there's no map or they choose Refresh.

### 2. Index the codebase

If a code-graph / indexing tool is available (e.g. a `graphify`-style skill that emits a
queryable `graphify-out/`), run it first — it becomes the model the mappers draw on (entry
points, callers, module dependencies). Otherwise the mappers fall back to direct exploration
with `Read`/`Grep`/`Glob`.

### 3. Build the map

Write the seven docs defined in [`codebase-map-format.md`](./codebase-map-format.md) to
`docs/codebase/`. Each doc is one focused file citing real backticked paths — observed, tight,
no secrets. Choose the mode by capability:

- **Parallel (Agent tool available — preferred):** dispatch one mapper subagent per doc using
  the template in [`codebase-mapper-prompt.md`](./codebase-mapper-prompt.md), following the
  `dispatching-parallel-agents` skill. Each runs in fresh context and writes its own doc
  directly; collect only confirmations (path + line count) to keep your context clean.
- **Sequential (no Agent tool):** make the passes yourself, inline, with file tools only —
  one doc at a time, same format contract.

Then write `INDEX.md` with the build SHA, branch, and current date (see the format file).

### 4. Secret-scan gate

Before declaring the map done, scan the generated docs for leaked secrets — API keys, tokens,
private keys, connection strings, JWTs (the patterns the `security-review` skill knows). On a
hit, stop and surface it; fix the doc to name the variable, not its value. Never commit a
secret into the map. Honor the no-auto-commit rule: prepare the docs and stop — committing is
the user's call.

### 5. Seed the domain docs

The map is _structure_; these are _language_ and _decisions_, and they build on it:

- If no `CONTEXT.md` exists, create one capturing the domain terms you discovered while mapping
  (glossary only — use the `grill-with-docs` format).
- If consequential decisions are baked into the code without explanation, propose ADRs for them.

### 6. Surface risks

`CONCERNS.md` is your risk register. Its entries are the first candidates for `/learn` and for
`improve-codebase-architecture`; route serious security findings through `security-review`.

**Keep `CONCERNS.md` out of a public repo — it is local-by-default.** A risk register enumerates
weaknesses, security gaps, and known bypasses; publishing it hands attackers a roadmap and airs
the project's soft spots (and it goes stale fast). Add `docs/codebase/CONCERNS.md` to `.gitignore`
and leave it uncommitted unless the repo is private and stays that way. The descriptive map docs
(`ARCHITECTURE`, `STRUCTURE`, `STACK`, `CONVENTIONS`, `INTEGRATIONS`, `TESTING`, `INDEX`) are safe
to commit; the risk register is not.

## Greenfield → set the floor

1. Confirm the stack and target with the user — don't assume a default. Use `/office-hours` if
   the product itself is still fuzzy.
2. Scaffold conventions: `coding-standards` baseline, `git-workflow` branch/commit rules,
   a starter `CONTEXT.md` glossary, and `docs/adr/` for the first real decisions.
3. Establish the test approach early (`test-driven-development`).

## Hand off

End with a short orientation summary: what this repo is, its shape, where to start, and the
open questions. Point at the map (`docs/codebase/`) as the durable reference, and offer to
capture durable findings with `/learn`.
