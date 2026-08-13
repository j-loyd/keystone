---
name: systematic-debugging
description: Find the root cause before proposing a fix. Use when a test fails, a bug is reported, a working feature is suddenly slower or broken, or behavior surprises you — and when the user says "why is this happening", "the test is flaky", "it works locally", or "/investigate". Phase-gated — reproduce and predict before changing any code.
---

# Systematic Debugging

## Why this order

A fix applied before the cause is understood is a guess wearing a fix's clothing. It sometimes
works, and when it does you learn nothing and inherit a change you can't explain. When it
doesn't, you've added a variable to a system you were already confused by.

**The one rule worth holding firm:** understand the cause before changing code. Everything else
below is technique, applied with judgment.

The pull toward guessing is strongest exactly where it's most expensive — under time pressure,
on a production fire, when the fix "looks obvious," and after two failed attempts have made you
want the problem gone. Those are the moments to slow down, not speed up.

## The four phases

Work them in order. Later phases assume the earlier ones produced something real — a hypothesis
without a reproduction is a hunch, and Phase 3 will happily "confirm" it.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Don't skip past errors or warnings
   - They often contain the exact solution
   - Read stack traces completely
   - Note line numbers, file paths, error codes

2. **Reproduce Consistently**
   - Can you trigger it reliably?
   - What are the exact steps?
   - Does it happen every time?
   - If not reproducible → gather more data, don't guess

3. **Check Recent Changes**
   - What changed that could cause this?
   - Git diff, recent commits
   - New dependencies, config changes
   - Environmental differences

4. **Gather Evidence in Multi-Component Systems**

   **WHEN system has multiple components (CI → build → signing, API → service → database):**

   **BEFORE proposing fixes, add diagnostic instrumentation:**

   ```
   For EACH component boundary:
     - Log what data enters component
     - Log what data exits component
     - Verify environment/config propagation
     - Check state at each layer

   Run once to gather evidence showing WHERE it breaks
   THEN analyze evidence to identify failing component
   THEN investigate that specific component
   ```

   **Example (multi-layer system):**

   ```bash
   # Layer 1: Workflow
   echo "=== Secrets available in workflow: ==="
   echo "IDENTITY: ${IDENTITY:+SET}${IDENTITY:-UNSET}"

   # Layer 2: Build script
   echo "=== Env vars in build script: ==="
   env | grep IDENTITY || echo "IDENTITY not in environment"

   # Layer 3: Signing script
   echo "=== Keychain state: ==="
   security list-keychains
   security find-identity -v

   # Layer 4: Actual signing
   codesign --sign "$IDENTITY" --verbose=4 "$APP"
   ```

   **This reveals:** Which layer fails (secrets → workflow ✓, workflow → build ✗)

5. **Trace Data Flow**

   **WHEN error is deep in call stack:**

   See `root-cause-tracing.md` in this directory for the complete backward tracing technique.

   **Quick version:**
   - Where does bad value originate?
   - What called this with bad value?
   - Keep tracing up until you find the source
   - Fix at source, not at symptom

### Phase 2: Pattern Analysis

**Find the pattern before fixing:**

1. **Find Working Examples**
   - Locate similar working code in same codebase
   - What works that's similar to what's broken?

2. **Compare Against References**
   - If implementing pattern, read reference implementation COMPLETELY
   - Don't skim - read every line
   - Understand the pattern fully before applying

3. **Identify Differences**
   - What's different between working and broken?
   - List every difference, however small
   - Don't assume "that can't matter"

4. **Understand Dependencies**
   - What other components does this need?
   - What settings, config, environment?
   - What assumptions does it make?

### Phase 3: Hypothesis and Testing

**Scientific method:**

1. **Enumerate causes before committing to one (fault tree)**
   - List ALL plausible causes for the symptom, not just the first that comes to mind. Note where they combine (this AND that) vs. compete (this OR that).
   - **Check boring causes first.** Typo, stale cache, not rebuilt, wrong file/branch, env var unset, looking at the wrong environment. Occam's razor: the dull explanation is usually right — rule it out before reaching for an exotic theory.
   - This prevents tunnel vision on hypothesis #1 while the real cause sits unexamined in the list.

2. **Form a single hypothesis — with a prediction**
   - State clearly: "I think X is the root cause because Y."
   - **Write the falsifiable prediction BEFORE you test:** "If X is the cause, then when I do Z I will observe W (and if I instead see V, X is wrong)."
   - A test with no prediction can't teach you anything — you'll rationalize whatever you see. The prediction is what makes the result signal instead of noise.

3. **Test Minimally**
   - Make the SMALLEST possible change to test the hypothesis
   - One variable at a time
   - Don't fix multiple things at once

4. **Verify Before Continuing**
   - Compare the result to your prediction. Matched → likely root cause, go to Phase 4.
   - Didn't match → the hypothesis is wrong (not "needs another patch"). Return to the fault tree and pick the next candidate.
   - DON'T add more fixes on top of an unconfirmed hypothesis.

5. **Watch your biases**
   - **Confirmation bias** — you'll over-weight evidence that fits your hypothesis. Actively look for what would _disprove_ it.
   - **Anchoring** — the first theory isn't privileged; revisit the fault tree.
   - **Sunk cost** — time already spent on a wrong theory is gone; abandon it.
   - **Meta-debugging trap** — debugging your _own_ recent code, you anchor on what you _meant_ to write, not what's actually there. Read the real behavior as if a stranger wrote it.

6. **When You Don't Know**
   - Say "I don't understand X"
   - Don't pretend to know
   - Ask for help
   - Research more

### Phase 4: Implementation

**Fix the root cause, not the symptom:**

1. **Create Failing Test Case**
   - Simplest possible reproduction
   - Automated test if possible
   - One-off test script if no framework
   - MUST have before fixing
   - Use the `test-driven-development` skill for writing proper failing tests

2. **Implement Single Fix**
   - Address the root cause identified
   - ONE change at a time
   - No "while I'm here" improvements
   - No bundled refactoring

3. **Verify Fix**
   - Test passes now?
   - No other tests broken?
   - Issue actually resolved?

4. **If the fix doesn't work**
   - Count the attempts. Under three: return to Phase 1 and re-analyze with what the failure
     just taught you.
   - **At three or more, stop fixing and question the architecture** (step 5). A fourth attempt
     at the same layer is rarely where the answer is — the failure count is itself evidence.

5. **If 3+ Fixes Failed: Question Architecture**

   **Pattern indicating architectural problem:**
   - Each fix reveals new shared state/coupling/problem in different place
   - Fixes require "massive refactoring" to implement
   - Each fix creates new symptoms elsewhere

   **STOP and question fundamentals:**
   - Is this pattern fundamentally sound?
   - Are we "sticking with it through sheer inertia"?
   - Should we refactor architecture vs. continue fixing symptoms?

   **Raise it with the user before attempting more fixes** — this is a design decision, not
   a debugging one.

   This is NOT a failed hypothesis - this is a wrong architecture.

## Signals you've drifted back to guessing

The tell is always the same: a proposed change that doesn't trace to observed evidence. It shows
up as "it's probably X, let me fix that," as several changes bundled into one run so you can't
tell which mattered, as a list of fixes offered before any data flow was traced, or as adapting
a reference pattern you only skimmed.

The user has tells too. "Stop guessing," "is that not happening?", "will it show us...?", and a
frustrated "we're stuck?" all mean the same thing — go back and get evidence.

Either way the move is the same: return to Phase 1 and find what you skipped.

## Quick Reference

| Phase                 | Key Activities                                         | Success Criteria            |
| --------------------- | ------------------------------------------------------ | --------------------------- |
| **1. Root Cause**     | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY     |
| **2. Pattern**        | Find working examples, compare                         | Identify differences        |
| **3. Hypothesis**     | Form theory, test minimally                            | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify                               | Bug resolved, tests pass    |

## When Process Reveals "No Root Cause"

If systematic investigation reveals issue is truly environmental, timing-dependent, or external:

1. You've completed the process
2. Document what you investigated
3. Implement appropriate handling (retry, timeout, error message)
4. Add monitoring/logging for future investigation

**But:** treat "no root cause" as the rare verdict it is. Most of the time it means the
investigation stopped early, not that the system is genuinely nondeterministic.

## Supporting Techniques

These techniques are part of systematic debugging and available in this directory:

- **`root-cause-tracing.md`** - Trace bugs backward through call stack to find original trigger
- **`defense-in-depth.md`** - Add validation at multiple layers after finding root cause
- **`condition-based-waiting.md`** - Replace arbitrary timeouts with condition polling
- Under rationalization pressure (production fire, sunk cost, authority), see `./pressure-tests.md` — the methodology holds exactly when it's least convenient.

**Related skills:**

- **test-driven-development** - For creating failing test case (Phase 4, Step 1)
- **verification-before-completion** - Verify fix worked before claiming success

## Why it's worth the patience

The cost of this process is front-loaded and visible; the cost of skipping it is back-loaded and
diffuse — rework, a fix nobody can explain, a second bug introduced by the first patch. That
asymmetry is why the discipline feels slower in the moment and lands faster over the session.
