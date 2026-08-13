---
name: ship
description: Prepare a change to ship — run tests, review the diff, bump VERSION, update CHANGELOG, and draft the PR. STOPS before committing; commits/pushes only on explicit go-ahead.
argument-hint: "[optional: what's shipping]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Edit
---

# Ship — prepare, then wait for the word

Prepare the current work to ship: **$ARGUMENTS**.

> **Hard rule (the no-auto-commit rule):** this command does **NOT** commit, push,
> or open the PR on its own. It does everything _up to_ the commit, then stops and asks.
> Staging (`git add`) is fine. Committing/pushing/`gh pr create` happen only after the
> user explicitly says go.

## Steps

1. **Branch check.** Confirm you're not on `main`/`master`. If you are, stop and propose
   a branch name — don't prepare a shippable change directly on the default branch.
2. **Run the tests / build / typecheck / lint** that this repo uses. **This is a gate,
   not a suggestion:** if anything fails, stop and report — do not proceed to prep,
   regardless of how small the diff looks.
3. **Review the diff** against the base branch (run `/review`-style checks, or invoke the
   `review` command). **Treat its verdict as a gate**: a FAIL (blockers) means stop and
   report them — do not proceed past this step until they're fixed, or the user
   explicitly accepts the risk in writing (record what was accepted and why in the
   hand-off summary in step 7). A PASS, or a CONCERNS the user has acknowledged, clears
   the gate.
4. **Plan completion gate.** If a plan file exists for this work (from `writing-plans`,
   or one the user points you at), cross-check its action items / acceptance criteria
   against the diff. Classify each as **DONE** (clear evidence in the diff), **PARTIAL**,
   **NOT DONE**, or **UNVERIFIABLE** (can't be proven from this repo's diff — e.g.
   external config, a sibling repo). Any NOT DONE or UNVERIFIABLE item is a **mandatory
   approval gate**: stop and ask the user to decide, per item — fix it now, ship anyway
   and track it as a follow-up, or confirm it was intentionally dropped. Don't
   blanket-approve the whole list in one ask — a "yes to all" where the user hasn't
   actually read each item defeats the point of the gate. No plan file found → skip this
   step and say so plainly.
5. **Version + changelog.** If the repo has a `VERSION` file and/or `CHANGELOG.md`, bump
   the version appropriately and draft the changelog entry (edits are fine — they're not
   commits). **Bump _every_ version field together, or they drift.** A repo often carries its
   version in more than one place (a `VERSION` file, `package.json`, a plugin/extension/package
   manifest, a lockfile), and the one a user's tooling actually reads for updates may not be the
   one you bumped. Grep the repo for the old version string and confirm none are left behind — a
   stale manifest silently makes update checks report "already at latest" on an old number while
   `VERSION` races ahead. (Which files carry the version is repo-specific — record that list in
   the project's own `CLAUDE.md`/`CONTEXT.md` so the set is bumped as a unit.)
6. **Draft the PR.** Prepare the title and body (summary, rationale, test evidence). Show
   it to the user. Do **not** create it yet.
7. **Approval gates summary, then stop and hand off.** Before asking for the word, print
   a clear go/no-go table so the user's go-ahead is an informed approval, not a rubber
   stamp:

   | Gate                 | Status                                                  |
   | -------------------- | ------------------------------------------------------- |
   | Tests / build / lint | pass / fail                                             |
   | Review (`/review`)   | PASS / CONCERNS (accepted, note by whom) / —            |
   | Plan completion      | all DONE / N items deferred (list them) / no plan found |
   | Version sync         | bumped this run (list every file) / already current     |

   Then print: what's staged, the proposed version bump, and the draft PR text; the exact
   commands you would run to commit + push + open the PR. Then wait. Only on an explicit
   "commit" / "ship it" / "push" do you run them — and only once every gate above is
   either clear or explicitly waived by the user, never silently skipped.

## Watch window — hand these to whoever deploys

This command stops at the commit, so the deploy happens after you. Put the rollout
thresholds in the hand-off anyway, so "did it work?" has an answer that isn't a vibe.
These are **defaults to tune per service**, not gospel — a nightly batch job and a
checkout API deserve different numbers.

| Signal                   | Green          | Yellow — investigate     | Red — roll back   |
| ------------------------ | -------------- | ------------------------ | ----------------- |
| Error rate vs. baseline  | within 10%     | 10–100% over             | >2× baseline      |
| p95 latency vs. baseline | within 20%     | 20–50% over              | >50% over         |
| New client-side errors   | no new types   | new type, <0.1% sessions | >0.1% of sessions |
| Key business metric      | flat or better | <5% decline              | >5% decline       |

Compare against the pre-deploy baseline over a comparable window, not against zero. If a
signal isn't instrumented, say so — an unwatched rollout is a choice, not a pass.

Keep it honest: if tests failed or a step was skipped, say so plainly in the summary.
