---
name: variant-analysis
description: After finding one bug or vulnerability, systematically find every other instance of the same pattern across the codebase. Use immediately after any bug fix, security finding, or code-review issue — before closing it out — and when asked to "find similar issues", "check if this happens elsewhere", or harden against a class of bug.
---

# Variant Analysis

One bug is rarely alone. The same mistake was probably made elsewhere — by the same author,
copy-pasted, or from a shared misunderstanding. **A fix isn't done until you've hunted the
variants.** (Methodology inspired by Trail of Bits' `variant-analysis`; written original.)

## When to run

Right after: a bug fix, a security finding (from `security-review`/`api-security`/
`llm-security`/`/cso`), a failing-test root cause, or a code-review issue. Before you mark
it resolved.

## Method

1. **Abstract the pattern.** Generalize the specific bug into its essence: not "line 42
   forgot `ownerId`," but "**object reads that don't scope to the caller**." Name the root
   cause (missing check, wrong API, unsafe sink, bad default).
2. **Pick search strategies — use several, they catch different instances:**
   - **By API/sink:** grep the dangerous call/pattern (`.findUnique(`, `dangerouslySetInnerHTML`,
     `exec(`, `fetch(` with a user var, `select('*')`, raw SQL template literals).
   - **By the missing control:** find call sites of the safe helper and look for places that
     _should_ use it but don't (the absence is the bug).
   - **By author/commit:** `git log --author` / `git blame` around the fix — the same person/PR
     likely repeated it; check sibling files from the same change.
   - **By structure:** copy-paste siblings (same handler shape across routes/resolvers).
   - Escalate to AST/semantic search or a Semgrep rule (see "Make it permanent") when grep
     is too noisy or too coarse.
3. **Triage each hit** — confirmed variant, false positive, or needs-investigation. Apply
   the same fix (or the safe helper) to the real ones.
4. **Report** the full set: the pattern, where you searched, every instance found + its
   status, and any you couldn't fully verify. Don't silently cap the search — say what you
   didn't cover.

## Make it permanent

If the pattern is recurring and grep-detectable, propose a **Semgrep rule** (or a lint
rule / a test) so the variant can't reappear — turn the one-off hunt into a standing guard.
The Trail of Bits **`semgrep-rule-creator`** skill (install separately — see the keystone
README) is the tool for authoring the rule. For a security pattern, also capture it as a
`/learn` entry for this repo.

## Pitfalls

- Don't fix only the reported instance and move on — that's how the same CVE ships twice.
- Don't trust a single search strategy; grep misses renamed/wrapped variants.
- A widely-repeated variant raises the original's severity (bigger blast radius).
