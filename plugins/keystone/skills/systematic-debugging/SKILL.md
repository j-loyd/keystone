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

**Standing rule for the whole investigation — tag every probe you add.** Pick one marker for
the run (`[DEBUG-a4f2]`; a random suffix is fine) and prefix every log, print, or temporary
assertion the investigation adds with it. Removing them later is then a single grep rather
than an archaeology exercise over the diff working out which lines were yours: untagged logs
survive, tagged logs die. The Phase 4 checklist greps for this marker.

1. **Read Error Messages Carefully**
   - Don't skip past errors or warnings
   - They often contain the exact solution
   - Read stack traces completely
   - Note line numbers, file paths, error codes

2. **Reproduce Consistently**
   - Can you trigger it reliably?
   - What are the exact steps?
   - Does it happen every time?
   - If not reproducible → don't guess your way forward. Work the branches under _When it
     won't reproduce_ below.

   **Building the red signal**

   A reproduction is worth more when it's a _command_ — something you can run on demand that
   goes red on this bug and green once it's fixed. These are the options, not a ranking — pick
   whichever is cheapest to build and most deterministic for the bug in front of you:

   1. A failing test at a seam that genuinely reaches the bug — any level will do for a first
      reproduction; Phase 4 revisits the choice for the regression test.
   2. A scripted call against a running instance (an HTTP request, a queue publish, an RPC).
   3. A CLI invocation over a fixture input, diffing the output against a known-good snapshot.
   4. A headless browser script that drives the UI and asserts on what it renders, when the
      symptom is UI-side.
   5. Replay of a captured artifact — a saved request, payload, or event log pushed back
      through the code path in isolation.
   6. A throwaway harness: the smallest slice of the system that reaches the bug in one call,
      with the rest stubbed.

   Past that, the long tail: a property or fuzz loop when the symptom is "sometimes wrong"
   rather than "always wrong"; a differential run putting the same input through old vs. new
   and diffing; or a human-in-the-loop script that prompts for the one manual step and captures
   the result, when someone genuinely has to click.

   Then tighten what you built. A slow or flaky loop is barely better than none; a fast
   deterministic one is most of the win. Make it faster (skip unrelated setup, narrow the
   scope), sharper (assert the user's exact symptom, not "it didn't crash"), and more
   deterministic (pin the clock, seed the RNG, isolate the filesystem, cut the network).

   **When it won't reproduce**

   A reproduction is the load-bearing input to every later phase — Phase 3 can't test a
   hypothesis it can't trigger — so this is worth real effort before settling for less.

   **Aim at the reproduction _rate_, not at a clean reproduction.** That's the number the work
   below moves, and it turns a checklist into instruments with a target: a bug that fails half
   its runs is debuggable, one that fails a run in a hundred isn't. It also gives you a
   stopping condition you can measure — keep raising the rate until the loop is usable, then
   stop and go minimise, rather than working the list to its end for its own sake.

   Three things explain most intermittent failures, and there's a fallback for when none of
   them does. Work them in whatever order the symptom suggests.

   - **Timing.** Stamp the log lines and compare the ordering of a passing run against a
     failing one. Then try to _widen_ the window rather than narrow it: insert an artificial
     delay at the suspected interleaving point, run the case under concurrent load, or
     constrain CPU. A race that reproduces on demand once its window is wide is a race you've
     found. For the eventual fix, prefer waiting on the condition over waiting on a duration —
     see `condition-based-waiting.md`.
   - **Environment.** Diff where it fails against where it doesn't: runtime and dependency
     versions, environment variables and config, locale and timezone, resource limits, and the
     _shape_ of the data (size, nulls, encoding, cardinality) — not just its schema. Running
     the case in CI is often the cheapest way to get a hostile environment you don't control.
   - **State.** Ask whether the failure depends on what ran _before_ it. Leaked state between
     tests, module-level globals, singletons, connection pools, and caches all produce failures
     that vanish in isolation and appear in a suite. Run the failing case alone — if it passes,
     the bug is in the ordering, not the case. `find-polluter.sh` in this directory bisects a
     suite to find which test leaves the residue.
   - **Truly intermittent.** When none of those land, stop paying for a reproduction you may
     not get. Instrument instead: alert on the specific error signature, log enough context at
     the failure point to diagnose the _next_ occurrence, and write down the conditions you
     already ruled out. That turns an open-ended hunt into a wait with a trigger. This is the
     "no root cause" verdict at the end of this skill — a place you arrive after the branches
     above, not a shortcut past them.

3. **Minimise the Reproduction**

   A case that goes red is not yet a good one. Shrink it to the smallest scenario that still
   fails: cut one element at a time — an input field, a caller, a config flag, a row of data,
   a step in the sequence — and re-run after each cut, restoring anything whose removal turns
   it green.

   Done when **every remaining element is load-bearing** — removing any one of them makes it
   go green.

   This isn't tidiness. Every element you cut is a suspect struck off the list before Phase 3
   builds its fault tree, and it's what keeps that tree small enough to work through honestly
   instead of a sprawl you'll abandon after two branches. The minimised case is usually the
   right shape for the regression test in Phase 4 as well.

   Where the signal is nondeterministic, raise the reproduction rate before you start cutting.
   Against a loop that fails one run in a hundred you can't tell "that cut removed the cause"
   from "that run got lucky," so every cut is a coin flip you then record as evidence. Once
   the rate is high enough to read, minimise against the _rate_ rather than a single run: a
   cut that takes it to zero was load-bearing.

4. **Check Recent Changes**
   - What changed that could cause this?
   - Git diff, recent commits
   - New dependencies, config changes
   - Environmental differences
   - **"It worked before" with an unknown boundary → bisect.** Find a known-good revision and
     a known-bad one and let `git bisect` binary-search between them; `git bisect run <script>`
     automates it wherever the check can be expressed as a command that exits nonzero on the
     bug. A dozen builds hands you the exact commit, which beats reading a range of them. It
     needs a _reliable_ check, so it depends on the reproduction work in step 2 — bisecting on
     a flaky signal convicts an innocent commit.

5. **Gather Evidence in Multi-Component Systems**

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

6. **Trace Data Flow**

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
   - Start from the minimised reproduction (Phase 1, step 3) — that's already the smallest
     case that fails
   - Automated test if possible
   - One-off test script if no framework
   - MUST have before fixing
   - Use the `test-driven-development` skill for writing proper failing tests
   - **Pin it at a seam that exercises the real bug pattern.** A test placed too shallow —
     one caller where the bug needs several, a unit boundary that can't reproduce the chain
     that triggered it — goes green without proving anything, and that's worse than no test:
     it's false confidence someone will lean on later.
   - **If no correct seam exists, that itself is the finding** — don't settle for the shallow
     test. `test-driven-development`'s _Before RED — Agree the Seam_ owns this rule and the
     handoff to `improve-codebase-architecture`; it applies unchanged to regression tests.

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

6. **Before you call it done**

   Reached only once a fix has landed — step 5's verdict exits Phase 4 without one. Investigating
   leaves residue, and the fix landing is exactly when you stop noticing it. Check the list
   rather than trusting memory:

   - [ ] The original reproduction no longer reproduces — re-run the full case, not just the
         minimised one.
   - [ ] The regression test passes, or the absence of a correct seam is written down.
   - [ ] Every tagged debug line is gone. Grep the run marker; a hit means you missed one.
   - [ ] Throwaway harnesses and fixtures are deleted, or moved somewhere clearly marked as
         debug scaffolding.
   - [ ] The hypothesis that turned out to be right is recorded where the change gets explained
         (commit message, PR, issue), so the next person inherits the reasoning and not just the
         diff.

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
| **1. Root Cause**     | Read errors, reproduce, minimise, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern**        | Find working examples, compare                         | Identify differences        |
| **3. Hypothesis**     | Form theory, test minimally                            | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify, clean up                     | Bug resolved, tests pass    |

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
- **improve-codebase-architecture** - When no correct seam exists for the regression test

## Why it's worth the patience

The cost of this process is front-loaded and visible; the cost of skipping it is back-loaded and
diffuse — rework, a fix nobody can explain, a second bug introduced by the first patch. That
asymmetry is why the discipline feels slower in the moment and lands faster over the session.
