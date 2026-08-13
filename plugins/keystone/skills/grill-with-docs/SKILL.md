---
name: grill-with-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
---

<what-to-do>

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Before the first question, state your read of the plan in one sentence with a confidence number — and below ~70%, name the missing pieces on the same line (`CONFIDENCE: ~40% — missing: which context owns this, what "settlement" means here`). Update the number as answers land; it's there to keep you honest about how settled the understanding actually is.

Ask the questions one at a time, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead.

</what-to-do>

<supporting-info>

## Domain awareness

During codebase exploration, also look for existing documentation:

### File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

### The onboarding map, if one exists

If `onboard-codebase` has already run, `docs/codebase/INDEX.md` plus its sibling docs
(`ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`, `TESTING.md`,
`CONCERNS.md`) hold a **structural** snapshot — where things live, established patterns, known
risk areas. Read it before exploring from scratch; it's a shortcut, not a source of truth.
Check `INDEX.md`'s `Built at: <sha>` against `HEAD` — if the repo has moved far past that SHA,
treat the map as directional and verify anything load-bearing against the live code.

The map documents **structure**; `CONTEXT.md` documents **vocabulary**. Keep the two separate —
a term earns a place in `CONTEXT.md` because it's part of the domain language, not because
`docs/codebase/ARCHITECTURE.md` happens to mention it.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Precedence when sources disagree

Code, ADRs, and `CONTEXT.md` will drift out of sync. When they conflict, don't silently pick one — surface the conflict, then resolve it by what each source is _authoritative for_:

- **Running code is ground truth for what the system actually does** (the present tense). If the code and a doc disagree about behavior, the code wins on _what is_ — but ask whether the code is the bug or the doc is stale.
- **ADRs win on _why_** a decision was made. Code shows the result; the ADR holds the rationale and the alternatives rejected. Don't infer intent from code when an ADR records it.
- **`CONTEXT.md` wins on what a term _means_.** It's the canonical glossary; if code uses a term loosely, fix the usage, not the definition.
- **`docs/codebase/`'s map is a snapshot, never authoritative.** It was true at the SHA it was
  built from — it doesn't get a vote when it conflicts with code, an ADR, or `CONTEXT.md`. If
  the map disagrees with one of the other three, the map is stale; that's a signal to re-run
  `onboard-codebase`, not to resolve the conflict in the map's favor.

After resolving, **update the losing doc** (or open an ADR if the conflict reveals an undocumented decision) so the next reader doesn't hit the same contradiction.

**Worked example.** The user says "cancelling an order refunds it automatically." `CONTEXT.md`
defines Cancellation as "marking an Order void before fulfillment," with no mention of refunds.
The code's `cancelOrder()` does call `issueRefund()`. Three sources, one conflict: the user's
mental model bundles two operations the glossary treats as separate, and the code already
agrees with the user. Ask which is intended — if refund-on-cancel is real, deliberate behavior,
the fix is `CONTEXT.md` (either fold the refund into Cancellation's definition, or keep
Cancellation and Refund distinct and add a one-line relationship note). Update `CONTEXT.md` in
the same turn, not as a follow-up.

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Apply the three-part test in [ADR-FORMAT.md](./ADR-FORMAT.md#when-to-offer-an-adr) — hard to
reverse, surprising without context, the result of a real trade-off. If any of the three is
missing, skip the ADR; don't write one just to be thorough. When you do write one, check
whether the target repo already has an ADR convention (`docs/adr/0000-template.md`, a
`template.md`, a handful of existing ADRs with a consistent shape) and match it —
[ADR-FORMAT.md](./ADR-FORMAT.md) is the fallback shape for repos that don't have one yet.

### Knowing when the understanding is shared

Make the endpoint checkable: you're there when you can predict the user's answer to the next three questions you'd ask. Several rounds without that means something foundational is missing — say so and step back rather than grinding through more branches.

Then confirm it explicitly. "Whatever you think is best" is delegation, not agreement — re-ask it as a choice between two concrete options. "Sounds good" and silence aren't agreement either. Restate what you now believe the plan is, in the project's own terms, and loop until you get an explicit yes.

</supporting-info>
