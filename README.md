# keystone

> The central piece my Claude Code setup depends on — one repo-agnostic kit that travels
> to every project.

keystone is a single installable Claude Code plugin that bundles **one winner per
capability** across four layers:

- **Build pipeline** — `/spec` → tickets → `/implement`, with an integrate-first rule and an
  over-engineering gut check; worktrees, verification, review.
- **Domain language** — a GLOSSARY.md glossary + ADRs, grilling, deep-module design vocabulary.
- **Explicit workflows** — challenge, qa, cso, investigate, ship, wrap.
- **Harness & judgment** — tiered model routing, security review, and the
  instinct/memory/security-hook harness.

What Claude Code now ships itself, keystone no longer duplicates: bare `/review`, `/simplify`,
`/code-review`, and `/security-review` are **Claude Code built-ins**. keystone's own reviewer
is the `code-reviewer` agent (Riley), which `/ship` dispatches as its review gate.

Design is intentionally **out of scope** — the `impeccable` suite stays a separate plugin.

## What's inside

```
plugins/keystone/
├── skills/      32 skills: 20 model-invocable (verification + agent/loop design + domain language + security +
│                challenge/audit + git + wrap/pickup) and 12 user-only (spec, to-tickets, implement, setup, ship,
│                qa, cso, investigate, debt, handoff, guard, onboard-codebase — no context cost until you run them)
├── agents/      the crew: Mason (implementer) · Riley (reviewer) · Sage (security)
└── hooks/       instincts.js · guard.js · scan.js · notify.js · learnings.js + hooks.json
templates/       INSTINCTS.md · MEMORY.md · GLOSSARY.md · adr/
```

### Slash commands

Every workflow is a skill (there is no `commands/` directory since 1.0). The user-only ones load
nothing into context until you type them; the model can't start them on its own.

| Group       | Skills                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Build       | `/spec` (idea → spec → tickets) · `/to-tickets` · `/implement` (tickets → integration branch) · `/setup` (tracker + domain docs, once per repo) · `/challenge` (fresh-eyes assumption red-team) |
| Review & QA | `/qa` · `/cso` · `/investigate` · `/debt` (deferred-shortcut ledger) · `/audit` (whole-repo over-engineering scan) · `/onboard-codebase` |
| Ship        | `/ship` (never auto-commits; dispatches the `code-reviewer` agent as its review gate)                                                           |
| Continuity  | `/handoff` (resume note, mid-task) · `/pickup` (resume) — the blessed `/handoff` → `/clear` → `/pickup` flow                                   |
| Wrap-up     | `/wrap` — end of a session: one question, a candidate list, you pick what to save (repo lessons, decisions, corrections, drops). The model may offer it at natural stopping points. |
| Safety      | `/guard` — see below                                                                                                                            |

`/guard` modes (one skill; it replaces the separate freeze, careful, and unfreeze commands from 0.x):

| Run | Effect |
| --- | --- |
| `/guard` or `/guard on [dir]` | fence Edit/Write to `dir` (default: current directory) **and** confirm destructive shell commands |
| `/guard freeze [dir]` | fence edits only |
| `/guard careful [on\|off]` | destructive-command confirmation only |
| `/guard off` | lift both (always asks first) |
| `/guard status` | show the current state |

### How to build a feature: `/spec`

`/spec <idea>` is the one entry point. It pauses for your OK between steps:

1. **Understand** — if the idea is fuzzy, a grilling interview (answers are written into the spec
   as they arrive, so a compaction loses nothing). On a project already underway it first reads
   the docs and history, then opens with contradicting decisions and never-decided areas.
2. **Write the spec** — including a section titled _"Integrate and be creative where possible;
   build where necessary"_: per capability, the package or service to integrate (legitimacy- and
   live-repo-checked), how existing pieces combine, or why it has to be built. Plus the security
   questions that apply.
3. **Over-engineering gut check** — six one-line answers; whatever fails gets cut. Bigger specs
   get offered `/challenge`.
4. **Tickets** — tracer-bullet slices with blocking edges, as local files under
   `.scratch/<feature>/issues/` by default (GitHub, GitLab, or Linear via `/setup`).
5. **`/implement`** — an integration branch, one implementer subagent per unblocked ticket in its
   own worktree, merge as each lands, one final `code-reviewer` pass. It never pushes or merges to
   main unasked. Without subagents it works the tickets one at a time; re-running it resumes from
   the frontier.

### Workflow defaults baked in

- **No auto-commits** — `/ship` prepares everything and stops for an explicit go-ahead.
- **Cost tiers** — reviewer and challenge seats scale cheap → mid → high tiers, with the top
  tier reserved for adjudication seats. No model names are hardcoded anywhere in keystone — the ladder and
  how to resolve current IDs/prices at build time live in `designing-agent-systems`.
- **Agent & loop design (first-class)** — `designing-agent-systems` (the design rubric +
  note before any agent code), and `long-running-agents` (iteration contract, stuck
  detection, budget enforcement on top of the harness's `/goal` / `/loop` / `/schedule`) —
  harness-neutral and model-agnostic.
- **Chrome MCP** — `/qa` drives the Claude in Chrome MCP tools, no browse daemon.
- **Security (first-class)** — three skills: `security-review` (OWASP 2025, source→sink
  methodology), `api-security` (full OWASP API Top 10:2023 — REST/GraphQL/webhooks), and
  `llm-security` (OWASP LLM Top 10:2025); the `security-reviewer` agent (traces +
  adversarially verifies, confirmed / needs validation), the `/cso` audit, and the always-on
  `scan.js` injection tripwire + `guard.js` secret/dangerous-sink blocks. The `code-reviewer`
  agent is **diff-aware** — git-history regression detection, blast-radius caller counts, and
  risk-scaled depth.
- **Instincts** — `INSTINCTS.md` rules fire at SessionStart via `guard.js`'s sibling
  `instincts.js`; `guard.js` enforces secret-file/dangerous-command blocks plus the
  opt-in freeze/careful boundary.
- **Deliberate continuity** — the blessed flow is **`/handoff` → `/clear` → `/pickup`**
  (deliberate, _not_ compaction-driven). `/handoff` writes a four-field resume note to
  `docs/handoffs/<date>.md` and appends a row to `docs/handoffs/README.md`, the repo continuity
  index; `/pickup` reads that index _first_ (recency + liveness aware) to resume the newest
  **open** handoff, and lists open tickets with their frontier. It is all plain files, so it works on Claude Code and Codex CLI alike —
  the SessionStart hook only adds a Claude-Code-only nudge after `/clear` (graceful degradation
  elsewhere). `docs/handoffs/README.md` is _this repo's_ task-state; `MEMORY.md` is your
  personal cross-project index.
- **Per-repo memory** — _surfacing_ is automatic (SessionStart `learnings.js` prints a 📓
  banner of this repo's banked lessons, or a one-line nudge to `/wrap` when none are banked
  yet); _capture_ goes through `/wrap`, and you pick what is saved. Stored
  outside the repo (`~/.claude/keystone/learnings/<slug>.md`), so client repos stay clean.
- **Durable codebase map** — `onboard-codebase` (brownfield) writes a committed
  `docs/codebase/` map (stack, architecture, structure, conventions, integrations, testing,
  concerns) via parallel mappers (optionally backed by a code-graph index), so a repo's shape
  is captured once instead of re-derived every session.
- **Named rigor techniques** — verification has a test-quality audit + wired/stub ladder (a
  green suite that proves nothing won't pass); `/investigate` forces a falsifiable prediction
  before each check and escalates to an architecture question after three failed fixes; `/spec`
  runs a package-legitimacy check and an over-engineering gut check; `challenge` applies a
  pre-mortem, an assumption ledger, and a survivability score.
- **A named crew** — `/implement` dispatches **Mason** (the `implementer` agent; the only one who
  edits code, failing test first) per ticket, then **Riley** (`code-reviewer`) reviews the whole
  integration branch once, with **Sage** (`security-reviewer`) added for sensitive surfaces.
  Reviewers report, never edit.

## Install

```bash
# from GitHub
/plugin marketplace add j-loyd/keystone
/plugin install keystone
```

### ⚠️ Avoid double-loading

keystone carries its own skills and harness hooks. After installing, to avoid duplicate
skills and double-firing hooks:

1. **Uninstall any standalone plugin whose skills keystone now carries** — in particular
   `mattpocock-skills` and `superpowers` — so the same skill isn't loaded twice.
2. **Remove the hook entries from `~/.claude/settings.json`** that point at
   `~/.claude/hooks/{instincts,guard,scan,notify}.js` — keystone's `hooks.json` now
   provides them via `${CLAUDE_PLUGIN_ROOT}`. Leaving both wired makes the hooks fire twice.
3. keystone deliberately excludes design/UI — if you want that layer, pair it with a
   design-focused plugin (e.g. `impeccable`).

`INSTINCTS.md` still lives at `~/.claude/INSTINCTS.md` (per-machine); the copy in
`templates/` is just a seed for new machines.

## Companion plugins

### Cloudflare security-audit (optional, in keystone's marketplace)

keystone's marketplace lists Cloudflare's [`security-audit`](https://github.com/cloudflare/security-audit-skill)
skill (MIT) as a second, separate entry, pinned to a fixed commit. It is never installed or
enabled with keystone:

```bash
/plugin install security-audit@keystone
```

It brings a source-first **full-audit mode**: a coverage ledger, independent verification of
every finding, and schema-validated `findings.json` / `REPORT.md` artifacts. `/cso` offers to hand
off to it when it's installed, and adds what it leaves out: STRIDE, OWASP labels, rotate-first
secret handling, and the scanner sweep. keystone's rules override its supply-chain doctrine,
so third-party skills, plugins, and MCP servers stay in scope as a trust boundary. While a
`/guard` freeze is on, its default output directory (`~/security-audit-skill/`) is fenced off,
so lift the freeze for the run or pick a git-ignored directory inside the repo.

### Trail of Bits

keystone owns the **judgment layer** — stack-tuned + LLM security knowledge
(`security-review`, `api-security`, `llm-security`, `variant-analysis`) and the integration
glue (`/cso`, `security-reviewer`, `scan.js`). It deliberately does **not** ship thin
wrappers around external scanners. For the **tool-heavy / deep-research layer**, install
Trail of Bits' maintained skills (CC-BY-SA-4.0 — installed alongside, not vendored, so
keystone stays MIT):

```bash
/plugin marketplace add trailofbits/skills
/plugin install static-analysis              # run Semgrep/scanners + triage
/plugin install semgrep-rule-creator         # author custom Semgrep rules
/plugin install supply-chain-risk-auditor    # dependency / provenance audit
/plugin install differential-review          # deep diff-aware security review + adversarial-modeler
/plugin install agentic-actions-auditor      # external lens on agent action safety
```

How they fit together:

- `/cso` and `security-review` call into ToB's `static-analysis` + `supply-chain-risk-auditor`
  for the automated sweep; keystone does the stack-specific manual depth.
- `variant-analysis` (keystone) → hand off to ToB's `semgrep-rule-creator` to make a finding permanent.
- ToB's `differential-review` is the deep security diff pass; keystone's `code-reviewer` agent
  already carries the same _methodology_ for everyday reviews.
- ToB's `agentic-actions-auditor` complements keystone's `llm-security` agent-action audit.

Why the split: security rewards currency, and Trail of Bits maintains these against new
CVEs/techniques — better than keystone maintaining thin copies. keystone keeps what's
uniquely yours (your stack + LLM patterns + integration). The other ~30 ToB skills are
off-domain (smart contracts, C/C++, firmware, crypto) — skip them.

## Updating

Edit skills in place and bump `VERSION` + `CHANGELOG.md`. The skills here are
intentionally curated — change them directly rather than re-syncing from anywhere.

**The glossary is now `GLOSSARY.md`** (formerly `CONTEXT.md`). In a repo that still has
`CONTEXT.md`, keystone treats it as the glossary and offers the rename:
`git mv CONTEXT.md GLOSSARY.md` (and `CONTEXT-MAP.md` → `GLOSSARY-MAP.md`).

**Restart open sessions after a plugin update.** Harnesses resolve the plugin root at session
start; an update that swaps the installed version directory leaves already-open sessions
pointing at a deleted path. The bundled hooks degrade to a visible one-line notice (instead of
failing) when that happens — the fix is always to start a fresh session. On harnesses with
per-hook trust (e.g. Codex), a release that changes hook _commands_ also requires re-approving
the hooks before they run again.

## Credits

keystone stands on the shoulders of several MIT-licensed open-source projects — most notably
**[superpowers](https://github.com/obra/superpowers)** (Jesse Vincent), **[Matt Pocock's
skills](https://github.com/mattpocock/skills)**, **[gstack](https://github.com/garrytan/gstack)**
(Garry Tan), **[ECC](https://github.com/affaan-m/ECC)** (Affaan Mustafa), and
**[agent-skills](https://github.com/addyosmani/agent-skills)** (Addy Osmani) — plus methodology
inspiration from Trail of Bits and others. Per-component provenance and the upstream license
notices are in [`ATTRIBUTION.md`](ATTRIBUTION.md).

## License

MIT (see [`LICENSE`](LICENSE)). Portions are copied or adapted from other MIT-licensed
projects, which retain their original copyright — see [`ATTRIBUTION.md`](ATTRIBUTION.md).
