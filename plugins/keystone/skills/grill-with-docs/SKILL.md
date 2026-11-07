---
name: grill-with-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates the docs (GLOSSARY.md, ADRs) inline as decisions crystallise. Use when the user wants to stress-test a plan against their project's language and documented decisions.
---

# Grill with docs

Run two skills together: **`grilling`** drives the interview (rounds over the design tree's
frontier, a recommended answer per question), and **`domain-modeling`** keeps the glossary and
ADRs current while it runs (Claude Code: the Skill tool with `keystone:grilling` and
`keystone:domain-modeling`; elsewhere, read their `SKILL.md` files). Follow both. This skill adds
only what keystone needs on top: where to ground the interview, which source wins when they
disagree, and when the session is actually done.

## Ground the interview before the first round

Read what the repo already says, so questions target real gaps instead of re-deriving the
codebase:

- **`GLOSSARY.md`** (or `GLOSSARY-MAP.md` and the per-context glossaries) and **`docs/adr/`** in
  the area the plan touches. If only a legacy `CONTEXT.md` exists, treat it as the glossary and
  offer `git mv CONTEXT.md GLOSSARY.md`.
- **The onboarding map, if `onboard-codebase` has run.** `docs/codebase/INDEX.md` plus its sibling
  docs (`STACK.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`,
  `TESTING.md`, `CONCERNS.md`) hold a **structural** snapshot: where things live, established
  patterns, known risk areas. Read it before exploring from scratch; it's a shortcut, not a source
  of truth. Check `INDEX.md`'s `Built at: <sha>` against `HEAD`; if the repo has moved far past
  that SHA, treat the map as directional and verify anything load-bearing against the live code.

The map documents **structure**; `GLOSSARY.md` documents **vocabulary**. Keep the two separate: a
term earns a place in `GLOSSARY.md` because it's part of the domain language, not because
`docs/codebase/ARCHITECTURE.md` happens to mention it.

## Precedence when sources disagree

Code, ADRs, and `GLOSSARY.md` drift out of sync. When they conflict, don't silently pick one:
surface the conflict, then resolve it by what each source is _authoritative for_.

- **Running code is ground truth for what the system actually does** (the present tense). If the
  code and a doc disagree about behavior, the code wins on _what is_, but ask whether the code is
  the bug or the doc is stale.
- **ADRs win on _why_** a decision was made. Code shows the result; the ADR holds the rationale and
  the alternatives rejected. Don't infer intent from code when an ADR records it.
- **`GLOSSARY.md` wins on what a term _means_.** It's the canonical glossary; if code uses a term
  loosely, fix the usage, not the definition.
- **`docs/codebase/`'s map is a snapshot, never authoritative.** It was true at the SHA it was
  built from and doesn't get a vote when it conflicts with code, an ADR, or `GLOSSARY.md`. If the
  map disagrees with one of the other three, the map is stale; that's a signal to re-run
  `onboard-codebase`, not to resolve the conflict in the map's favor.

After resolving, **update the losing doc** (or open an ADR if the conflict reveals an undocumented
decision) so the next reader doesn't hit the same contradiction.

**Worked example.** The user says "cancelling an order refunds it automatically." `GLOSSARY.md`
defines Cancellation as "marking an Order void before fulfillment," with no mention of refunds.
The code's `cancelOrder()` does call `issueRefund()`. Three sources, one conflict: the user's
mental model bundles two operations the glossary treats as separate, and the code already agrees
with the user. Ask which is intended. If refund-on-cancel is real, deliberate behavior, the fix is
`GLOSSARY.md` (either fold the refund into Cancellation's definition, or keep Cancellation and
Refund distinct and add a one-line relationship note). Update `GLOSSARY.md` in the same turn, not
as a follow-up.

## Knowing when the understanding is shared

Make the endpoint checkable: you're there when you can predict the user's answer to the next three
questions you'd ask. Several rounds without that means something foundational is missing; say so
and step back rather than grinding through more branches.

Then confirm it explicitly. "Whatever you think is best" is delegation, not agreement: re-ask it as
a choice between two concrete options. "Sounds good" and silence aren't agreement either. Restate
what you now believe the plan is, in the project's own terms, and loop until you get an explicit
yes.
