# Pressure Tests

These are NOT usage docs. They're a self-check: the methodology only earns its keep if it
survives the exact moments you're most tempted to abandon it. Each scenario names the
**pressure**, the **rationalization** it invites, and the **disciplined response** the skill
still demands.

## 1. Production Emergency

**Pressure:** The site's down. It's costing $X/minute. Someone is standing over your shoulder
saying "just patch it, fix it now."

**Rationalization:** "No time for root cause — ship a guess, we'll investigate later."

**Disciplined response:** A 5-minute reproduction still beats a wrong fix. A guess that masks
the real cause resets the clock to zero: the symptom returns, you're back where you started
having burned the time AND added a misleading change to dig through. The fastest path out of
the fire is the smallest reliable reproduction, not the first plausible patch. Speed comes from
hitting the right cause once, not from skipping Phase 1.

## 2. Sunk Cost + Exhaustion

**Pressure:** Hours into the hunt. Three, four, five fixes attempted, none worked. You're tired
and you've invested too much to walk away.

**Rationalization:** "I'm close — just one more variation on the same idea and it'll catch."

**Disciplined response:** 3+ failed fixes is not bad luck, it's a signal: the hypothesis is
wrong, or the architecture is. Stop. The time already spent is gone whether you continue or not
— it buys nothing. Return to the top and re-root-cause with fresh eyes, or question whether the
pattern itself is sound. More variations on a dead hypothesis only deepen the hole.

## 3. Authority / Social Pressure

**Pressure:** A senior engineer says "it's obviously X, just go do it." They're confident,
they're senior, and pushing back feels presumptuous.

**Rationalization:** "They know the system better than me — accept X as the cause and fix it."

**Disciplined response:** Predict-before-test still applies, regardless of who named the
hypothesis. Verify that X actually reproduces the symptom before you "fix" it. Authority is not
evidence. If X is the cause, confirming it costs minutes; if it isn't, you've saved yourself
from shipping a fix to the wrong problem and then explaining why the bug persists.

---

The skill is only worth anything if it holds when it's least convenient.
