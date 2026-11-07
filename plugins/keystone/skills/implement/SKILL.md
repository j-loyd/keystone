---
name: implement
description: Build a spec's tickets on one integration branch — an implementer subagent per unblocked ticket in its own worktree, merge as each lands, then one final review. Re-running resumes from the frontier. Use when the user runs /implement after /spec and /to-tickets.
disable-model-invocation: true
---

# Implement — tickets to an integration branch

Implement: **$ARGUMENTS** (a spec path, a feature slug under `.scratch/`, or a tracker issue).

The goal is the whole spec implemented on a single **integration branch**, with every ticket
resolved the way the tracker closes work. Read `docs/agents/issue-tracker.md` if it exists;
otherwise the tickets are local files at `.scratch/<feature-slug>/issues/`.

The tickets are a **task graph**, not a list of steps: each declares the tickets that block it.
The **frontier** is every ticket that isn't done and whose blockers are all done. Work the
frontier, and widen it as tickets land.

**Git rules.** Commit freely to ticket branches and the integration branch. **Never push, open a
PR, or merge into the main branch unless the user asks.**

## Done, per tracker

- **Local**: the ticket file's `**Status:**` line reads `done`. Set `in-progress` when you start a
  ticket and `done` when it merges, and append a one-line `## Comments` entry with the evidence
  (e.g. `merged into feature/x at a1b2c3; 3 tests red then green`).
- **Remote tracker**: when a ticket merges, comment `merged into <branch> at <sha>` on its issue;
  close the issues at the end (step 7). A ticket with that comment counts as done on resume.

## Steps

1. **Read the spec and every ticket.** Build the task graph and compute the frontier. **Resuming**
   (the integration branch already exists, some tickets are done): skip done tickets; for an
   `in-progress` ticket, inspect its branch and either continue it or restart it from the
   integration tip. Re-running `/implement` is the resume story; there is no other state file.

2. **(Optional) Explore once, up front.** If the tickets need codebase or documentation research,
   run one exploration subagent first and have it save markdown notes to
   `.scratch/<feature-slug>/notes/`, so implementers build instead of re-exploring.

3. **Create the integration branch** (`feature/<feature-slug>`) from the current base, unless it
   already exists.

4. **One implementer per frontier ticket.** For each frontier ticket, in parallel and in the
   background where the harness allows:
   - Give it its own worktree on its own branch (`<feature-slug>/<NN>`) based on the integration
     branch tip: the harness's per-agent worktree isolation where it has one, otherwise
     `git worktree add` (see the `using-git-worktrees` skill).
   - Dispatch the `implementer` agent (Claude Code: `subagent_type` `keystone:implementer`) with a
     fresh context and **context pointers, not pasted content**: the absolute paths of the
     ticket, the spec, and the notes (worktrees don't see untracked `.scratch/` files, so
     absolute paths into this checkout), plus the worktree path and its base branch.
   - Its instructions: confirm the worktree is based on the integration branch (reset onto it if
     not); **write a failing test first** for each behavior, at the seam the spec agreed; commit
     to its ticket branch; merge the integration branch tip into its branch before reporting
     `DONE`.
   - Mark the ticket `in-progress`.

5. **Merge as each lands.** When an implementer reports:
   - **DONE / DONE_WITH_CONCERNS**: merge its branch into the integration branch, run the test
     suite there, mark the ticket done, and note any concern for the final review. A merge
     conflict goes through the `resolving-merge-conflicts` skill.
   - **NEEDS_CONTEXT**: answer from the spec if it settles the question; otherwise ask the user,
     then re-dispatch with the answer.
   - **BLOCKED**: stop that ticket and tell the user why. Three failed fixes is an architecture
     question for the user, not a fourth attempt.

   If the frontier grew, dispatch implementers for the new tickets right away.

6. **One final review.** Once every ticket is done, dispatch the `code-reviewer` agent once on the
   integration branch's diff against its base (`git diff <base>...feature/<feature-slug>`), with
   the spec path as the requirement source. Add the `security-reviewer` agent when the spec's
   security questions flagged auth, money, personal data, or an LLM/agent surface. Fix every
   blocker and should-fix in **one** fresh implementer on the integration branch, then re-run the
   suite.

7. **Resolve and report.** Close the tickets the way the tracker closes work (local: they're
   already `done`). Report the integration branch, the tickets and their evidence, the review
   verdict, and anything deferred. Offer the `finishing-a-development-branch` skill or `/ship`
   for the merge/PR decision.

8. **Clean up** every implementer worktree and merged ticket branch you created.

## No subagents available

Work the same graph in this session, **one ticket at a time in frontier order**: branch from the
integration tip, write a failing test first, implement, commit, merge back, mark done, recompute
the frontier. For the final review, do one clean pass yourself using the `code-reviewer` agent's
checklist (`agents/code-reviewer.md`) against the whole integration diff. Stopping midway is
safe: re-running `/implement` picks up from the frontier.
