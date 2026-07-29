# Handling feedback by source

## Source-Specific Handling

### From the user

- **Trusted** - implement after understanding
- **Still ask** if scope unclear
- **No performative agreement**
- **Skip to action** or technical acknowledgment

### From External Reviewers

```
BEFORE implementing:
  1. Check: Technically correct for THIS codebase?
  2. Check: Breaks existing functionality?
  3. Check: Reason for current implementation?
  4. Check: Works on all platforms/versions?
  5. Check: Does reviewer understand full context?

IF suggestion seems wrong:
  Push back with technical reasoning

IF can't easily verify:
  Say so: "I can't verify this without [X]. Should I [investigate/ask/proceed]?"

IF conflicts with the user's prior decisions:
  Stop and discuss with the user first
```

**The user's rule:** "External feedback - be skeptical, but check carefully"

## Reading keystone's Reviewer Output

Feedback arrives in a few known shapes depending on who produced it — read the shape before you
triage:

- **Riley (`code-reviewer` / `/review`)** — findings grouped **blocker / should-fix / nit**, each
  with a `file:line` and a suggested fix. No confidence field: severity alone doesn't tell you
  whether the finding is demonstrated or theorized — verify it yourself before treating it as
  confirmed.
- **Quinn (`qa` gate)** — a graded verdict (**PASS / CONCERNS / FAIL / WAIVED**) plus per-issue
  `file:line`, severity, the finding, and a suggested action. A **FAIL** item is a must-fix by
  definition; a **CONCERNS** item is the orchestrator's call to accept or loop — you don't get to
  unilaterally drop it, but you can make the case with verification.
- **Sage (`security-reviewer` / `/cso`)** — findings grouped **critical / high / medium / low**,
  each carrying an explicit **confidence: confirmed / suspected**, and, for confirmed findings,
  the traced source→sink path and concrete exploit. Sage already defaults to skepticism about her
  own findings — a `suspected` label means she tried and couldn't build the exploit, not that she
  didn't look.
- **The user, inline** — no severity system at all. Treat every item per Handling
  Unclear Feedback above, not as a pre-triaged queue.

When a finding doesn't carry an explicit confidence label (Riley's and Quinn's formats don't by
default), treat it as **suspected until you verify it** — the absence of "confirmed" isn't a
signal the finding is weak, it just means the verification step is still yours to do.

If the orchestrator re-dispatches you with a reviewer's findings after a FAIL/CONCERNS loop, the
findings arrive **verbatim** (that's the contract on the orchestrator's side) — the triage below
applies to that batch exactly as it would to a first pass.

## GitHub Thread Replies

When replying to inline review comments on GitHub, reply in the comment thread (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`), not as a top-level PR comment.
