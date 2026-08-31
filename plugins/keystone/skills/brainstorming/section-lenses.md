# Section Lenses

A draft-time refinement pass: when you draft a design section, reach for the analytical lenses
that fit its **type** before asking for approval. Apply them in prose, iterate, then move on —
no numbered menu, no stored state. Reach for the 1–2 that fit; don't run all of them.

Six of these are the same lenses as `/plan-eng-review` (reused verbatim). Three are
section-type additions, marked _added_ — they are **not** part of the reused six. A separate
block of **divergent** lenses sits at the end, for when you need to _generate_ options rather
than judge one.

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

## Divergent lenses (generative, not evaluative)

Everything above judges a draft that already exists. These make drafts. Reach for them when you
owe someone genuinely _different_ options — `/office-hours` asks for three approaches that aren't
one idea with variations — and the second and third keep coming out as reskins of the first. Pick
the 2–3 that bite; running all eight produces volume, not range.

- **Inversion** — what if the opposite were true? Invert the core assumption (users won't do the work → the system does it for them) and see what design falls out.
- **Constraint removal** — which single constraint, if lifted, changes the _shape_ of the answer rather than its size? Name it, drop it, redesign. Then decide whether the constraint was real.
- **Audience shift** — who else could this be for? Re-aim it at a different user (an operator instead of an end user, a machine instead of a person) and note what has to change.
- **Combination** — what two existing things does this sit between? The interesting version is often the seam: one thing's interface over another thing's engine.
- **Simplification** — what's the 10×-simpler version, and what does it give up? State the sacrifice explicitly; sometimes the sacrifice turns out to be affordable.
- **The 10× version** — what would this look like an order of magnitude bigger (more users, more data, more scope)? The parts that break first are usually the parts that matter now.
- **Expert lens** — how would a specialist in an adjacent field frame this? Ask what a security engineer, an economist, or a librarian would call the problem — the renaming often relocates it.
- **Analogous inspiration** — where has this problem been solved somewhere else? **Structural test:** the analogy has to share a _mechanism_, not just vocabulary. "Like a marketplace" is a surface match; "two-sided, so the cold-start problem is on the supply side" is a mechanism you can borrow. Discard analogies that fail the test — they smuggle in assumptions that don't hold.

Generate divergently, then hand the survivors to the evaluative lenses above. Doing both at once
tends to kill the odd ideas before they're legible.
