# Harness-specific dispatch notes

## Harness-neutral: orchestrate with whatever the harness gives you

The ladder is universal; the _mechanism_ is harness-specific. keystone runs on more than one
harness — name tools as instances, degrade gracefully:

- **If the harness has a deterministic orchestration primitive** (e.g. Claude Code's Workflow
  tool, or another agent/exec runner) — use it for fan-out/pipeline work, and prefer **pipeline by
  default**: a barrier (wait-for-all) is only right when a stage genuinely needs every prior
  result (dedup across the full set, early-exit on zero). Otherwise items flow independently.
- **If it only has plain subagent dispatch** (e.g. Claude Code's Task tool) — fan out manually as
  below; you carry the baton between stages.
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
