# Routing results back — statuses and cannot-verify items

What to do with each status an implementer returns, and how to resolve a reviewer's
"cannot verify from diff" item. Consulted when a dispatch comes back; the loop itself lives in
`SKILL.md`.

## Handling Implementer Status

Implementer subagents report one of four statuses. Handle each appropriately:

**DONE:** Before you advance it, confirm the report actually _shows_ its test rigor, not just
asserts it — **RED→GREEN evidence** (the failing-then-passing commands and output, when TDD was
required) and an explicitly **pristine run** (clean output, no unexpected warnings/errors/skips).
A DONE that only claims "tests pass" with no RED/GREEN and no pristine statement is unverified —
send it back for the evidence before it enters the gate (this is the *victory declaration*
failure mode: agents mark done without verifying unless the harness demands the evidence). Then run the gates this task's Risk tier names (see **Rigor Scales to Risk** in `SKILL.md`).

**DONE_WITH_CONCERNS:** The implementer completed the work but flagged doubts. Read the concerns before proceeding. If the concerns are about correctness or scope, address them before review. If they're observations (e.g., "this file is getting large"), note them and proceed to review.

**NEEDS_CONTEXT:** The implementer needs information that wasn't provided. Provide the missing context and re-dispatch. **If the stop is a request to confirm a destructive or irreversible action, that decision is the user's** — you cannot grant it on their behalf, and a relayed approval is not approval. Put the question to the user, record the answer as a **Locked decision** in the run-state, then re-dispatch with it in the packet.

**BLOCKED:** The implementer cannot complete the task. Assess the blocker:

1. If it's a context problem, provide more context and re-dispatch with the same model
2. If the task requires more reasoning, re-dispatch with a more capable model
3. If the task is too large, break it into smaller pieces
4. If the plan itself is wrong, escalate to the human

**Never** ignore an escalation or force the same model to retry without changes. If the implementer said it's stuck, something needs to change.

## Handling Reviewer ⚠️ Items

Riley may flag **"⚠️ Cannot verify from diff"** items — requirements that live in unchanged code
or span tasks, which the task's diff can't settle. These don't block the rest of the review, but
**you** must resolve each one before the task is marked done: you hold the plan and cross-task
context the reviewer lacks. Confirm the requirement yourself; if you find a real gap, treat it as
a failed review — loop it back to Mason (verbatim) and re-review. **Never let a ⚠️ pass silently
into "complete"** — an unresolved "cannot verify" is an open question, not an approval.
