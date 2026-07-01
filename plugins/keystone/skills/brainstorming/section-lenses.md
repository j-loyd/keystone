# Section Lenses

A draft-time refinement pass: when you draft a design section, reach for the analytical lenses
that fit its **type** before asking for approval. Apply them in prose, iterate, then move on —
no numbered menu, no stored state. Reach for the 1–2 that fit; don't run all of them.

Six of these are the same lenses as `/plan-eng-review` (reused verbatim). Three are
section-type additions, marked _added_ — they are **not** part of the reused six.

| Section type         | Reach for these lenses                                      | Failure mode it catches                                       |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| **Risk / Decision**  | Pre-mortem + Base-rate neglect + _adversarial pass (added)_ | optimistic framing; a decision that doesn't survive a skeptic |
| **Data / Schema**    | MECE + Constraint analysis + Reversibility test             | missing/overlapping cases; a migration you can't undo         |
| **API / Contract**   | Reversibility test + Constraint analysis                    | a one-way public surface locked in too early                  |
| **Architecture**     | Reversibility test + Curse of knowledge                     | irreversible structure; implicit context the reader lacks     |
| **Scope / Audience** | Base-rate neglect + _audience scope calibration (added)_    | scope creep; pitched at the wrong reader                      |
| **Design-judgment**  | Pre-mortem + _identify-risks (added)_                       | a judgment call whose downside was never named                |

## The reused six (from `/plan-eng-review` — names identical)

- **Pre-mortem** — assume it shipped and failed badly. What's the most likely cause? Plan against that now.
- **MECE** — are the pieces mutually exclusive and collectively exhaustive? Look for gaps (unhandled case) and overlaps (two tasks owning the same thing).
- **Constraint analysis** — what's the _real_ binding constraint (a dependency, a rate limit, a data shape)? Optimizing anything else is wasted motion.
- **Reversibility test** — is this a one-way door (hard to undo: schema migration, public API, data deletion) or two-way? Spend rigor in proportion; don't over-deliberate reversible calls.
- **Curse of knowledge** — what does the implementer (or future reader) not know that you do? Name the implicit context the plan assumes.
- **Base-rate neglect** — what usually happens with work like this? If migrations like this normally take 3× and break X, weight that over inside-view optimism.

## The three additions (section-type specific)

- **Adversarial pass** _(added)_ — argue the opposite of the decision as hard as you can. If it survives, it's sound; if not, you found the hole before shipping.
- **Audience scope calibration** _(added)_ — who reads this, and what do they need vs. what's here? Cut or expand to fit the actual reader.
- **Identify-risks** _(added)_ — name the concrete downside of this judgment call explicitly, so it's a chosen risk, not an unseen one.

This is a draft-time prose pass — reach for the lenses that fit the section, iterate, then ask
for approval. No numbered menu, no stored state.
