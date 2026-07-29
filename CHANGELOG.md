# Changelog

All notable changes to keystone are recorded here.

## [0.4.0] — 2026-07-28

### Added

- **`resolving-merge-conflicts`** — the kit had zero coverage for the most destructive routine
  git operation. Resolve by **intent traced to each side's primary source**, not by picking the
  tidier hunk; a table for what `--ours`/`--theirs` mean per operation (rebase inverts the
  intuition, and getting it backwards resolves every hunk exactly wrong); the semantic conflicts
  git *cannot* flag (renames, signature changes, duplicate migration versions) and the
  grep-the-tree sweep that catches them; finishing the operation rather than leaving a broken
  tree; and when `--abort` is genuinely right versus an escape from tedium.
- **`writing-skills`** — this kit's own authoring skill, so the conventions live somewhere an
  agent reads rather than only in this changelog. Covers the two distinct failure modes (never
  fires = description; fires and hurts = calibration), the description shape, freedom calibrated
  to fragility, progressive-disclosure structure, the **conflict sweep** that catches two good
  instructions contradicting each other across files never read together, fence-aware structural
  checks, the house rules (harness-neutral, no hardcoded models or prices, no auto-commit, record
  provenance), and gap-first verification. `/retro` now routes accepted skill pitches here rather
  than to the external `skill-creator`, which cannot know these conventions.
- **A prototype branch in `brainstorming`** — `test-driven-development` exempted "throwaway
  prototypes" and `writing-plans` said "spike it", but nothing defined either. Now: when a
  question is about behavior rather than preference, build the throwaway (runnable script for
  state/logic, radically different variations for interaction), timeboxed and explicitly
  disposable — prototype code that quietly becomes production code is the expensive outcome.

### Changed

- **Retrieval pass over every skill `description:`.** Descriptions now quote the literal phrases
  a user actually types rather than describing a precondition Claude has to infer it is in
  ("Use when implementing any feature" → `"write a test"`, `"TDD this"`, `"add coverage"`).
  Sixteen skills rewritten. Six that compete with a built-in or another plugin
  (`security-review`, `simplifying-code`, `auditing-for-overengineering`,
  `designing-agent-systems`, `onboard-codebase`, `dispatching-parallel-agents`) now state their
  scope boundary explicitly, so the overlap resolves instead of splitting the vote.
- **De-escalated the three "Iron Law" skills** (`test-driven-development`,
  `systematic-debugging`, `verification-before-completion`) from anti-loophole prose to
  judgment-first guidance. The rules are unchanged and still stated firmly; what's gone is the
  scaffolding built to stop an older model generation from lawyering its way out — "violating
  the letter is violating the spirit", the rationalization-rebuttal tables, `MANDATORY`,
  "that's rationalization", and a fabricated-metrics section. 993 → 748 lines, substance intact.
- **Progressive disclosure applied to the five largest skills.** `cost-aware-llm-pipeline`,
  `receiving-code-review`, `finishing-a-development-branch`, `dispatching-parallel-agents`, and
  `subagent-driven-development` each pushed depth into sibling files behind a "Going deeper"
  index. Every `SKILL.md` is now back inside the repo's own ~500-line budget.
- **`writing-plans` — reference in the highest-fidelity form available.** New section: attach the
  mockup, schema, fixture, failing test, or `path:line` exemplar rather than prose describing it.
- **Conformance pass against the official Agent Skills authoring checklist.** Tables of contents
  added to the ten multi-section reference files over 100 lines (skipped on single-template files,
  where a TOC is noise and risks being copied into a dispatched prompt). `improve-codebase-architecture`
  gained a Reference files index and its sibling-to-sibling links were demoted to plain mentions,
  so every reference is now one level from its `SKILL.md` — previously `INTERFACE-DESIGN.md` and
  `HTML-REPORT.md` pointed at `LANGUAGE.md`/`DEEPENING.md`, the nesting that makes Claude preview
  files with `head` instead of reading them.
- **Trigger synonyms pruned to one per branch.** The retrieval rewrite above traded tokens for
  recall; this trims the phrasings that routed to the *same* branch while keeping those that route
  to different ones (e.g. `finishing-a-development-branch` keeps merge / PR / cleanup as three real
  endings; `receiving-code-review` keeps "is this feedback right" as the pushback branch, distinct
  from "address the review"). Recovers ~173 tokens of the ~430 the rewrite cost.
- **`verification-before-completion` re-tightened.** The de-escalation pass above went half a step
  too far here. Per the degrees-of-freedom principle — match specificity to the task's fragility —
  a completion claim is a narrow bridge, not an open field: the gate is now an explicit fixed
  sequence, names the two steps that actually get skipped (fresh run, whole output), and states
  that it covers every phrasing of completion rather than the literal word "done". The
  anti-rationalization scaffolding stays gone; the rigidity comes back as specificity.

### Fixed

- **Normalized the inherited "your human partner" phrasing to "the user"** across 6 files — a
  superpowers-era address that no longer matched the rest of the kit after the de-escalation pass.
- **`.gitignore` now covers `.ruff_cache/` and `__pycache__/`.** The formatter hook shells out to
  ruff, which drops a cache directory in whatever it runs from; one landed inside `skills/` and
  `plugin-config.test.js` correctly failed it as a skill with no `SKILL.md`. Ignoring it stops a
  tool artifact from ever being committed as a fake skill.
- **Four genuine instruction conflicts** where a skill told an agent to commit while twelve other
  files told it not to: `brainstorming` step 5 ("save the design doc **and commit**"), the
  `writing-plans` task template ("Step 5: Commit" with a `git commit -m` block, handed straight
  to an implementer whose own agent definition forbids committing), and `writing-plans`' overview
  and self-review checklist, both of which listed "frequent commits" as a plan-quality criterion.
  All four now stage and stop.
- **Dropped the `**Announce at start:**` preamble** from five skills and the handoff line in
  `no-subagent-fallback.md`. The harness already shows which skill fired; a scripted sentence
  restating it is ceremony the model pays for on every load.
- Removed a byte-identical "why subagents" paragraph duplicated between
  `dispatching-parallel-agents` and `subagent-driven-development`; dispatch mechanics now have
  one owner and SDD points at it.

### Removed

- **`requesting-code-review`** — superseded by `/review`, the `code-reviewer` agent, and SDD's
  own review loop. Its one load-bearing asset, the reviewer prompt template, moved to
  `subagent-driven-development/code-reviewer-prompt.md`.
- **`executing-plans`** — folded into `subagent-driven-development` as
  `no-subagent-fallback.md` (the harness-without-dispatch path). Its two unique contributions,
  the deviation triage (auto-fix / ask / defer) and the don't-offload-what-you-can-do-yourself
  rule, were hoisted into the main skill where both execution paths get them.
- Net across the release: started at 28 skills, merged 2 away (→ 26), added 2 net-new
  (→ 28). Same count, different composition — two skills that duplicated existing surface
  traded for two that cover ground the kit had none of.

## [0.3.1] — 2026-07-18

### Added

- **Learning Loop — meta-inbox (the self-healing channel).** Lessons about keystone
  _itself_ — a skill that didn't fire, wrong guidance, a noisy gate — now route from any
  repo to a single global inbox (`<learnings-dir>/_keystone-meta.md`, repo-agnostic by
  construction; the leading underscore can't collide with a generated repo slug). Entries
  are written **generalized at capture** (the inbox feeds this public repo, so anonymization
  happens at the source). `/retro` gains a standing "did keystone help or hinder?" question
  everywhere, and — inside the keystone repo — drains the inbox by clustering recurring
  themes into proposed skill/command diffs. Promotion machinery stays deliberately manual
  until the inbox proves volume (lean-process rule applied to ourselves).

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

- **The Learning Loop** (internal spec, kept local)
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

- **The Learning Loop** (internal spec, kept local)
  — a compounding spec→plan→execute→learn cycle with relevance-based lesson retrieval. Targeted for v0.2.
