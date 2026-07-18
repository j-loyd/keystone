# Agentic-skills 2026 refresh — audit findings & proposed changes

**Date:** 2026-07-17 · **Status:** APPLIED same day (v0.3.0, staged — see CHANGELOG). Two
directives arrived during execution and are reflected in the shipped edits, beyond the original
findings: (1) **no hardcoded model names anywhere** — all skills/commands/agents now use tier
language (cheap/mid/high/top) with live-resolution instructions, so currency is by construction;
(2) **Boy Scout rule + anti-over-engineering at process altitude** — added to coding-standards
(three-part boundary), executing-plans (deviation carve-out), and /plan-eng-review (lean-process
rubric row). The designing-agent-systems split shipped as: harness-neutral core INTO keystone,
user-level skill re-scoped to a private, project-specific layer kept outside this repo.
**Scope:** keystone's harness/loop/cost skills audited against mid-2026 state of the art.
**Method:** direct read of the skills + five parallel research passes (Anthropic official guidance,
loop engineering, multi-agent orchestration research, LLM cost engineering, cross-harness
landscape), all web-verified July 2026.

---

## Verdict

Keystone's **structure is not archaic** — most of what the industry converged on in 2026 is
already here (see Affirmed below). The real gaps are three:

1. **`cost-aware-llm-pipeline` is a 2024-shaped skill with 2026 prices.** The numbers were
   refreshed (2026-07-01) but the _model_ of cost is still route→retry→batch→cache for
   single calls. It's missing the entire agentic-loop cost layer — cost-per-completed-task,
   cache-hit-rate as the dominant loop lever, fan-out multipliers, and ~6 first-party API
   primitives that now substitute for hand-rolled cost logic.
2. **No skill owns loop engineering.** Keystone has continuity primitives (`/handoff`,
   `/pickup`, run-state) but nothing that teaches long-running/autonomous loop design:
   self-paced vs scheduled loops, stuck-loop detection, budget circuit breakers,
   one-task-per-iteration, machine-verifiable done criteria.
3. **`designing-agent-systems` (user-level, `~/.claude/skills/`, NOT in keystone) is the
   most dated artifact** — frozen on mid-2025 sources ("upgrade to Sonnet 4", LangChain's
   5 architectures, 90.2%/15x numbers as doctrine).

The 2026 framing shift to audit everything against: **prompt engineering (2022-23) →
context engineering (2024-25) → harness engineering (2026+)**. "Agent = Model + Harness."
A skill whose implicit lever is "better prompt" is two generations behind; one whose lever
is "what's in context" is one behind; current skills should also govern _how the model is
allowed to act_ — verification loops, guardrails, budget enforcement, observability.

---

## Affirmed — keystone patterns 2026 evidence now VALIDATES (do not churn these)

| Keystone pattern                                         | 2026 validation                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh-subagent-per-task (SDD, dispatching)               | Now justified on **three independent grounds**: token cost; measured steering-accuracy collapse in shared context (60% @ N=3 agents → 21% @ N=10); context-rot research (degradation from length alone, even with good content well-placed — compaction doesn't fully fix it, resets do) |
| `/handoff` → `/clear` → `/pickup` blessed flow           | Matches the 2026 continuity consensus exactly: **structured handoff files, not conversation summaries**, are the long-job continuity primitive; Anthropic moved past summarize-and-continue for very long jobs                                                                           |
| Run-state file + initializer discipline                  | Anthropic's GA **memory tool** ships this exact "multisession software development pattern" (progress log + feature checklist read at session start, one feature at a time, complete only after end-to-end verification) as official API guidance                                        |
| DONE-with-evidence gate (RED→GREEN + pristine)           | Directly targets the now-named failure modes: **"victory declaration bias" / "premature completion" / "agentic laziness"**                                                                                                                                                               |
| Review-loop stall detection + ~3-round cap               | Maps to MAST's top failure modes (step repetition 15.7%, unawareness of termination 12.4%)                                                                                                                                                                                               |
| Adversarial-review independence rule                     | "Self-review in the same context as generation" is now a **named anti-pattern** (shares generation's blind spots); Critic/Builder structural separation is the default bar                                                                                                               |
| Worktree isolation for parallel writers (parallel-waves) | Converged industry default — Codex, Devin, Cursor, Jules, Grok Build all ship worktree/VM-per-agent + PR-as-handback                                                                                                                                                                     |
| Orchestration is opt-in, "estimate before you spend"     | Anthropic's June 2026 doctrine verbatim: "parallelism and specialization have to earn their coordination cost"                                                                                                                                                                           |
| Verify-don't-trust subagent results (instinct)           | MAS-FIRE (Feb 2026): stronger, _more_ instruction-following models are MORE fragile under untrusted upstream input — blind-trust workers are a liability regardless of model quality                                                                                                     |
| Lightweight/stateless, no heavy state machine            | METR (Feb 2026): production harnesses did NOT beat minimal scaffolds on raw time-horizon; Anthropic (Apr 2026): harness assumptions go stale as models improve — scaffolding is overhead unless it earns itself                                                                          |
| Cross-harness prose-first, SKILL.md-based design         | Agent Skills spec is now an **open standard** (agentskills.io, Agentic AI Foundation, ~40 products incl. Codex/Copilot/Cursor/Goose/OpenCode); keystone's ~500-line budget matches the spec's <5k-token body guidance                                                                    |

---

## P0 — `cost-aware-llm-pipeline`: add the agentic-cost layer

Numbers are current; the _shape_ is stale. Proposed changes:

**a. Reframe the headline metric: cost per completed task, not cost per token.**
The skill's core loop ("cheapest tier first, escalate on signal") stays, but add the
crossover principle it currently can't express: _at high effort on complex agentic work, a
pricier-per-token model can be cheaper per task_ (fewer turns, fewer retries, fewer output
tokens). Live example this month: Sonnet 5 cost **$2.29/task vs Opus 4.8's $1.99/task** on
GDPval-AA v2 despite a 2.5x sticker gap — Sonnet used ~40% more output tokens and ~3x the
agentic turns. On simple tasks the ranking flips. Rule: route by _expected total cost to
clear the quality bar_, and sticker price is only one input. (One benchmark — cite as
illustration of the principle, not a constant.)

**b. Add an "Agentic loops" section — the missing half of the skill:**

- **Cache-hit-rate is the dominant lever in loops, above model choice.** Re-sent context is
  ~62% of a typical agentic bill; uncached loop cost is quadratic in turns, cache reads at
  0.1x flatten it near-linear. Field results: 41–80% cost cuts from caching; one breakpoint
  relocation cut total cost 59% with zero model change.
- **Cache invalidation is a silent cost bug.** Any byte change to the cached prefix
  (timestamps, unsorted JSON, varying tool sets) invalidates everything after it.
  Diagnostic: `usage.cache_read_input_tokens` should be nonzero and stable across loop
  turns; there's now a first-party **cache diagnostics API** (beta `cache-diagnosis-2026-04-07`).
  Mid-conversation system messages (Opus 4.8+) let you inject operator instructions
  _without_ blowing the cached prefix.
- **Subagent fan-out multiplies super-linearly.** Measured: a 121k-token task cost 513k
  tokens (4.2x) fanned to just 2 subagents — each re-pays system prompt + tool defs every
  turn. Budget fan-out as `agents × (task + cold-start overhead)`, not `N × single-agent`.
- **Budget as loop control, not just a ledger.** Pair a hard ceiling with a
  **velocity-based circuit breaker** (sustained tokens/min with no state change = stuck
  loop) — cumulative thresholds trip too late on runaway loops. First-party primitive:
  **Task Budgets** (beta `task-budgets-2026-03-13`) — a token countdown the model _sees_
  during the loop so it winds down gracefully, unlike `max_tokens` which truncates
  mid-thought. The `CostTracker` example should gain both notes.
- **Context reduction primitives are now first-party — don't hand-roll truncation:**
  **context editing** (beta `context-management-2025-06-27`, clears old tool results /
  thinking; Anthropic's stated default for most scenarios) vs **server-side compaction**
  (beta `compact-2026-01-12`, summarizes at a ~150k trigger). Distinct APIs, distinct
  headers — don't conflate.
- **Token-efficient tool use trio** (Nov 2025): tool search / deferred loading (~85% cut on
  tool-def context AND accuracy gains past ~10 tools), programmatic tool calling (~37% cut
  — intermediate tool results never enter context), tool-use examples. Near-free wins on
  tool-heavy agents, orthogonal to model choice.
- **Structured outputs kill the retry tax** — `strict` schemas / `.parse()` instead of
  budgeting a retry percentage for malformed JSON.

**c. Snapshot corrections (small):**

- Note the Sonnet 5 intro pricing **sunsets 2026-08-31** (the table says "through Aug 31"
  — good — but add it to the re-verify triggers).
- Prefer stating cache costs as **universal ratios** (1.25x/2x write, 0.1x read — same on
  every current model) over per-model dollars: ratios don't drift.
- Effort: add "**sweep effort per task class** in an eval rather than defaulting to max"
  (Anthropic's Fable-5 guidance: low effort on Fable 5 often beats prior-gen high). Note
  `budget_tokens` thinking control now **400-errors** on all current flagships — adaptive
  thinking + effort + task budgets replaced it (relevant for reviewing client code).
- One-line mentions: Managed Agents adds a **non-token billing axis** ($0.08/session-hour);
  Claude bills flat to 1M context (no >200k premium — unlike Gemini, which doubles); Claude
  has no priority/flex tier (OpenAI Codex priority = 2x, Gemini Flex/Priority exist) —
  don't assume provider parity when reviewing multi-provider code.
- Tokenizer caveat: research pegs new-tokenizer inflation at **1.0–1.35x** task-dependent;
  soften the current flat "~30%".

---

## P0 — NEW skill: `long-running-agents` (loop engineering)

The genuine gap. Keystone teaches plans, dispatch, review, continuity — but nothing owns
"design the loop." Proposed harness-neutral skill (working title `long-running-agents`;
`/loop`-style commands are instances, not the skill):

- **Loop modes, pick deliberately:** fixed-interval polling · self-paced (agent chooses
  cadence and termination) · agent-scheduled wake (agent writes its own next-run time) ·
  queue-consumer (schema-contract pipelines; crash-resume via ack as a side effect). The
  raw `while true`-around-a-full-agent bash loop is the degraded fallback, not the pattern.
- **What survived from the Ralph era (assume, don't teach as novel):** file-system-as-memory,
  **one task per iteration**, iteration caps (~20 default), a persistent failure log
  ("Signs" file) each iteration reads, greenfield bias (~90% completion ceiling; weak on
  legacy code), works only with **machine-verifiable success criteria**.
- **Stuck-loop ("gutter") detection:** repeated failed commands, file thrashing, token
  velocity with no state change → trip the breaker, log to the failure file, stop or
  re-plan. Budget enforcement ≠ budget alerts (canonical cautionary tale: 4 agents, 11
  days, $47k — anecdotal but the pattern is real).
- **Session lifecycle:** initializer session (feature list, progress file, init script,
  green baseline) + repeated worker sessions that _start_ by reading git log + progress
  file + running baseline tests, work ONE item, _end_ by updating the progress file —
  Anthropic's documented long-running-harness pattern; keystone's run-state already is
  this, so the skill mostly _names and generalizes_ what SDD does, for non-SDD loops.
- **Completion gates:** end-to-end verification before "done" (victory-declaration bias);
  "context anxiety" (rushing as the window fills) is model-dependent — reported severe on
  Sonnet-class, largely absent Opus-class (single-source claim; mark advisory) — prefer
  hard context resets via handoff files over trusting late-window judgment.
- **Compaction is a semantic decision, not a numeric threshold:** compact at task
  boundaries / trajectory convergence; never mid-derivation (SDD already says this —
  cross-reference, don't duplicate).
- **Harness instances:** Claude Code `/loop` + ScheduleWakeup + Stop/TeammateIdle hooks +
  cron/scheduled agents; Codex `resume`/`continue`; bash loop as fallback. Cold-start is
  the named unsolved problem for scheduled wakes — pair every scheduled wake with state
  injection (the progress file), never wake context-blind.

Cross-reference from: SDD (run-state), `/handoff`/`/pickup`, dispatching-parallel-agents,
cost skill (budget-as-loop-control lives there, referenced here).

---

## P1 — `dispatching-parallel-agents`: refresh the dated back half

The front (escalation ladder, harness-neutral, worth-the-tokens) is current. The back half
is 2025 superpowers content. Proposed:

- **Add the read/write asymmetry rule** — the actual resolution of the 2025
  Cognition-vs-Anthropic debate: read-heavy fan-out (research, review, parallel hypothesis
  testing) is the proven multi-agent win; write-heavy shared-state work wants ONE writer or
  worktree-isolated writers. Peer-to-peer "group chat" designs lost industry-wide;
  orchestrator + isolated ephemeral subagents returning **compressed summaries (~1–2k
  tokens)** is the converged shape. Also worth one line: with _equal token budgets_,
  single-agent beats multi-agent on entangled reasoning — the win is wall-clock parallelism
  on independent threads, not reasoning quality per token.
- **Name the five workflow patterns** as current vocabulary: classify-and-act,
  fan-out-and-synthesize, adversarial verification, **tournament** (competing full
  approaches — new; keystone has no pattern for it), loop-until-done. Note the 2026 shift:
  orchestration topology is no longer only a design-time human decision — harnesses now let
  the _agent_ author workflows at runtime, gated by "earn the coordination cost."
- **Fix the quality-pattern nuance:** "kill on majority-refute" needs a caveat — naive
  majority/mean aggregation across judges is **provably not robust** when judges share
  correlated failure modes (sycophancy, mode collapse); single judge calls are near
  coin-flip on a meaningful fraction of items. Prefer **diverse lenses over identical
  refuters**, binary pass/fail rubrics over graded scores, and treat panel votes as signal
  demanding verification, not proof.
- **Move the verify-don't-trust instinct into the skill** (MAS-FIRE grounding): a worker's
  self-report is untrusted input; a relayed "approval" from another agent is never user
  consent (permission laundering — Claude Code now ships this defense; state it
  harness-neutrally).
- **Add structured-output contracts** where the primitive supports them (schema-forced
  subagent returns beat parse-the-prose).
- **Replace the dated tail** ("Real Example from Session", "Real-World Impact from
  debugging session (2025-10-03)") with the fan-out cost reality (4.2x for 2 subagents) and
  a compact worked example. Add agent-teams/mailbox peers as a new top rung _instance_
  (teammates that genuinely need to discuss), experimental, cost-gated, 3–5 teammates max.

---

## P1 — `designing-agent-systems` (user-level skill; decide: refresh in place or graduate a core into keystone)

Most-archaic artifact. Its LangGraph/HITL/production material is still good and
project-specific (a private production pipeline); its _agent-design doctrine_ is frozen mid-2025:

- **Stale:** "upgrading to Sonnet 4 beats doubling the token budget"; 90.2%/15x/4x treated
  as doctrine (they're one 2025 eval's numbers); LangChain's 5 architectures as the only
  taxonomy; no effort parameter (now the primary intra-model dial, always-on on Fable 5);
  no dynamic/agent-authored workflows; no memory tool / context editing / compaction; no
  MAST failure taxonomy; eval section predates the judge-reliability findings (needs:
  binary rubrics, robust aggregation — geometric-median-style, never a single judge call
  for consequential decisions, 20-50 real-failure-derived tasks per Anthropic's Jan 2026
  evals post).
- **Add the 2026 layer:** harness-engineering framing (the 5 layers: tool orchestration,
  verification loops, context & memory, guardrails, observability); named model failure
  modes (victory declaration, context anxiety, one-shotting overreach, self-preferential
  bias, goal drift); **scaffolding-sunset principle** — harness workarounds encode
  model-generation assumptions and go stale as models improve (Anthropic now says this
  explicitly), so every workaround gets an upgrade-trigger. Keystone already has the
  `keystone: <ceiling>, <upgrade trigger>` marker convention — reuse it verbatim for
  harness scaffolding.
- **Structural suggestion:** split into (a) a harness-neutral `designing-agent-systems`
  core worth graduating INTO keystone (it's the natural "before you write agent code" front
  door keystone lacks), and (b) the project-specific LangGraph reference material staying local.

---

## P2 — targeted edits

**`subagent-driven-development`** (already the most modern — small adds only):

- One line grounding fresh-context in the three 2026 justifications (cost, steering
  collapse, context rot) — it currently argues rot only.
- Review stages: require **adversarial framing** in reviewer prompts (confirmatory
  second-look same-model review inherits sycophancy; where the harness allows, put Riley on
  a different tier/family for HIGH-risk tasks — adversarial-review already does this for
  docs; mirror it for code review at HIGH).
- Name the failure modes the gates already defend against (victory declaration, premature
  completion) so future editors don't delete the teeth.
- Optional: note that reviews of task N may pipeline against implementation of N+1 when
  isolation allows (wall-clock; default stays sequential).

**`/context-budget`:**

- The "every connected MCP server's schemas load always" premise is now **conditional**:
  deferred tools / tool-search (harness-level and API-level) keep schemas out of context
  until needed (~85% cut; a typical 5-server setup ≈55k tokens _without_ deferral). Update
  the measure step to check whether the harness defers, and add recommendation #0: "prefer
  deferred loading where the harness supports it; disconnect what can't be deferred."
- Name the cross-cutting principle: **advertise cheap, load on demand** (progressive
  disclosure) — now spans skills (3-stage spec), MCP (code mode), and tools (deferred
  loading). It's the design invariant, the mechanisms are instances.

**`adversarial-review`:**

- Multi-seat escalation: add the correlated-failure caveat — a second seat from the same
  model family doesn't decorrelate shared biases; prefer different family (the documented
  cross-provider fast-follow just got stronger evidence) or a genuinely different lens.
- Note binary per-dimension gates are more reliable than graded scores (the survivability
  rubric's "any 1–2 blocks the verdict" already behaves binary — keep, and resist
  averaging).
- Optional new instance under approach-optimality: **tournament** (commission a competing
  approach rather than only critiquing the incumbent) for one-way-door decisions.

## P3 — security follow-up (separate pass; standing priority)

Flag for `llm-security` / `security-review` (not this refresh's scope, but surfaced):

- **MCP tool poisoning** as a first-class threat: malicious instructions in tool
  metadata/descriptions; MCPTox benchmark >60% attack success across popular agents (peak
  72%); NSA published a dedicated CSI on MCP security (May 2026) — scanning/filtering/
  sandboxing guidance worth encoding.
- **Permission laundering** in multi-agent setups: relayed approval ≠ user consent.
- **Invisible-orchestrator effect** (2026): orchestrator-mediated requests suppress worker
  refusal behavior and diffuse accountability — independent safety checkpoints per agent,
  don't rely on orchestrator judgment alone. Directly relevant to SDD's orchestrator role.
- MAS-FIRE blind-trust fragility (also cited above) belongs in the agent-security section.
- NIST AI Agent Standards Initiative (Feb 2026) + SP 800-53 agent overlays in draft —
  watch, don't encode yet.

---

## Corrections & open questions (verify before asserting)

1. **Codex + Claude hooks:** research says Codex _converts_ Claude hooks via `codex import`
   (TOML output) and supports dual-manifest plugins — vs our 0.2.1 root-cause note that
   Codex "natively consumes" Claude-format plugins + hooks.json. Both may be true across
   versions/paths. Verify at next Codex update before re-touching `hooks.json` docs; the
   0.2.1 fix itself (bare `${CLAUDE_PLUGIN_ROOT}` + `${PLUGIN_ROOT}` fallback + degrade)
   remains correct either way.
2. **Gemini CLI is sunsetting** into "Antigravity CLI" (individual access ended Jun 2026)
   — don't invest cross-harness effort there.
3. Single-source claims marked above (context-anxiety model split, $47k loop, the
   Sonnet-vs-Opus per-task numbers) — use as illustrations, not doctrine.
4. Anthropic's "2026 Agentic Coding Trends Report" PDF content could not be independently
   verified — don't cite it.

## Suggested execution order

1. `cost-aware-llm-pipeline` agentic-cost layer (P0 — and the Sonnet-5 pricing sunset is
   6 weeks out)
2. New `long-running-agents` skill (P0)
3. `dispatching-parallel-agents` back-half refresh (P1)
4. `designing-agent-systems` refresh + graduate-into-keystone decision (P1 — needs
   the maintainer's call on the split)
5. `/context-budget` + `adversarial-review` + SDD targeted edits (P2, small)
6. Security additions as a separate `/cso`-adjacent pass (P3)

Each item is independently shippable; 1–3 need no user decisions beyond approval.
