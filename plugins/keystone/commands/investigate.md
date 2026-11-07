---
name: investigate
description: Root-cause a bug, test failure, or unexpected behavior before proposing any fix — reproduce, confirm the cause, then fix with a regression test. Escalates to an architecture question after three failed fixes.
argument-hint: "[the bug / failure / symptom]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# Investigate — root cause before fix

You are investigating: **$ARGUMENTS**

## Iron law

**No fix until the root cause is identified and confirmed.** Don't patch the symptom.

1. **Reproduce.** Get one command (a test, a script, a curl) that goes red on _this_ symptom.
   Without a reproduction, say so, list what you tried, and ask for access, a captured artifact,
   or permission to add instrumentation. Don't hypothesise without one.
2. **Hypothesise, then test it.** State what you expect to see if the hypothesis is right before
   you run the check, so the result can prove you wrong.
3. **Confirm the cause.** Explain the whole chain from trigger to symptom, not just the line
   that changed.
4. **Fix.** Write a regression test that fails against the current code, at a seam that
   exercises the real bug path, then make the smallest change that turns it green. One change
   at a time; **no "while I'm here" fixes** bundled in (note them instead).
5. **Verify.** The reproduction is green, the rest of the suite still passes, and the user's
   original symptom is gone.

## Redact

You'll show commands, outputs, and captured artifacts. **Redact every secret first**: write
`<REDACTED>` in its place. Build reproductions against env vars so the credential stays in the
environment, not in what you show. Captured artifacts (HAR files, logs) carry auth headers;
quote only the lines that carry the signal. If the redacted output isn't enough to diagnose,
say so and ask.

## Three failed fixes → question the architecture

Count the attempts. Under three, go back to step 2 with what the failure just taught you. **At
three or more, stop fixing.** Each fix revealing new coupling elsewhere, or needing a "massive
refactor", means the pattern itself is wrong, not the latest hypothesis. Raise it with the user
before trying again: it's a design decision now, not a debugging one.

## Bank the root cause

A confirmed root cause is a paid-for lesson. Draft it in `/learn`'s format (usually type
**Surprise** or **Lesson**, evidence = the reproduction) and offer to bank it. The next session
shouldn't have to re-discover this.
