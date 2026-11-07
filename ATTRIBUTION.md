# Attribution & Third-Party Notices

keystone consolidates and adapts work from several open-source projects. keystone itself is
released under the MIT License (see [`LICENSE`](LICENSE)). Portions copied or adapted from the
projects below remain under their original authors' copyright; their required license notices
are reproduced in full at the end of this file.

All upstream sources listed here are MIT-licensed, which permits copying, modification, and
redistribution provided the original copyright and permission notice are retained. Those
notices are preserved in the **[Third-party MIT license notices](#third-party-mit-license-notices)**
section below.

## Provenance by component

### Skills

| Component(s)                                                                                                                                                                                                                                                                                                       | Source                                                                  | License | Relationship                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verification-before-completion`, `using-git-worktrees`, `receiving-code-review`, `finishing-a-development-branch` (formerly also `brainstorming`, `systematic-debugging`, `test-driven-development`, `writing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`) | [obra/superpowers](https://github.com/obra/superpowers) — Jesse Vincent | MIT     | Copied from the installed skills. Several were then extended with original depth (`verification-before-completion` among the survivors). `executing-plans` and `requesting-code-review` were merged into the former `subagent-driven-development`; `receiving-code-review` remains close to upstream with only minor edits. **In 1.0**: `brainstorming`, `writing-plans`, and `subagent-driven-development` were removed, replaced by the `/spec` → `/to-tickets` → `/implement` pipeline adapted from mattpocock/skills (below); `writing-plans`' package-legitimacy gate moved, trimmed, into `skills/spec/checks.md`, and `brainstorming`'s domain probes were cut down to that file's security questions. `test-driven-development` and `systematic-debugging` were removed after an A/B showed no gain over no skill; their keystone-only parts live on — LLM/agent testing in `designing-agent-systems`, the crew-evidence rules and the 3-failed-fixes escalation in `agents/implementer.md`, and the escalation and no-while-I'm-here rules in `/investigate`. `dispatching-parallel-agents` was removed (its packet footer lives on as the "Running unattended" section of `agents/implementer.md`), and `using-git-worktrees` / `finishing-a-development-branch` were trimmed. |
| `resolving-merge-conflicts`, `writing-skills` (repo-local at `.claude/skills/writing-skills/` since 1.0; not shipped in the plugin) | [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock | MIT     | **Written original**, idea-only adaptation of upstream `resolving-merge-conflicts` and `writing-great-skills`. No upstream text copied; the resolve-by-intent / never-abort-as-escape framing and the predictability-and-branches lens are the borrowed ideas. (The idea-only `prototype` branch formerly inside `brainstorming` was removed with that skill in 1.0.)                                    |
| `grilling`, `domain-modeling`, `codebase-design` | [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock | MIT     | **Copied once in 1.0** from `skills/productivity/grilling`, `skills/engineering/domain-modeling`, and `skills/engineering/codebase-design` at commit `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`, including reference files and `agents/openai.yaml`. Keystone-maintained from then on (no sync). Edits: `domain-modeling` gained the legacy-`CONTEXT.md` fallback, the existing-ADR-template check, an ADR worked example, and glossary anti-patterns / sharpen-in-place (from keystone's former `grill-with-docs` format files); `codebase-design` gained the concrete shallow-module signals, the quick dependency classification, and the three-question design scoring (from keystone's former `improve-codebase-architecture` reference files). |
| `spec`, `to-tickets`, `implement`, `setup` | [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock | MIT     | **Adapted in 1.0** from upstream `to-spec`, `to-tickets`, `implement-spec`, and `setup-matt-pocock-skills` at commit `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`. `spec` keeps upstream's spec template and seam sketch, and adds keystone's interview-into-the-file step, the blind-spot pass, the "Integrate and be creative where possible; build where necessary" section, package-legitimacy and live-repo checks, security questions, and the over-engineering gut check. `implement` swaps upstream's `tdd` / `code-review` skill calls for "write a failing test first" and keystone's `code-reviewer` agent, and adds the no-subagent fallback and resume-from-frontier. `setup` defaults to the local `.scratch/` tracker; its GitHub/GitLab seed files and `domain.md` are trimmed from upstream's, and the Linear seed file is original. |
| `grill-with-docs`, `improve-codebase-architecture` (formerly also `zoom-out`) | [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock | MIT     | Originally copied from `skills/engineering`. **In 1.0** both became thin keystone skills over the copied skills above: `grill-with-docs` drives `grilling` + `domain-modeling` and keeps keystone's source-precedence rules, worked example, docs/codebase grounding, and explicit-yes gate; `improve-codebase-architecture` moved its vocabulary into `codebase-design`, keeps keystone's `audit` reconciliation and `CONCERNS.md` grounding, and adopted upstream's git-log hotspot scoping. Upstream later retired `zoom-out` as unused; keystone removed it in 1.0 (its blast-radius check lives on in the `code-reviewer` agent). |
| Idea folds across the catalog (formerly also the `performance-optimization`, `observability`, `deprecation-and-migration` skills) | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) — Addy Osmani | MIT | **Written original** rewrites of upstream `performance-optimization`, `observability-and-instrumentation`, and `deprecation-and-migration` — the methods (measure→verify→revert-on-neutral discipline, questions-first instrumentation, expand/contract) are upstream's; the prose, structure, and keystone cross-references are original. Those three skills were **removed in 1.0**; what survives is noted inline below. Smaller idea-only folds from the same source landed in `challenge` (formerly `adversarial-review`; blind dispatch, reconcile precedence, review-theater tripwire — from upstream `doubt-driven-development`), `grill-with-docs` (the explicit-yes gate — from `interview-me`; the confidence hypothesis and want-vs-should-want went with `brainstorming` in 1.0), `llm-security` (external-CLI sandbox rule), and the `code-reviewer` agent (from the former `review` command), `/ship`, `/qa`, and `audit` (formerly `auditing-for-overengineering`; from the former `audit` command) — structural remedies, rollout thresholds, metric honesty.  **A second borrow pass in 0.6.0** folded further ideas from the same source, again rewritten: idempotency-key mechanics and OAuth PKCE/`state` into `api-security`; a data-privacy section, DNS-rebinding SSRF, and Subresource Integrity into `security-review`; dependency-upgrade review and documentation-verification discipline into `coding-standards` (removed in 1.0; the `UNVERIFIED:` marker survives in `agents/implementer.md`) (with the doc-sourced outbound-endpoint rule into `llm-security`); a Phase-0 capability map into `writing-plans` and non-reproducible-bug branches and `git bisect` into `systematic-debugging` (both skills removed in 1.0); the feature-flag lifecycle into `deprecation-and-migration` (now in `/debt`; plus a flag-off rollback line in `/ship`); version-bump criteria into `git-workflow` (now in `/ship`); divergent generation lenses into `brainstorming` and contract-first parallelisation into `subagent-driven-development` (both removed in 1.0); the Definition-of-Done distinction into `verification-before-completion`; browser-automation guardrails into `/qa` and rotate-then-purge into `/cso`; and the task-list single-source-of-truth rule into `/to-issues` (removed with that command in 1.0). The three-tier eval framing and the validator-owned-exemption property behind `scripts/` are also upstream ideas. |
| Formerly `coding-standards` | [affaan-m/ECC](https://github.com/affaan-m/ECC) — Affaan Mustafa        | MIT     | Copied and adapted; cross-references retargeted to keystone/impeccable. **Removed in 1.0** as generic knowledge; its deliberate-shortcut marker convention and `UNVERIFIED:` marker live on in `agents/implementer.md` (and `/debt`). The former `cost-aware-llm-pipeline` skill came from the same source and was **removed in 0.6.0** — its tier-ladder and cache-economics content was rehomed into `designing-agent-systems` and its budget-ceiling/circuit-breaker content into `long-running-agents`, both rewritten in keystone's voice. |
| `security-review`                                                                                                                                                                                                                                                                                                  | [affaan-m/ECC](https://github.com/affaan-m/ECC) — Affaan Mustafa        | MIT     | `SKILL.md` began as ECC's and was **substantially rewritten** for keystone (OWASP Top 10 2025 + API Top 10 2023 source→sink methodology). The sibling `cloud-infrastructure-security.md` remains largely ECC's (lightly edited). Treated as keystone-maintained.                                                                                                                               |

### Commands

| Component(s)                                                                                                                                          | Source                                                                  | License | Relationship                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `qa`, `cso`, `ship`, `retro`, `investigate`, `freeze`, `careful`, `guard`, `unfreeze` (formerly also `office-hours`, `plan-ceo-review`, `plan-eng-review`, `review`) | [garrytan/gstack](https://github.com/garrytan/gstack) — Garry Tan       | MIT     | Re-authored for keystone (gstack-specific infra removed; adapted to keystone's conventions and the Chrome MCP tools). Not verbatim copies. **In 1.0**, `review` was folded into the `code-reviewer` agent, `plan-ceo-review` / `plan-eng-review` were removed (the latter's lean-process rubric row lives on in `challenge`), `office-hours` was removed in favor of `/spec`, and `investigate` was rewritten as a short standalone command (it no longer loads a debugging skill). |
| Idea folds (formerly also the `to-issues`, `to-prd` commands) | [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock | MIT     | Re-authored; `to-issues` retargeted from GitHub issues to Linear. Both commands were **removed in 1.0** as unused. **In 0.6.0**, further idea-only folds from the same source were rewritten for keystone: reproduction **minimisation**, the reproduction-*rate* framing, tagged debug instrumentation with a cleanup gate, the loop-construction ladder, and "no correct seam is itself the finding" into `systematic-debugging` (from `diagnosing-bugs`; removed with that skill in 1.0, except the secret-redaction rule, which `/investigate` adapts from the same upstream skill); **leading words**, the clarity/demand split in completion criteria, and environment-as-cache into `writing-skills` (from `writing-for-agents`); the **fog-or-task test** into `writing-plans` (from `wayfinder`), the **wide-refactor exception** into `writing-plans` (from `to-tickets`), and **agree-the-seam-before-RED** into `test-driven-development` (from `tdd`) — those three skills were removed in 1.0; the wide-refactor exception and the seam sketch now arrive directly in the adapted `to-tickets` and `spec`. **In 0.9.0**, two more idea-only folds: cross-skill hand-offs name the skill explicitly rather than relying on `/name` prose (from upstream's invocation convention), and `/retro` routes mechanical lessons to deterministic checks instead of written rules (from `retro`). |

### Harness hooks

`instincts.js`, `guard.js`, `scan.js`, `notify.js`, and `learnings.js` are original work. The
instinct/memory/security-hook and per-repo continuous-learning _concepts_ are inspired by
[affaan-m/ECC](https://github.com/affaan-m/ECC) (`continuous-learning-v2`); the implementations
here are original and intentionally lean (markdown files, no daemon).

### keystone-original components

Written for keystone (not vendored): the `onboard-codebase`, `llm-security`, `api-security`,
`audit` (named `auditing-for-overengineering` before 1.0), and `challenge` skills, and the
`code-reviewer`, `implementer`, and `security-reviewer` agents. Removed in 1.0: the `git-workflow` skill (its version-bump
and changelog rules now live in `/ship`), the `simplifying-code` skill and `/simplify` command
(superseded by the built-in `/simplify`; behavior-preservation moved into
`verification-before-completion`), the `planner` and `qa` agents (the `/qa` browser-testing command stays), and the `/context-budget`, `/pause`,
`/research-notes`, and `/challenge` commands (`/challenge` is now the `challenge` skill).

### Methodology inspiration (no code or content copied)

Several capabilities reimplement **methodology** (ideas/facts, which are not copyrightable) in
original wording — no text or code was copied from these sources:

- **Trail of Bits** ([`trailofbits/skills`](https://github.com/trailofbits/skills), **CC-BY-SA-4.0**):
  the differential-review discipline in the `code-reviewer` agent + `security-reviewer`, the `variant-analysis`
  skill, and the agent-action audit in `llm-security`. Their CC-BY-SA text was deliberately **not**
  copied, so keystone stays MIT. For the full implementations, install their plugin separately
  (it stays CC-BY-SA-4.0).
- **AI Engineering from Scratch** ([`rohitg00/ai-engineering-from-scratch`](https://github.com/rohitg00/ai-engineering-from-scratch),
  Rohit Ghumare, MIT): the labeled routing-test set with a held-out split in `writing-skills`,
  task-by-task change comparison with pre-declared thresholds in `designing-agent-systems`, and
  earliest-control-first plus retirement conditions for promoted instincts in `/learn`.
- **Cloudflare security-audit-skill** ([`cloudflare/security-audit-skill`](https://github.com/cloudflare/security-audit-skill),
  MIT): the _needs validation_ verdict, severity capped at demonstrated impact with anchored
  levels, the finding test that separates hardening from findings, and the coverage statement
  in `security-review` / `security-reviewer` / `/cso`; the between-category vulnerability
  classes in `security-review`; and "injection alone is not a finding; a prompt guardrail is
  not a boundary" in `llm-security`.
- **BehiSec VibeSec** ([`BehiSecc/VibeSec-Skill`](https://github.com/BehiSecc/VibeSec-Skill),
  Apache-2.0): three `security-review` additions (XXE hardening, open-redirect / IDN-homograph
  guarding, account/session lifecycle revocation), reimplemented original.
- **Blindspot** ([`IdanTayree/Blindspot`](https://github.com/IdanTayree/Blindspot)): the idea behind `/spec`'s
  blind-spot pass on a project already underway (read the docs first, a collision pass for
  contradicting decisions, a list of never-decided areas), written fresh.
- **GSD**, **BMAD**, and **ponytail** (DietrichGebert, MIT): several rigor techniques were adapted
  idea-only and written original; no framework machinery or text was copied.
- **Anthropic's model-specific prompting guides** (platform docs for
  [Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)
  and [Claude Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1)):
  the 0.7.0 multi-task pass — spawn discipline, tool-call batching, keep-working-while-workers-run,
  effort-as-a-tier-axis, and the unattended-run contract — was adapted from these guides in
  keystone's wording. Two load-bearing sentences in the unattended-run packet footer (now the
  "Running unattended" section of `agents/implementer.md`: the batching nudge and the "not
  watching in real time" opener) stay close to the
  guides' phrasing because the guides note that the wording carries the effect.
- **Andrej Karpathy's January 2026 observations on LLM coding failure modes**, as packaged by
  Forrest Chang in [`multica-ai/andrej-karpathy-skills`](https://github.com/multica-ai/andrej-karpathy-skills):
  two narrow **idea-only** folds in 0.8.0, written original — defensive code for impossible states
  as an over-engineering category (the `defend:` tag in `audit`), and
  "every changed line should trace to the request" as a reviewer check. The remaining principles
  in that file (think before coding, simplicity first, surgical changes, goal-driven execution)
  were assessed and **deliberately not adopted**: keystone already covers each in more depth, and
  a surface restating them would collide with `audit`'s routing — the
  failure mode that got `cost-aware-llm-pipeline` deleted in 0.6.0.

---

## Third-party MIT license notices

The following components are copied or adapted from MIT-licensed projects. Their copyright and
permission notices are retained here as required by the MIT License. The permission-and-warranty
text is identical for all five and is reproduced once below the copyright lines.

```
Copyright (c) 2025 Jesse Vincent            (obra/superpowers)
Copyright (c) 2026 Matt Pocock              (mattpocock/skills)
Copyright (c) 2026 Affaan Mustafa           (affaan-m/ECC)
Copyright (c) 2026 Garry Tan                (garrytan/gstack)
Copyright (c) 2025 Addy Osmani              (addyosmani/agent-skills)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
