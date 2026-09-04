# Harness-specific dispatch notes

## Harness-neutral: orchestrate with whatever the harness gives you

The ladder is universal; the _mechanism_ is harness-specific. keystone runs on more than one
harness — name tools as instances, degrade gracefully:

- **If the harness has a deterministic orchestration primitive** (e.g. Claude Code's Workflow
  tool, or another agent/exec runner) — use it for fan-out/pipeline work, and prefer **pipeline by
  default**: a barrier (wait-for-all) is only right when a stage genuinely needs every prior
  result (dedup across the full set, early-exit on zero). Otherwise items flow independently.
- **If it only has plain subagent dispatch** — fan out manually as below; you carry the baton
  between stages.
- **Find out whether dispatch returns immediately or blocks, and orchestrate accordingly.** The
  test is the primitive's own shape: if the spawn call hands back an _id_ and a **separate**
  wait/collect call exists, it returns immediately — keep working between dispatch and return,
  and call the wait primitive only when the next step needs that result. (Both major coding CLIs
  are this shape today: Claude Code's Agent tool, and Codex's `spawn_agent` with its separate
  `wait_agent`, whose own guidance is to wait sparingly.) If instead the spawn call itself hands
  back the finished **result** and there is no wait call, dispatch blocks: batch every
  independent worker into one turn so they at least run concurrently with each other — the
  "don't idle" rule degrades to "launch all at once."
- **If it exposes deterministic caps** — on subagent spawn depth, concurrent subagents, or spend
  per run — set them for cost-sensitive work rather than relying on prose; a cap is the only
  thing that reaches a worker's own workers, which matters because spawned workers can usually
  spawn their own. Instances, accurate as of this writing and worth re-checking: Claude Code and
  its Agent SDK expose all three (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`,
  `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, the SDK's `max_budget_usd`, from Claude Code 2.1.217);
  Codex caps concurrency (`[agents] max_concurrent_threads_per_session`) and pins per-agent model
  and effort in `.codex/agents/*.toml`. Where a harness has no spend cap, the prose rule plus a
  per-run budget you enforce yourself (`long-running-agents`) is the control.
- **If the primitive takes a per-dispatch effort setting** — use it; it's a finer dial than
  switching models. Two cautions: effort trades _thinking_ for cost, not output length (prompt
  for length separately), and on some models the low end suppresses tool use — a low-effort seat
  may answer from memory instead of searching. Where that holds, give retrieval-heavy seats
  (scouting, research, doc lookup) a rung up, or an explicit line that recognizing a name is not
  knowing its current state and the name is the thing to search.
- **If it has neither** — decompose and run sequentially yourself. The structure (find → verify →
  synthesize) still applies; you just hold it in one context.
- **If it has peer/team primitives** (mailbox-connected teammates that message each other) —
  reserve them for work where members genuinely need to *discuss* (negotiate an interface,
  challenge a design); plain dispatch-and-return is cheaper and more predictable for
  everything else, and coordination overhead grows faster than headcount, so keep teams to
  a handful.

Orchestration patterns that travel across harnesses — a shared vocabulary worth using by
name: **classify-and-act** (cheap triage routes each item to the right handler),
**fan-out-and-synthesize** (independent workers, one synthesis seat), **adversarial
verification** (independent skeptics attack each finding before you commit), **tournament**
(commission N genuinely different full approaches and judge between them — for one-way-door
decisions, not routine work), **loop-until-dry** (keep finding until K rounds surface
nothing new), **completeness critic** (a final "what's missing?" pass).

Two cautions current evidence forces on verification seats: an agent verifying **its own**
output inherits its own blind spots — verifiers get fresh context, ideally a different
model; and identical judges fail in **correlated** ways, so a majority vote of same-model
skeptics is weaker than it looks. Prefer *diverse lenses* (different framings, tiers, or
model families) over N copies of one refuter, binary pass/fail rubrics over graded scores,
and treat any panel vote as a signal demanding verification against the artifact — never as
proof. Don't silently cap coverage — say what you dropped.
