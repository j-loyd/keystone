# Codebase Map Format

The durable map `onboard-codebase` writes to `docs/codebase/` in the target repo. Seven docs,
each one focused file. The map records **facts about the code as it is** — not opinions, not a
plan, not domain vocabulary (that's `CONTEXT.md`) and not decisions (those are ADRs).

## Rules for every doc

- **Cite real paths.** Every claim points at actual code with a backticked path —
  `` `src/server/auth.ts` ``, `` `migrations/` ``. A map with no file paths is a guess.
- **Observed, not aspirational.** Write what the code does, including the ugly parts. If two
  patterns coexist, say so. `CONVENTIONS.md` describes what the repo _does_, never what it
  _should_ do.
- **Tight.** A reader should skim a doc in under a minute. Prefer bullets and short tables over
  prose. If a doc would run long, link out to the deepest 2–3 files instead of transcribing them.
- **No secrets.** Never copy a key, token, connection string, or `.env` value into a doc. Name
  the variable, not its value. (The skill runs a secret scan before finishing — see SKILL.md.)
- **Stable headings.** Use the headings below so the docs are diff-friendly across refreshes.

## The seven docs

### `STACK.md`

What the project is built from.

- Languages + versions; runtime/platform (Node, Bun, Python, Workers, …).
- Frameworks and the handful of dependencies that actually shape the code (not the full
  lockfile). Where each is configured.
- Build/test/run tooling; package manager; key config files (`tsconfig`, `next.config`,
  `pyproject.toml`, `wrangler.toml`, …).
- Required environment variables (names + purpose; never values).

### `ARCHITECTURE.md`

How the system is shaped and how data moves.

- The dominant pattern(s) (layered, hexagonal, MVC, event-driven, monolith/service split).
- Layers/boundaries and what each owns; the core abstractions a newcomer must understand.
- Primary data flow for the main use case (request → … → response), named by file.
- **Entry points:** the files where execution starts (`main`, server bootstrap, route
  registration, CLI entry, worker handler).

### `STRUCTURE.md`

Where things live.

- Top-level directory layout with a one-line purpose each (a small tree or table).
- Where to find the common things: routes/handlers, business logic, data access, shared
  utilities, config, scripts.
- How files are organized (by feature vs by layer) and where new code of a given kind goes.

### `CONVENTIONS.md`

The repo's **observed** style — descriptive, not prescriptive.

- Naming in practice (files, types, functions, components, branches).
- Error handling pattern actually used (throw vs result types; how errors surface to callers).
- Idioms the codebase reaches for (validation lib, state management, logging, async patterns).
- Formatting/lint tooling in place.
- Note inconsistencies honestly ("most handlers use X; `legacy/` still uses Y").
- This is distinct from keystone's `coding-standards` skill, which is the cross-project
  baseline of what _should_ be true.

### `INTEGRATIONS.md`

Everything the system talks to across a boundary.

- External APIs / third-party SDKs and where they're called.
- Datastores (DB engine, ORM/query layer, where the schema/migrations live).
- Auth provider(s) and where sessions/tokens are issued and checked.
- Webhooks (inbound + outbound), queues, caches, object storage, email/SMS, payments.
- For each: the file that owns the integration and which env vars gate it (names only).

### `TESTING.md`

How the project is tested and how to run it.

- Framework(s) and runner; where tests live and the naming convention.
- Mocking/fixtures/factories approach; how external boundaries are stubbed.
- The exact commands to run the suite, a single test, and (if present) coverage.
- Honest coverage picture: what's well-covered vs what has little/none.

### `CONCERNS.md`

The risk register — the most valuable doc for a newcomer or a reviewer.

- Tech debt and fragile areas (the files people are afraid to touch, and why).
- Security gaps spotted during mapping (route the serious ones through the `security-review`
  skill; record them here regardless).
- Performance risks (N+1s, unbounded loops/queries, hot paths without caching).
- Surprising or undocumented behavior; footguns.
- Mark each with a rough severity so it can be triaged. These are the first candidates for
  `/learn` entries and `improve-codebase-architecture`.
- **Verify before you flag.** Reproduce a concern (run the regex, run the command, read the
  test) before listing it — and never assign a high severity to something you haven't
  reproduced. If you can't verify, say "unverified — needs checking" rather than asserting it.
  An over-stated risk register is worse than a short honest one.

### `INDEX.md`

The map's table of contents + provenance, so staleness is detectable.

```markdown
# Codebase Map

Built at: `<short-sha>` on YYYY-MM-DD · branch `<branch>`

- [STACK](STACK.md) — languages, runtime, frameworks, config
- [ARCHITECTURE](ARCHITECTURE.md) — patterns, layers, data flow, entry points
- [STRUCTURE](STRUCTURE.md) — directory layout, where things live
- [CONVENTIONS](CONVENTIONS.md) — observed naming, error handling, idioms
- [INTEGRATIONS](INTEGRATIONS.md) — external APIs, datastores, auth, webhooks
- [TESTING](TESTING.md) — framework, layout, how to run
- [CONCERNS](CONCERNS.md) — tech debt, security/perf risks, surprises

> Regenerate with the `onboard-codebase` skill. If `HEAD` has moved far past the build SHA,
> treat this map as stale and refresh.
```

Record the SHA with `git rev-parse --short HEAD` and the branch with
`git rev-parse --abbrev-ref HEAD` at build time. Use the real current date — don't guess.
