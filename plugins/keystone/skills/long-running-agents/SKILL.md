---
name: long-running-agents
description: Use when designing or reviewing agent work that outlives one context window or one sitting — overnight/autonomous runs, recurring or scheduled agents, "keep going until it's done" loops, or any run needing budget ceilings and stuck-loop detection. Trigger on continuous loops, cron/scheduled agents, self-pacing runs, or multi-session builds.
---

# Long-Running Agents — loop engineering

Design the loop, not just the prompt. An agent is a model plus a harness, and on long-horizon
work the harness — what state persists, when the loop stops, what counts as done — decides the
outcome more than prompt wording does. Generation is cheap now; **verification and continuity
are the bottlenecks**, and this skill owns both for runs that outlive a single context window.

**Start with the simplest loop that works.** Most tasks need no loop machinery at all — a
single session with a plan beats a scaffold. Reach for this skill when the work genuinely
exceeds one sitting or one window; every mechanism below must earn its place (the deletion
test applies to loop scaffolding exactly as it does to code).

## Pick the loop mode deliberately

| Mode                    | Shape                                                       | Right when                                                                  |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Single long session** | one context, compaction/handoffs as needed                  | work fits a day and one window (with resets); the default                   |
| **Fixed-interval poll** | re-run every N minutes                                      | watching external state that changes on a known cadence (CI, deploy, queue) |
| **Self-paced**          | agent chooses its own cadence AND its own termination       | open-ended "keep working until done" with a verifiable done condition       |
| **Scheduled wake**      | agent ends a run by writing its own next-wake time to state | recurring work with irregular, agent-judged timing                          |
| **Queue consumer**      | agents produce/consume messages under a schema contract     | multi-stage pipelines; crash-resume via acknowledgement comes free          |

Name the harness instance, don't hardcode it: Claude Code has native loop/scheduling
primitives (a `/loop` command, wake scheduling, scheduled cloud agents, Stop hooks); other
harnesses have resume/continue plus external cron. The degraded fallback — a shell loop
re-invoking the agent against a spec file — still works, but it is the _fallback_: it has no
native stuck-detection or budget enforcement, so you must add both yourself (below).

**Cold-start rule (applies to every mode):** a scheduled or restarted run wakes with zero
conversational memory. Never wake context-blind — every iteration starts by reading persisted
state (below). If a wake has no state to read, that's a design bug, not a prompt problem.

## The iteration contract

Each iteration of any loop follows the same contract:

1. **Orient from state, not memory.** Read the progress file, the failure log, and the repo's
   own record (e.g. `git log`), then run the baseline checks (tests/build) to learn the _true_
   current state — never trust the previous iteration's claims over what the checks say now.
2. **One task per iteration.** Pick the single next unfinished item. One-shotting the whole
   backlog in one pass is a named failure mode (over-ambition); it produces half-done
   everything and an unresumable mess.
3. **Do the work, verify end-to-end.** "Done" means the feature demonstrably works — run it,
   not just its unit tests. Marking done without verification is the other named failure mode
   (premature completion / victory declaration), and it compounds: every later iteration
   builds on the lie.
4. **End by writing state.** Update the progress file (what's done, what's next, blockers) and
   append anything that _didn't_ work to the failure log. The iteration's value survives only
   in what it wrote down.

**Tell the loop it's unattended.** A model that thinks someone is watching ends its turn to ask
"shall I apply this?" or describes its next step instead of taking it — and an unattended loop
then stalls until the next wake, having done nothing. Put it in the prompt: the user is not
watching and cannot answer mid-run; reversible steps that follow from the spec proceed without
asking; the loop stops only for destructive or irreversible actions and genuine scope changes,
and records those in state as a blocker rather than asking a question into the void; and before
ending a turn it checks that its last paragraph is a result, not a plan. Name the must-stop
actions explicitly — the same line that stops the permission-asking also makes the model less
likely to pause on a genuinely ambiguous step. (`dispatching-parallel-agents/patterns.md` has
the packet-footer wording.)

## Memory lives outside the window

- **Progress file** — the running state: item checklist, current status, next action,
  blockers. The continuity primitive is a **structured handoff file, not a conversation
  summary** — summaries decay and bloat; a state file stays exact. (keystone's
  `/handoff` → `/pickup` flow and `subagent-driven-development`'s run-state file are this
  pattern; reuse them, don't invent a third format.)
- **Failure log** — a persistent "what didn't work and why" file every iteration reads before
  acting. Without it, iteration N cheerfully retries what iteration N-3 already proved
  broken. Highest-value lines: the exact command/approach that failed and the observed error.
- **Initializer session** — for a genuinely multi-session build, spend the first session
  setting up the track to run on: the item checklist, the progress file, a working
  init/baseline script, and a **green baseline** (tests passing before any agent works).
  Worker sessions then start from a known-good floor. Don't build this for a two-session
  task — scale the scaffolding to the run.

## Stopping: budgets, stuck detection, and done

A loop needs three independent exits, or it has none:

- **Done** — a machine-verifiable completion condition (all checklist items pass their
  checks). If success can't be checked mechanically, the task is a poor fit for an
  autonomous loop — keep a human in the loop instead of laundering judgment through one.
- **Stuck ("gutter") detection** — the signature is _motion without progress_: the same
  command failing repeatedly, files edited back and forth, token burn with no state change.
  On detection: write the failure log, stop or re-plan; never just keep spinning. Cap
  iterations as a backstop (a bounded loop that halts beats an unbounded one that has to be
  killed).
- **Budget enforcement, not budget alerts** — a hard spend/token ceiling that halts the run,
  paired with a check on the burn _rate_. Alerting a human who is asleep is not an exit; the
  run has to be able to stop itself. Mechanics in the next section.

## Budget ceilings and velocity breakers

**Ceiling per run and per task, not just per account.** An account-level cap is the last line
of defense — by the time it trips, this run has already spent everything every other run
needed. Give each run a spend/token ceiling, and each task within it a share, so one item's
retry storm can't consume the whole night. On breach, the loop halts and writes state like
any other exit; a ceiling that only logs is an alert wearing a budget's name. Where the
harness or API exposes a task-level budget the model can _see_ mid-run — a remaining-work
allowance it can wind down against — prefer it over a bare output-token cap, so the agent
finishes and hands off cleanly instead of truncating mid-thought.

**Trip on the rate, not the total.** A cumulative ceiling generous enough for an overnight run
is generous enough for a runaway loop to exhaust before anyone reads the alert, and no single
call in that loop looks abnormal. So track spend per unit time and per unit of _verified_
progress (checklist items closed, tests newly green). Burn well above the run's own
established baseline, or sustained burn with the progress denominator flat, trips the breaker
— halt, write the failure log, escalate to a human. This is the gutter signature read off a
different sensor, and the two don't subsume each other: a loop can spin cheaply (fast-failing
commands, no state change) or spend heavily while looking busy (deep retries, a context that
keeps growing). Instrument both.

**Cost exhaustion is an availability problem.** A run that empties the ceiling has denied
itself and everything else sharing that key, and the outage looks identical whether the cause
was a bug, a poisoned tool result that induced an expensive loop, or an attacker feeding the
agent work engineered to be costly — denial-of-wallet, in the same family as the unbounded
consumption class `llm-security` covers. Two consequences for unattended runs, which are the
most exposed because no one is watching: the breaker is a **control**, so keep it where the
agent's own untrusted inputs can't raise or disable it (config the loop reads, not a number
the model can rewrite mid-run); and scope ceilings per run so a single compromised or stuck
agent degrades one run rather than the whole budget.

## Context across a long run

- **Prefer reset over degradation.** Quality decays as a window fills — and models can rush
  or cut corners near the perceived end of a window. For long runs, a deliberate context
  reset from the handoff file beats pushing a tired window further. Resets are cheap when
  (and only when) the state files are good — which is the real reason to keep them good.
- **Compact at semantic boundaries, not byte thresholds.** A finished item is a safe
  compaction point; mid-derivation is not. Threshold-triggered auto-compaction that fires
  mid-task is how runs lose the thread.
- **Don't re-absorb verbosity.** Carry results (status, files, findings) forward, not
  transcripts — the same rule `subagent-driven-development` applies to subagent returns.

## When NOT to loop

- **No machine-verifiable done condition** — subjective or aesthetic targets drift forever.
- **The task needs deep, evolving judgment of one codebase** — a loop's per-iteration
  cold-start re-pays the orientation cost every cycle; a single long session with resets
  does better.
- **A plan already exists with independent tasks** — that's `subagent-driven-development`
  (orchestrated, gated), not an autonomous loop. Loops are for work you _can't_ fully plan
  up front or that must run unattended.
- **The loop exists to avoid writing a spec.** A loop amplifies its spec's quality in both
  directions; garbage spec, confidently iterated garbage.

## Cross-references

- `subagent-driven-development` — run-state format, orchestrator discipline, review gates.
- `/handoff` + `/pickup` — the session-boundary handoff this skill's progress file feeds.
- `llm-security` — denial-of-wallet and unbounded consumption as an abuse class, when the
  runaway burn is adversarial rather than accidental.
- `designing-agent-systems` — tier ladder, effort control, and the cache/prefix economics of
  the loop this skill schedules.
- `dispatching-parallel-agents` — when one loop should fan work out instead of iterating.
- `verification-before-completion` — the done-means-verified bar each iteration must clear.
