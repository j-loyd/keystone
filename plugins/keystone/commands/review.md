---
name: review
description: Pre-merge production-readiness review of the current diff — correctness, safety boundaries (SQL, secrets, LLM trust), and reuse. The single keystone reviewer.
argument-hint: "[optional: base branch, PR #, or paths]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# Review — is this safe to merge?

This is keystone's **one** code reviewer (it replaces the various overlapping
reviewers). It reviews the diff in **$ARGUMENTS** (default: current branch vs. its base).

> Prefer dispatching the **`code-reviewer`** agent through this harness's subagent-dispatch
> primitive (Claude Code's Task tool, or the equivalent elsewhere) so the review runs in a
> fresh context, unanchored by the implementation reasoning. Fall back to reviewing inline
> if subagents aren't available. Either way, follow the process below.

## Process

### 1. Get the diff + set scope by codebase size

Determine the base (`git merge-base`), then read the full diff and the surrounding code
for each changed file — review the change _in context_, not as isolated hunks.

Scale depth to the codebase, not the diff: **SMALL** (<20 files) → read all touched deps +
full `git blame`; **MEDIUM** (20–200) → one-hop deps + priority files; **LARGE** (200+) →
critical paths only, and say so. **Risk-classify each changed file first** (HIGH = auth,
crypto, value transfer, external calls, removed validation; MEDIUM = business logic, state,
new public APIs; LOW = comments, tests, UI, logging) and spend your budget on HIGH.

> Don't rationalize a shallow review. "Small PR" — Heartbleed was two lines. "Just a
> refactor" — refactors break invariants; treat as HIGH until proven LOW. "I know this
> code" — familiarity breeds blind spots.

### 2. Review for, in priority order

1. **Correctness** — logic errors, off-by-one, wrong conditionals, unhandled cases,
   broken error handling.
2. **Safety boundaries** (highest-leverage, easy to miss):
   - **SQL** — injection, missing `WHERE`, destructive migrations run on prod data.
   - **Secrets** — keys/tokens in code, logs, or client bundles.
   - **LLM trust** — is model/tool/user-supplied text treated as untrusted data, or can
     it reach a privileged action / a shell / a query unescaped?
   - **Side effects** — anything irreversible behind a weak condition.
3. **Reuse & over-engineering** — duplicates an existing util, reinvents stdlib/the
   platform, ships an abstraction with one caller, or could be plainly shorter? This is the
   `auditing-for-overengineering` lens at diff scope — tag findings `delete/stdlib/native/yagni/shrink`
   and **name the replacement**.
4. **Tests** — does risky logic have coverage? (Don't demand tests for trivial changes.)

Score every finding's confidence 1–10: verified by reading the exact line(s) that cause it
= 9–10; a strong pattern match you're fairly sure of = 7–8; plausible but unconfirmed =
5–6 (flag it as such, don't present it as settled). Below 5, don't report it as a finding —
before promoting anything, quote the specific line(s) that motivate it; if you can't quote
the motivating code, the finding is unverified — downgrade it rather than asserting it.
Format: `[severity] (confidence: N/10) file:line — finding`.

### 2b. Differential discipline (what changed, and what it touches)

- **Regression check** — `git blame`/`git log` the changed lines. Was a security control
  (a check, a `WHERE`, validation, an authz guard) **removed or weakened**? Was a
  previously-fixed bug **re-introduced**? Diffs that delete defenses are the dangerous ones.
- **Blast radius** — for each changed function/export, count the **downstream callers**
  (`grep` the symbol). A 3-line change to a widely-called helper is high-impact; quantify
  it rather than eyeballing.
- **Attacker view** — for HIGH-risk changes, model the concrete scenario: who could reach
  this, with what input, to what effect? A finding without a plausible attack path is a nit.

### 3. Specialist fan-out (MEDIUM/LARGE or HIGH-risk diffs)

A single pass over the whole diff misses domain-specific issues a focused pass would
catch. For diffs at MEDIUM/LARGE scope (per step 1) or carrying a HIGH-risk file (per
2b), dispatch the **`code-reviewer`** agent multiple times in parallel — one call per lens
through whatever subagent-dispatch primitive this harness offers (Claude Code's Task
tool, or the equivalent elsewhere), issued in a single batch so they run concurrently —
each scoped to only that lens's checklist. If the harness has no parallel-dispatch
primitive, run the lenses sequentially yourself instead of skipping them:

- **Security** — auth/authz bypass, injection beyond SQL, secrets exposure, crypto
  misuse, XSS escape hatches. Dispatch when auth is touched, or the diff is backend and
  over ~100 lines.
- **Performance** — N+1 queries, missing indexes, algorithmic complexity, unbounded
  pagination, blocking I/O in async paths. Dispatch when backend or frontend code moved.
- **Data migration** — reversibility, lock duration, backfill strategy, multi-phase
  deploy safety. Dispatch when the diff touches a migration file.
- **Testing & maintainability** — missing negative-path/edge-case tests, dead code, DRY
  violations, stale comments. Dispatch alongside the others whenever fan-out fires — it's
  cheap and has a high hit rate.

Skip fan-out for small diffs (roughly <50 changed lines) — review inline; a specialist
pass would find nothing a single read wouldn't. Each specialist returns findings in the
same `[severity] (confidence: N/10) file:line — finding → fix` shape as step 2. Merge
results: a finding that lands on the same `file:line` from more than one lens is
**confirmed by N specialists** — bump its confidence and surface it first.

This is the cost-tier fan-out pattern in practice: route the per-lens passes at
**Haiku/Sonnet**, and reserve **Opus** for adjudicating a specialist disagreement or a
finding you can't confidently confirm or dismiss.

### 4. Adversarial second pass (HIGH-risk diffs, or on request)

The passes above are checklist-shaped — they miss what isn't on any checklist. For a diff
carrying a HIGH-risk file (per 2b) or 200+ changed lines, run one more pass with fresh
context and no checklist: "think like an attacker and a chaos engineer — what breaks this
in production that the structured review didn't catch?" Dispatch this as an independent
`code-reviewer` pass through this harness's subagent-dispatch primitive (genuinely fresh
context — it must not see the earlier findings, or it'll anchor on them) when one is
available; otherwise run it yourself as a distinct final pass, explicitly setting aside
your own prior findings while you do it. Tag its output `ADVERSARIAL:` and merge into the
verdict the same way as the specialist findings. If it turns up nothing, say so plainly —
that's a real result, not a skipped step.

### 5. Cost-tiered depth

Scale effort to the diff. Small/mechanical diff → review inline yourself. Large or
high-risk diff → fan out per-file with **Haiku** to flag candidates, escalate only the
flagged spots to **Sonnet**, and reserve **Opus** for genuinely ambiguous calls. Don't
burn the big model on boilerplate.

### 6. Verdict

Group findings by severity (**blocker / should-fix / nit**) with `file:line` refs, each
with its blast radius and (for security findings) the attack path. **State your coverage
honestly** — what you reviewed deeply, what you sampled, and your confidence. End with
**PASS** or **FAIL** and the must-fix list. If the author wants to act on the feedback,
point them at the `receiving-code-review` skill.

Do not commit or push anything (see the no-auto-commit rule).
