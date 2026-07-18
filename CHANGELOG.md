# Changelog

All notable changes to keystone are recorded here.

## [0.3.0] — 2026-07-17

### Added

- **`designing-agent-systems` skill** — the front door for anything agent-shaped: two prior
  questions (agent at all? one or many?), topology vocabulary (orchestrator-worker,
  adversarial verify, tournament, peer team), the five harness layers, named model failure
  modes (victory declaration, one-shot overreach, self-preferential bias, goal drift), a
  scaffolding-sunset rule (every workaround gets a ceiling + upgrade trigger), and a design-note
  template. Over-engineering check runs first and throughout — a seat/gate that doesn't earn
  its cost doesn't ship.
- **`long-running-agents` skill (loop engineering)** — loop modes (fixed-interval, self-paced,
  scheduled-wake, queue-consumer), the iteration contract (orient from state → one task →
  verify end-to-end → write state), memory-outside-the-window (progress file + failure log +
  initializer session), three independent loop exits (verifiable done, stuck/gutter detection,
  budget enforcement), and when NOT to loop.
- **Boy Scout rule** in `coding-standards` — leave touched code better than found, bounded by a
  three-part test (already-touched lines, seconds of work, zero blast radius) so it never
  becomes scope creep; `executing-plans` deviation triage carves it out explicitly, and
  reviewers are told not to flag genuine boy-scout cleanups as noise.
- **Multi-agent trust boundaries** in `llm-security` — tool poisoning as a first-class supply-
  chain threat (poisoned tool metadata), permission laundering (relayed approval is never
  consent), orchestrator accountability diffusion (independent safety checkpoints per agent),
  and compliance-as-vulnerability for workers consuming untrusted upstream output.
- **Learning Loop — Phase 1: the loop closes** (internal spec; survived a `/challenge`
  adversarial pass; claims re-verified against live `learnings.js` before shipping). SDD task completion is now the loop's automatic capture point — **fatigue-gated**:
  a one-tap `/learn` draft is offered only when a gate actually caught something, never on a
  clean pass. SDD handoff packets (and the implementer template) gain a **matching repo
  lessons** slot, closing the structural gap where session-start-surfaced lessons never reached
  dispatched crew members. `/investigate` banks confirmed root causes; `/handoff` offers capture
  for gotchas that outlive the note. `/learn` entries gain a `**Triggers:**` line from a small
  controlled vocabulary — born-tagged inside the current format, so the Phase 2 typed-schema
  migration is mechanical. Human-gated end to end; no silent writes.
- **Lean-process rubric row** in `/plan-eng-review` — every gate/artifact a plan adds must earn
  its pain; ceremony scores against the plan — with a matching self-review check in
  `writing-plans` (cut any gate that can't say what breaks without it) and boy-scout
  carve-outs in the spec-reviewer prompt and `code-reviewer` agent so zero-blast-radius
  cleanups are recognized as maintenance, not bounced as scope creep.

### Changed

- **No hardcoded model names anywhere.** `cost-aware-llm-pipeline` now carries zero model IDs
  and zero dollar figures — tier language only (cheap/mid/high/top) plus instructions to
  snapshot live pricing into project config (ratios over dollars, as-of dates, sunset dates).
  `/review`, `/plan-eng-review`, `planner`, `/context-budget`, and
  `subagent-driven-development` de-hardcoded to tier language to match. Skills stay current
  by construction instead of by maintenance.
- **`cost-aware-llm-pipeline` gains the agentic-loop cost layer** — cost per completed task as
  the headline metric (a pricier model can be cheaper per task; measure, don't assume), cache
  hit rate as the dominant loop lever (byte-stable prefixes, the cache-read diagnostic),
  super-linear subagent fan-out (~4x for a two-way split), budgets as loop control (ceiling +
  velocity circuit breaker), and platform-native context reduction (context editing,
  compaction, deferred tools, programmatic tool calling, structured outputs) over hand-rolled
  truncation.
- **`dispatching-parallel-agents` modernized** — read-heavy-fans-out / write-heavy-isolates
  asymmetry, compressed schema-constrained returns, the orchestration pattern vocabulary
  (classify-and-act, fan-out-and-synthesize, adversarial verification, tournament,
  loop-until-dry, completeness critic), judge-reliability cautions (diverse lenses over
  identical refuters, binary rubrics, votes are signal not proof), returns treated as claims
  not facts, peer/team primitives as a deliberate last rung; dated session-log tail removed.
- **`subagent-driven-development`** — fresh-context-per-task grounded in its three independent
  justifications; re-reviews framed adversarially (never "is it fixed now?"), with a
  different tier/family reviewer on HIGH-risk tasks; the DONE evidence gate names the victory-
  declaration failure mode it defends against.
- **`adversarial-review`** — different model *family* decorrelates more than a different tier
  (correlated seats re-vote shared biases; votes are signal, not proof); tournament escalation
  for one-way-door choices.
- **`/context-budget`** — deferred tool loading changes the math (check before assuming eager
  schemas); "defer, then disconnect" is the new first recommendation; names the shared
  invariant: advertise cheap, load on demand.

## [0.2.1] — 2026-07-01

### Fixed

- **Hooks survive a mid-session plugin update instead of exit-1 spam.** Harnesses resolve the
  plugin root at session start; updating the plugin swaps the installed version directory out from
  under already-open sessions, so every `node <plugin-root>/hooks/*.js` hook died with
  MODULE_NOT_FOUND (exit 1) until restart. The bundled node hooks now resolve the root via
  `${CLAUDE_PLUGIN_ROOT}` with a `${PLUGIN_ROOT}` fallback (the native var on Codex-style
  harnesses) and, when the script is genuinely gone, degrade to exit 0 — guard/scan/instincts/
  learnings emit a one-line `systemMessage` telling you to restart; notify skips silently.
- **Formatter hook no longer reaches the npm registry.** The Write/Edit formatter ran
  `npx prettier --write`, which fetches and executes an unpinned prettier from the registry when
  none is installed locally (blocking up to the 30s timeout offline, and a small supply-chain
  hole). It now formats only with a repo-local `node_modules/.bin/prettier` or one already on
  PATH, and skips otherwise; `ruff` is gated the same way with `command -v`.

### Changed

- **Fable-era model refresh.** The cost-tier ladder gains a fourth rung: Haiku → Sonnet → Opus →
  **Fable** (top tier, ~2x Opus per token), reserved for **adjudication and adversarial seats**,
  never as a routing default. `cost-aware-llm-pipeline` adds `MODEL_FABLE`, the verified 2026-07
  pricing row ($10/$50 per MTok), the effort-level enum (`low..max`, `xhigh` as the agentic sweet
  spot on Fable/Opus 4.7+), and a newer-tokenizer cost caveat. `/review`, `planner`,
  `/plan-eng-review`, and the README name the fourth tier; `adversarial-review`, `/challenge`, and
  the plan-convergence loop make "heavier model tier" concrete (per-dispatch model override, one
  tier above the session model, where the harness supports it).
- **Per-dispatch declarations.** `subagent-driven-development` Model Selection now says to declare
  the Risk-table tier/effort on the dispatch call where the harness supports overrides — and
  records the deliberate choice NOT to pin models in agent definitions (tier is per-task, not
  per-agent). `using-git-worktrees` + `parallel-waves` name dispatch-time worktree isolation as
  the preferred instance for parallel task isolation.
- **Refusal-aware security dispatch.** `security-review` + `/cso`: security-work packets carry
  explicit authorization context; a safety-classifier decline is re-framed or re-run a tier down
  and reported as NOT RUN — never silently counted as "no findings."
- **Cross-harness gating closed out.** The two remaining un-gated dispatch sites
  (`improve-codebase-architecture` hard-coding the Agent tool, `/cso` naming the Task tool bare)
  now carry the standard "or the equivalent elsewhere" degradation. `/context-budget` percentages
  are window-aware (200k vs 1M-context sessions) instead of hardcoding 200k. README no longer
  claims `/qa`/`/cso` scale cost tiers (only `/review` does).

### Docs

- README "Updating": restart open sessions after a plugin update; harnesses with per-hook trust
  (e.g. Codex) also require re-approving hooks when a release changes hook commands.

## [0.2.0] — 2026-07-01

### Added

- **`/challenge` + the `adversarial-review` skill** — an independent, fresh-context adversarial pass
  over any finished doc (spec / plan / PRD / ADR). A reviewer with zero authorship memory builds a
  typed **Assumption Ledger** (implicit assumptions included, ranked by blast radius), red-teams it
  against the real codebase (composing `grill-with-docs`), and challenges the **approach** itself —
  simplest? already-built? most-scalable? better alternative? — before ending with a
  **survivability score** and folding accepted findings back into the doc (disagreements kept as
  explicit tensions). Thin command → rich skill, mirroring `/investigate` → `systematic-debugging`.

### Changed

- **One owner for the independent adversarial pass.** `/plan-eng-review`, `/plan-ceo-review`, and
  `writing-plans` no longer hand-roll their own high-stakes second-pass dispatch — they escalate
  into `adversarial-review` (`/challenge`) carrying their own lens's question, with self-critique as
  the always-available fallback.
- **Template seed** — `templates/INSTINCTS.md` gains an example instinct that dispatches bounded,
  well-specified, no-mid-task-input work to a fresh subagent (gated so interactive work stays inline).

### Next

- **The Learning Loop** (spec: [`docs/plans/2026-06-30-learning-loop.md`](docs/plans/2026-06-30-learning-loop.md))
  — adversarially reviewed 2026-07-01 and re-sequenced (capture-first). Targeted for v0.3.

## [0.1.0] — 2026-06-30 — Initial public release

The first public release of keystone — a repo-agnostic Claude Code kit that travels to every
project. It consolidates process-discipline skills, a domain-language layer, security review
(web / API / LLM-agent), heavy explicit workflows, and harness hooks. MIT-licensed; provenance
for adapted upstream work is recorded in [`ATTRIBUTION.md`](ATTRIBUTION.md).

### What's included

- **Skills (auto-invoked)** — TDD, systematic debugging, writing/executing plans, git worktrees,
  requesting/receiving code review, brainstorming, domain modeling (grill-with-docs, zoom-out,
  improve-codebase-architecture), `security-review` / `api-security` / `llm-security`,
  cost-aware-llm-pipeline, coding-standards, onboard-codebase, git-workflow, simplifying-code,
  auditing-for-overengineering, subagent-driven-development, dispatching-parallel-agents,
  verification-before-completion, finishing-a-development-branch, variant-analysis.
- **Commands** — `/spec`; planning (`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`);
  review & QA (`/review`, `/qa`, `/cso`, `/investigate`, `/simplify`, `/audit`, `/debt`);
  continuity (`/handoff` → `/clear` → `/pickup`, `/pause`); ship (`/ship`, `/retro`);
  backlog (`/to-issues`, `/to-prd`); memory (`/learn`, `/research-notes`);
  safety (`/freeze`, `/careful`, `/guard`, `/unfreeze`).
- **Crew agents** — planner, implementer, QA, code-reviewer, security-reviewer.
- **Harness hooks** — `instincts` (SessionStart rules), `guard` (secret-file / dangerous-command /
  exfil blocks, an always-on SQL guard, opt-in freeze/careful, opt-in Databricks), `scan`
  (prompt-injection tripwire), `notify`, `learnings` (per-repo lessons surfaced at SessionStart).
- **Templates** — INSTINCTS / MEMORY / CONTEXT seeds, ADRs, plans, handoffs, research notes.

### Design

- **Cross-harness** — works on Claude Code and Codex CLI; hooks are Claude-Code enforcement teeth
  with graceful degradation, over a file-based baseline.
- **Security-first** — anchored to OWASP Top 10 (2025), API Security Top 10 (2023), and the
  LLM Top 10 (2025).
- **Workflow defaults** — `/ship` never auto-commits; `/to-issues` files to Linear Backlog;
  `/review` / `/qa` / `/cso` scale Haiku → Sonnet → Opus.
- **Companion tools (not bundled)** — Trail of Bits security skills (CC-BY-SA); pair with a
  design plugin (e.g. impeccable) for UI work.

### Next

- **The Learning Loop** (spec: [`docs/plans/2026-06-30-learning-loop.md`](docs/plans/2026-06-30-learning-loop.md))
  — a compounding spec→plan→execute→learn cycle with relevance-based lesson retrieval. Targeted for v0.2.
