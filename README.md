# keystone

> The central piece my Claude Code setup depends on — one repo-agnostic kit that travels
> to every project.

keystone is a single installable Claude Code plugin that bundles **one winner per
capability** across four layers:

- **Process discipline** — TDD, debugging, plans, worktrees, review.
- **Domain language** — a CONTEXT.md glossary + ADRs, grill, zoom-out.
- **Explicit workflows** — office-hours, ceo/eng review, qa, cso, ship, retro.
- **Harness & judgment** — cost-aware LLM routing, security review, coding standards, and
  the instinct/memory/security-hook harness.

Design is intentionally **out of scope** — the `impeccable` suite stays a separate plugin.

## What's inside

```
plugins/keystone/
├── skills/      25 auto-invoked skills (process discipline + domain language + security + onboarding/git)
├── commands/    25 explicit /commands (spec, planning, review, qa, simplify, security, ship, safety, learn, handoff, research)
├── agents/      the crew: Pat (planner) · Mason (implementer) · Quinn (QA) · Riley (reviewer) · Sage (security)
└── hooks/       instincts.js · guard.js · scan.js · notify.js · learnings.js + hooks.json
templates/       INSTINCTS.md · MEMORY.md · CONTEXT.md · adr/ · plans/ (README + plan.md)
```

### Commands

| Group       | Commands                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan        | `/spec` (spec→plan→subagent execute) · `/office-hours` · `/plan-ceo-review` · `/plan-eng-review`                                                            |
| Review & QA | `/review` · `/qa` · `/cso` · `/investigate` · `/simplify` (clarity pass) · `/audit` (whole-repo over-engineering scan) · `/debt` (deferred-shortcut ledger) |
| Ship        | `/ship` (never auto-commits) · `/retro`                                                                                                                     |
| Continuity  | `/handoff` (resume note) · `/pickup` (resume) · `/pause` (flush run-state) — the blessed `/handoff` → `/clear` → `/pickup` flow                             |
| Backlog     | `/to-issues` (Linear Backlog) · `/to-prd`                                                                                                                   |
| Memory      | `/learn` (per-repo lessons) · `/research-notes` (persist external research)                                                                                 |
| Safety      | `/freeze` · `/careful` · `/guard` · `/unfreeze`                                                                                                             |

### Workflow defaults baked in

- **No auto-commits** — `/ship` prepares everything and stops for an explicit go-ahead.
- **Linear Backlog** — `/to-issues` never creates in Triage.
- **Cost tiers** — `/review`, `/qa`, `/cso` scale Haiku → Sonnet → Opus.
- **Chrome MCP** — `/qa` drives `chrome-devtools` / `claude-in-chrome`, no browse daemon.
- **Security (first-class)** — three skills: `security-review` (OWASP 2025, source→sink
  methodology), `api-security` (full OWASP API Top 10:2023 — REST/GraphQL/webhooks), and
  `llm-security` (OWASP LLM Top 10:2025); the `security-reviewer` agent (traces +
  adversarially verifies, confirmed-vs-suspected), the `/cso` audit, and the always-on
  `scan.js` injection tripwire + `guard.js` secret/dangerous-sink blocks. `/review` and the
  reviewer agent are **diff-aware** — git-history regression detection, blast-radius, and
  adaptive scope.
- **Instincts** — `INSTINCTS.md` rules fire at SessionStart via `guard.js`'s sibling
  `instincts.js`; `guard.js` enforces secret-file/dangerous-command blocks plus the
  opt-in freeze/careful boundary.
- **Deliberate continuity** — the blessed flow is **`/handoff` → `/clear` → `/pickup`**
  (deliberate, _not_ compaction-driven). `/handoff` writes a four-field resume note to
  `docs/handoffs/<date>.md` and appends a row to `docs/handoffs/README.md`, the repo continuity
  index; `/pickup` reads that index _first_ (recency + liveness aware) to resume the newest
  **open** handoff or a still-live `subagent-driven-development` run-state; `/pause` flushes a
  run-state checkpoint. It is all plain files, so it works on Claude Code and Codex CLI alike —
  the SessionStart hook only adds a Claude-Code-only nudge after `/clear` (graceful degradation
  elsewhere). `docs/handoffs/README.md` is _this repo's_ task-state; `MEMORY.md` is your
  personal cross-project index.
- **Per-repo memory** — _surfacing_ is automatic (SessionStart `learnings.js` prints a 📓
  banner of this repo's banked lessons, or a one-line nudge to `/learn` when none are banked
  yet); _capture_ is manual (`/learn` for a single lesson, `/retro` to sweep a session). Stored
  outside the repo (`~/.claude/keystone/learnings/<slug>.md`), so client repos stay clean.
- **Durable codebase map** — `onboard-codebase` (brownfield) writes a committed
  `docs/codebase/` map (stack, architecture, structure, conventions, integrations, testing,
  concerns) via parallel mappers (optionally backed by a code-graph index), so a repo's shape
  is captured once instead of re-derived every session.
- **Named rigor techniques** — planning has SPIDR task-splitting; verification has a
  test-quality audit + wired/stub ladder (a green suite that proves nothing won't pass);
  debugging forces a falsifiable prediction before each test; discovery draws on a
  domain-probe cheatsheet; `plan-eng-review` applies pre-mortem / reversibility / base-rate
  lenses.
- **A named crew** — `subagent-driven-development` dispatches a virtual team and carries the
  baton between them: **Pat** plans → **Mason** implements (TDD; the only one who edits code)
  → **Quinn** runs a QA gate (risk/coverage/trace/NFR → **PASS/CONCERNS/FAIL/WAIVED**, advisory)
  → **Riley** reviews → **Sage** audits security. Each gets a self-contained handoff packet;
  the orchestrator owns the ship decision. Reviewers report, never edit.

## Install

```bash
# from GitHub
/plugin marketplace add j-loyd/keystone
/plugin install keystone
```

### ⚠️ Avoid double-loading

keystone carries its own skills and harness hooks. After installing, to avoid duplicate
skills and double-firing hooks:

1. **Uninstall any standalone plugin whose skills keystone now carries**, so the same
   skill isn't loaded twice.
2. **Remove the hook entries from `~/.claude/settings.json`** that point at
   `~/.claude/hooks/{instincts,guard,scan,notify}.js` — keystone's `hooks.json` now
   provides them via `${CLAUDE_PLUGIN_ROOT}`. Leaving both wired makes the hooks fire twice.
3. keystone deliberately excludes design/UI — if you want that layer, pair it with a
   design-focused plugin (e.g. `impeccable`).

`INSTINCTS.md` still lives at `~/.claude/INSTINCTS.md` (per-machine); the copy in
`templates/` is just a seed for new machines.

## Companion plugins (Trail of Bits)

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
- ToB's `differential-review` is the deep security diff pass; keystone's `/review` already
  carries the same _methodology_ for everyday reviews.
- ToB's `agentic-actions-auditor` complements keystone's `llm-security` agent-action audit.

Why the split: security rewards currency, and Trail of Bits maintains these against new
CVEs/techniques — better than keystone maintaining thin copies. keystone keeps what's
uniquely yours (your stack + LLM patterns + integration). The other ~30 ToB skills are
off-domain (smart contracts, C/C++, firmware, crypto) — skip them.

## Updating

Edit skills/commands in place and bump `VERSION` + `CHANGELOG.md`. The skills here are
intentionally curated — change them directly rather than re-syncing from anywhere.

## Credits

keystone stands on the shoulders of several MIT-licensed open-source projects — most notably
**[superpowers](https://github.com/obra/superpowers)** (Jesse Vincent), **[Matt Pocock's
skills](https://github.com/mattpocock/skills)**, **[gstack](https://github.com/garrytan/gstack)**
(Garry Tan), and **[ECC](https://github.com/affaan-m/ECC)** (Affaan Mustafa) — plus methodology
inspiration from Trail of Bits and others. Per-component provenance and the upstream license
notices are in [`ATTRIBUTION.md`](ATTRIBUTION.md).

## License

MIT (see [`LICENSE`](LICENSE)). Portions are copied or adapted from other MIT-licensed
projects, which retain their original copyright — see [`ATTRIBUTION.md`](ATTRIBUTION.md).
