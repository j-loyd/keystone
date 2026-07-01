# Changelog

All notable changes to keystone are recorded here.

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
