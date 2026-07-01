---
name: investigate
description: Root-cause a bug, test failure, or unexpected behavior before proposing any fix. Thin entry point into keystone's systematic-debugging skill.
argument-hint: "[the bug / failure / symptom]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# Investigate — root cause before fix

You are investigating: **$ARGUMENTS**

This command is a deliberate entry point into the **`systematic-debugging`** skill —
invoke and follow it. It is keystone's single debugging discipline — every debug helper is
de-duped into this one entry point.

## Iron law

**No fix until the root cause is identified and confirmed.** Resist the urge to patch
the symptom. Reproduce → form a hypothesis → instrument/test the hypothesis → confirm the
actual cause → only then fix → then verify the fix and add a regression guard.

Once the cause is confirmed and you're moving to a fix, the `test-driven-development` and
`verification-before-completion` skills carry it home.
