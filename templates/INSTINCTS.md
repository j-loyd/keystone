# Active Instincts

Atomic, triggered rules that the SessionStart hook (`~/.claude/hooks/instincts.js`)
surfaces into every session as "⚡ Active rules". This is the auto-apply layer —
unlike MEMORY.md (a passive index), these are imperative directives meant to FIRE.

## Format

Each instinct is one block:

    ## [<confidence%>] <trigger — "when ..." >
    <one imperative action. start with a verb. keep it to 1–2 lines.>

- Confidence: 30–100. The hook only injects instincts at or above the threshold
  (default 70; override with `INSTINCTS_MIN_CONFIDENCE`). Lower a rule's number
  to mute it without deleting it.
- Keep each action atomic: one trigger, one behavior. Split compound rules.
- Order doesn't matter — the hook ranks by confidence and caps the count.

---

## Examples — replace these with your own

The blocks below just demonstrate the format. They're seeded from common recurring
corrections (a no-auto-commit habit, a "check current docs" habit) — swap them out for
the instincts _you've_ actually had to repeat to yourself or a teammate. An instinct
worth keeping here is one you'd otherwise re-explain every few sessions.

## [90%] when work is finished in a git repo

Do NOT create git commits or push. Staging is fine; committing/pushing only when the
user explicitly asks.

## [80%] when the user asks about a library, framework, SDK, API, CLI tool, or cloud service

Fetch current docs before answering — don't rely on training data alone, even for
well-known tools, since APIs and best practices shift between versions.

## [85%] when about to make a structural change directly against a production environment

Stop and get per-action approval first, or prefer a cloned/staging environment for the
change instead of editing production directly.
