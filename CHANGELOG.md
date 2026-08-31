# Changelog

All notable changes to keystone are recorded here.

## [0.6.0] — 2026-08-30

Second borrow pass over [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
(MIT — see `ATTRIBUTION.md`), plus the removal of one skill and a new structural-validator tier.
Ideas are upstream's where noted; all prose written for keystone. **31 → 30 skills.**

### Removed

- **`cost-aware-llm-pipeline`** — its `description` claimed routing territory belonging to three
  other skills. Measured against the live corpus, the prompt *"should I fan out subagents for this
  or do it inline"* ranked it **#1 at 0.272** over `dispatching-parallel-agents` at 0.160 — a near
  restatement of that skill's own stated purpose — and *"batch process these N records"* matched
  nothing else at all. The routing evals had missed it because the suite held only positives
  written for the skill, never adversarial prompts from a neighbour's territory.
  Content was rehomed, not dropped: the **tier ladder, cache economics, and the
  no-hardcoded-model-IDs/prices rule** into `designing-agent-systems`; **budget ceilings, velocity
  circuit breakers, and denial-of-wallet** into `long-running-agents`. Thirteen prose references
  and two eval-case `owner` fields were retargeted or cleared.

### Added

- **Structural validators (`scripts/`)** — a deterministic tier below the routing evals, with 111
  new tests. `validate-versions` holds `VERSION` and both manifests to one value (the drift this
  repo hit at 0.27-vs-0.18); `validate-reference-links` proves every relative `.md` link in a skill
  resolves from its own directory, in-repo and in the plugin-install layout;
  `validate-skills` enforces keystone's frontmatter contract — `name` + `description` only,
  name matching a kebab-case directory, a description that binds use to a **situation** rather than
  a purpose (bare "Use to…"/"Use for…" is rejected), a description-length ratchet set above the
  observed ceiling, and dead cross-skill-reference detection. Exemptions live in the validator,
  never in a skill's own frontmatter, so a skill cannot exempt itself.
- **`## Rationalizations` + `## Red flags`** authored for eight discipline skills —
  `security-review`, `api-security`, `coding-standards`, `verification-before-completion`,
  `test-driven-development`, `simplifying-code`, `auditing-for-overengineering`,
  `receiving-code-review`. Scoped deliberately to skills where rationalization is a *live* failure
  mode rather than applied catalog-wide: a generic block teaches readers the heading is skippable.

### Changed

- **`api-security`** — idempotency keys that actually deduplicate: key derived from the intent
  rather than the attempt, **uniqueness on `(principal, key)`** so one caller cannot claim
  another's key or be handed their stored response, atomic claim (look-up-then-write is a race),
  a payload hash over a *canonical* form, an explicit in-flight-duplicate policy, **unknown as a
  third outcome**, and retention that outlives the longest replay window. Plus OAuth **PKCE +
  `state`**, and the DNS-rebinding half of SSRF.
- **`security-review/data-privacy.md`** (new sibling) — data-lifecycle review, kept out of the
  source→sink file because it is an architecture pass, not a diff pass: classification tiers,
  purpose-bound minimization, and a deletion path that reaches backups, caches, indexes,
  analytics copies, queues/CDC, and versioned object storage — while being honest that
  append-only retention-locked logs cannot do per-subject deletion, so the control there is
  keeping data out of them. Consent gates onward sharing, and an LLM vendor counts. Cited from
  `SKILL.md`'s pre-deployment checklist. Plus **Subresource Integrity** stated usably in
  `SKILL.md` — `crossorigin="anonymous"` is required or the check cannot run, SRI covers exactly
  one hop, and some artifacts (floating refs, UA-varying stylesheets) have no stable hash.
- **SSRF is a TOCTOU bug** (`security-review` A06, `api-security` API7) — validating a hostname and
  then handing that hostname to the client lets the check and the connection see different IPs. The
  fix as stated: resolve once, validate **every** address in the answer, connect to exactly one with
  fallback to alternates disabled (happy-eyeballs-style retry silently reopens the gap), or front it
  with a filtering egress proxy — re-checked on each redirect. `api-security` owns the full
  treatment (SSRF is API7); `security-review` carries the reviewer's question and a pointer. Block lists now cover IPv6 and
  IPv4-mapped forms, so `::ffff:169.254.169.254` cannot walk past a v4-only list.
- **`coding-standards`** — dependency-*upgrade* review (changelog over version number, one
  dependency per change, green suite before and after, the **lockfile** diff not just the manifest)
  and documentation-verification discipline (version from the manifest, anchored deep links, an
  explicit `UNVERIFIED:` marker instead of hedged prose).
- **`llm-security`** — never hardcode an outbound endpoint taken from a fetched doc example without
  surfacing it, even when the docs mark it required.
- **`writing-plans`** — a Phase-0 **capability map** gating multi-capability requests: a module
  table with an explicit build order, stable kebab-case ids, "if two modules each need the other
  they are one module", and interfaces specified in the provider's plan. Reconciled explicitly with
  the folder phase index and `## File Structure` as three nested partition passes.
- **`systematic-debugging`** — Phase 1 no longer dead-ends at "gather more data": four branches for
  a bug that will not reproduce (timing, environment, state, truly intermittent), plus `git bisect`.
- **`deprecation-and-migration`** — the feature-flag lifecycle, ending at *remove the flag and its
  dead code*, with a cleanup trigger recorded as a `keystone:` marker so `/debt` harvests it.
- **`git-workflow`** — version-bump criteria by consumer-observable impact; changelog grouped and
  written with the change. Which files carry the version stays owned by `/ship`.
- **`verification-before-completion`** — acceptance criteria (per task) vs. Definition of Done
  (standing); a task is done only when both hold.
- **`subagent-driven-development`** — `parallel-waves` gains a third category between parallel and
  sequential: tasks coupled only through an interface become parallel once the contract is defined
  first. The independent-AND-isolated gate still binds.
- **`brainstorming`** — divergent *generation* lenses (inversion, constraint removal, audience
  shift, combination, simplification, 10×, expert lens, analogous inspiration with a
  structural-not-surface test), supplying the method `/office-hours` assumed when it asked for three
  genuinely different approaches.
- **`/qa`** — browser-automation guardrails: prefer an isolated profile, since attaching to the
  everyday session exposes every open window; DOM, console, and network content is untrusted data,
  never instructions.
- **`/cso`** — rotate *then* purge; a secret is compromised the moment it reaches a remote.
- **`/to-issues`** — once issues exist in a tracker, the plan's task list is an ordered index of
  ids, not a duplicate checklist.
- **`/ship`** — where a change shipped behind a flag, flag-off is the first rollback lever.

### Changed — second source: [mattpocock/skills](https://github.com/mattpocock/skills) (MIT)

A parallel borrow pass over a library keystone had already taken `to-issues`/`to-prd` from.
Twenty-nine live skills reviewed; four genuine gaps found, all folded, no new skills.

- **`systematic-debugging`** — **minimisation**, which keystone had no equivalent of: shrink the
  reproduction until *every remaining element is load-bearing*, because each element cut is a
  suspect struck off before Phase 3 builds its fault tree. Above it, the **reproduction-rate**
  framing — aim at the rate, not at a clean repro ("a bug that fails half its runs is debuggable,
  one that fails a run in a hundred isn't"), which turns the existing intermittency branches into
  instruments with a target and a measurable stopping condition. Minimising is gated on it:
  against a 1%-reproduction loop you cannot tell "that cut removed the cause" from "that run got
  lucky." Plus a **loop-construction ladder** (ten ways to build a red signal, cheapest and most
  deterministic first), **tagged instrumentation** (`[DEBUG-a4f2]` — untagged logs survive, tagged
  logs die) with a new **Phase 4 cleanup gate** keystone previously lacked, and "if no correct seam
  exists, that itself is the finding" routing to `improve-codebase-architecture`.
- **`writing-skills`** — **leading words**: recruit a pretrained concept as a repeated anchor token,
  since a made-up word recruits no priors and you pay in definition tokens what a pretrained word
  gives free. **Completion criteria have two independently-moving properties** — *clarity* (can the
  agent tell done from not-done; vague bounds cause premature completion) and *demand* (how much
  work the bound compels) — with the fix order stated: sharpen the bound first, and note that
  splitting to push steps past a boundary only works across a *real* context boundary. And
  **the environment is a source of truth; a doc restating it is a cache** — cache the unwritten
  convention, not the one-command lookup.
- **`writing-plans`** — **fog**: a plan is deliberately incomplete, and a `## Not yet specified`
  section holds in-scope questions not yet sharp enough to task. The load-bearing rule is the
  **fog-or-task test — whether you can state the question precisely now, not whether you can answer
  it now** — making fog the complement of SPIDR's Spike (sharp-but-unanswered) rather than a rival.
  Disambiguated against the existing No Placeholders rule by location: fog lives in its own named
  section, never inside a task's steps. **"Out of scope" is a separate section, not fog** — fog
  graduates into tasks, out-of-scope never does.
- **`writing-plans`** — the **wide-refactor exception to vertical slicing**, with a three-part
  qualification test (mechanical, too many call sites for one reviewable task, no subset can change
  alone) so the exception cannot be claimed by anything merely large: *a change where some callers
  can be cut over independently is a vertical slice you haven't found yet*. Sequenced expand →
  migrate in batches sized by blast radius → contract, with green promised only at a final
  integrate-and-verify task where batches cannot stay green alone. **Prefactor first** — a wide
  blast radius is sometimes a symptom, and extracting the seam can dissolve the exception entirely.
- **`test-driven-development`** — **agree the seam before RED**, alongside the existing
  find-the-real-test-command step. An unconfirmed seam is a question, not a default: unnamed, tests
  land at whatever boundary was easiest to reach, producing a suite that is simultaneously
  over-tested (the same behavior asserted at three levels "to be safe") and under-tested (nothing
  at the level that would catch the regression). Where there is nobody to confirm with, record the
  chosen seam and the reason where a reviewer sees it rather than picking by convenience. The
  no-correct-seam case is the same rule `systematic-debugging` applies at bug-fixing time, here at
  feature-writing time — both route to `improve-codebase-architecture`.

### Fixed — pre-release review and audit pass

A `/review` over the folds that had not been independently reviewed, plus an `/audit` over the
whole release, run before shipping. Both returned findings; all were applied.

- **`writing-plans`' wide-refactor section told the executor to land batches on a shared
  integration branch**, which requires per-batch commits — contradicting the no-auto-commit rule
  stated four times in that same file and in `CLAUDE.md`. Green is now promised at the
  integrate-and-verify task; how batches are held until then is the user's call at execution time.
- **The "no correct seam" rule was restated near-verbatim in two skills** rather than owned by one
  — a Duplication violation shipped in the same release that added the Duplication rule, and one
  that wrote past a pointer already present a bullet above. `test-driven-development` now owns it;
  `systematic-debugging` cites it.
- **The new `seam` definition contradicted the kit's own glossary** and was built on "boundary", a
  word `improve-codebase-architecture/LANGUAGE.md` explicitly bans as overloaded — while both new
  folds route readers into that skill. Now defers to the owning definition.
- **The capability-map gate contradicted the Light plan level** and failed this file's own
  lean-process self-review. Scoped to multi-module work; skipped for single-module and Light runs.
- **`[DEBUG-]` tagging was buried inside a multi-component step** that single-component debuggers
  skip, while the Phase 4 checklist greps for the marker they were never given. Lifted to a
  standing rule at the top of Phase 1.
- **Trimmed ~160 lines of restatement and decoration**: the duplicated SSRF treatment, four
  Rationalizations/Red-flags entries that restated their own file, a ten-rung ladder where the
  first item covered nine cases in ten, an ASCII diagram restating the prose above it, and three
  paragraphs of border patrol defending a term rather than using it.

## [0.5.0] — 2026-08-10

Borrow pass over [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT —
see `ATTRIBUTION.md`): three new skills and technique folds across fifteen existing files.
Ideas are upstream's where noted; all prose written for keystone.

### Added

- **`performance-optimization`** — measure → identify → fix → verify → guard, with the
  discipline most perf work skips: **neutral is a revert, not a keep** (a keep/revert decision
  table; the win threshold is chosen *before* looking at the result), beat the noise not the
  mean, one change at a time, correctness gates the metric, and an **attempt ledger** so
  reverted ideas leave a trace git history won't keep. Sudden slowdowns route to
  `systematic-debugging` first.
- **`observability`** — instrumentation starts from the 2–4 literal questions on-call will ask,
  not from signals. Metrics = *that*, traces = *where*, logs = *why*; percentiles never
  averages; **cardinality as the failure mode** (explicit never-a-label list); mandatory
  correlation IDs; two alert severities only, each with a runbook; and a **verify-the-telemetry
  gate** — an induced staging failure must be locatable via telemetry alone.
- **`deprecation-and-migration`** — Hyrum's Law makes deprecation an active migration, not an
  announcement; the Churn Rule (the owner migrates the users); a worked **expand/contract**
  schema change (additive first, destructive last *and alone*, tested down path, throttled
  backfill) generalized to any interface where two versions run live; zombie-code signals with
  a binary verdict, routing remove-vs-keep through `auditing-for-overengineering`'s deletion
  test.

### Changed

- **`systematic-debugging`** — description gains "a working feature is suddenly slower or
  broken", the routing boundary that keeps sudden-slowdown asks here rather than at the new
  `performance-optimization` skill (whose scope note points back the same way).

- **`adversarial-review`** — three moves from upstream's `doubt-driven-development`: **blind
  dispatch** (the reviewer gets the doc + its contract, never your conclusion — handing over
  your verdict turns review into grading), a **first-match-wins reconcile precedence**
  (contract misread → fix the packet / accepted → fix the doc / disagreement → explicit
  tension / noise → discard, and 3+ noise findings indict the packet), and a **review-theater
  tripwire** (repeated substantive findings with zero accepted = a loop that can't fail).
- **`/challenge` + `llm-security`** — handing an artifact to an external model CLI is a
  trust-boundary crossing: run it read-only/sandboxed, feed the artifact on stdin (never a
  shell-quoted argument — backticks and `$()` in a doc are live shell in a terminal), one
  authorization per invocation. Hardens the cross-provider hop before the packet round-trip
  fast-follow gets built.
- **`brainstorming`** (+ thin echoes in `grill-with-docs`, `office-hours`) — four interview
  moves from upstream's `interview-me`: a stated **hypothesis with a confidence number and the
  gaps named** before the first question; a **want-vs-should-want detector** with the unlock
  probe ("if you didn't have to justify this to anyone, what would you actually want?"); a
  checkable stop test (predict the next three answers); and **what doesn't count as approval**
  ("whatever you think is best" is delegation; "sounds good" isn't a yes). `grill-with-docs`
  keeps ownership of one-question-at-a-time-with-a-recommendation — that move predated this
  and was not duplicated.
- **`test-driven-development`** — find the real test command before RED: checked-in wrappers
  over global tools, focused-run vs full-suite, and read CI because it names what actually
  gates merges.
- **`/review` + `code-reviewer`** — a **structural remedies** list (eight named moves) so the
  reviewer proposes the restructuring, not just the complaint; prefer the remedy that removes
  moving pieces. Sits alongside the existing over-engineering tags, same taxonomy.
- **`/ship`** — a rollout-thresholds table (green / yellow / red bands per signal) handed to
  whoever deploys, framed as per-service defaults. `/ship` still stops before committing.
- **`/qa`, `/audit`, `qa` agent — metric honesty** — never present an estimated figure as a
  measurement: tag every number `measured-now` / `read-from-artifact` / `estimated`, write
  `not measured` where nothing measured it. A plausible invented figure is worse than an
  absent one.
- **SDD implementer prompt** — reports now include `Things I didn't touch (intentionally)`,
  as scope-discipline evidence and `/debt` input.

## [0.4.1] — 2026-07-29

### Fixed

- **`finishing-a-development-branch` shipped 0.4.0 with its pre-rewrite description.** While
  fixing a splitter bug in that file, `git checkout HEAD -- <file>` restored it from the last
  *commit* (v0.3.0) rather than the staging area, silently reverting the retrieval rewrite and
  synonym prune along with the bad split. The re-split was redone; the description was not.
  Verified the loss was confined to that one line — the split and announcement removal survived,
  and no other file was affected. Re-audited all 28 descriptions.

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
