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
| `brainstorming`, `systematic-debugging`, `test-driven-development`, `writing-plans`, `verification-before-completion`, `using-git-worktrees`, `dispatching-parallel-agents`, `subagent-driven-development`, `receiving-code-review`, `finishing-a-development-branch` | [obra/superpowers](https://github.com/obra/superpowers) — Jesse Vincent | MIT     | Copied from the installed skills. Most were then extended with original depth (`brainstorming`, `writing-plans`, `systematic-debugging`, `verification-before-completion`, `subagent-driven-development`, `dispatching-parallel-agents`). `executing-plans` and `requesting-code-review` were merged into `subagent-driven-development` (as `no-subagent-fallback.md` and `code-reviewer-prompt.md`); a few (`test-driven-development`, `receiving-code-review`, `using-git-worktrees`) remain close to upstream with only minor edits. |
| `resolving-merge-conflicts`, `writing-skills`                                                                                                                                                                                                                                                                     | [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock | MIT     | **Written original**, idea-only adaptation of upstream `resolving-merge-conflicts` and `writing-great-skills`. No upstream text copied; the resolve-by-intent / never-abort-as-escape framing and the predictability-and-branches lens are the borrowed ideas. The `prototype` branch inside `brainstorming` is likewise idea-only from upstream `prototype`.                                    |
| `grill-with-docs`, `zoom-out`, `improve-codebase-architecture`                                                                                                                                                                                                                                                     | [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock | MIT     | Copied from `skills/engineering`, largely as-is with light adaptation (`grill-with-docs` merges upstream `grilling`+`domain-modeling`; `ADR-FORMAT.md`/`CONTEXT-FORMAT.md` are essentially upstream's). Upstream later retired `zoom-out` as unused.                                                                                                                                           |
| `performance-optimization`, `observability`, `deprecation-and-migration`                                                                                                                                                                                                                                           | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) — Addy Osmani | MIT | **Written original** rewrites of upstream `performance-optimization`, `observability-and-instrumentation`, and `deprecation-and-migration` — the methods (measure→verify→revert-on-neutral discipline, questions-first instrumentation, expand/contract) are upstream's; the prose, structure, and keystone cross-references are original. Smaller idea-only folds from the same source landed in `adversarial-review` (blind dispatch, reconcile precedence, review-theater tripwire — from upstream `doubt-driven-development`), `brainstorming`/`grill-with-docs` (confidence hypothesis, want-vs-should-want, explicit-yes gate — from `interview-me`), `test-driven-development` (stack discovery), `llm-security` (external-CLI sandbox rule), and the `review`/`ship`/`qa`/`audit` commands (structural remedies, rollout thresholds, metric honesty).  **A second borrow pass in 0.6.0** folded further ideas from the same source, again rewritten: idempotency-key mechanics and OAuth PKCE/`state` into `api-security`; a data-privacy section, DNS-rebinding SSRF, and Subresource Integrity into `security-review`; dependency-upgrade review and documentation-verification discipline into `coding-standards` (with the doc-sourced outbound-endpoint rule into `llm-security`); a Phase-0 capability map into `writing-plans`; non-reproducible-bug branches and `git bisect` into `systematic-debugging`; the feature-flag lifecycle into `deprecation-and-migration` (plus a flag-off rollback line in `/ship`); version-bump criteria into `git-workflow`; divergent generation lenses into `brainstorming`; contract-first parallelisation into `subagent-driven-development`; the Definition-of-Done distinction into `verification-before-completion`; browser-automation guardrails into `/qa` and rotate-then-purge into `/cso`; and the task-list single-source-of-truth rule into `/to-issues`. The three-tier eval framing and the validator-owned-exemption property behind `scripts/` are also upstream ideas. |
| `coding-standards` | [affaan-m/ECC](https://github.com/affaan-m/ECC) — Affaan Mustafa        | MIT     | Copied and adapted; cross-references retargeted to keystone/impeccable. The former `cost-aware-llm-pipeline` skill came from the same source and was **removed in 0.6.0** — its tier-ladder and cache-economics content was rehomed into `designing-agent-systems` and its budget-ceiling/circuit-breaker content into `long-running-agents`, both rewritten in keystone's voice. |
| `security-review`                                                                                                                                                                                                                                                                                                  | [affaan-m/ECC](https://github.com/affaan-m/ECC) — Affaan Mustafa        | MIT     | `SKILL.md` began as ECC's and was **substantially rewritten** for keystone (OWASP Top 10 2025 + API Top 10 2023 source→sink methodology). The sibling `cloud-infrastructure-security.md` remains largely ECC's (lightly edited). Treated as keystone-maintained.                                                                                                                               |

### Commands

| Component(s)                                                                                                                                          | Source                                                                  | License | Relationship                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `office-hours`, `plan-ceo-review`, `plan-eng-review`, `review`, `qa`, `cso`, `ship`, `retro`, `investigate`, `freeze`, `careful`, `guard`, `unfreeze` | [garrytan/gstack](https://github.com/garrytan/gstack) — Garry Tan       | MIT     | Re-authored for keystone (gstack-specific infra removed; adapted to keystone's conventions and the Chrome MCP tools). Not verbatim copies. |
| `to-issues`, `to-prd`                                                                                                                                 | [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock | MIT     | Re-authored; `to-issues` retargeted from GitHub issues to Linear. **In 0.6.0**, further idea-only folds from the same source were rewritten for keystone: reproduction **minimisation**, the reproduction-*rate* framing, tagged debug instrumentation with a cleanup gate, the loop-construction ladder, and "no correct seam is itself the finding" into `systematic-debugging` (from `diagnosing-bugs`); **leading words**, the clarity/demand split in completion criteria, and environment-as-cache into `writing-skills` (from `writing-for-agents`); the **fog-or-task test** and the out-of-scope/fog distinction into `writing-plans` (from `wayfinder`); the **wide-refactor exception** to vertical slicing, with prefactoring, into `writing-plans` (from `to-tickets`); and the **agree-the-seam-before-RED** discipline into `test-driven-development` (from `tdd`). |

### Harness hooks

`instincts.js`, `guard.js`, `scan.js`, `notify.js`, and `learnings.js` are original work. The
instinct/memory/security-hook and per-repo continuous-learning _concepts_ are inspired by
[affaan-m/ECC](https://github.com/affaan-m/ECC) (`continuous-learning-v2`); the implementations
here are original and intentionally lean (markdown files, no daemon).

### keystone-original components

Written for keystone (not vendored): the `git-workflow`, `onboard-codebase`, `llm-security`,
`api-security`, `auditing-for-overengineering`, and `simplifying-code` skills, and the
`code-reviewer`, `planner`, `implementer`, `qa`, and `security-reviewer` agents.

### Methodology inspiration (no code or content copied)

Several capabilities reimplement **methodology** (ideas/facts, which are not copyrightable) in
original wording — no text or code was copied from these sources:

- **Trail of Bits** ([`trailofbits/skills`](https://github.com/trailofbits/skills), **CC-BY-SA-4.0**):
  the differential-review discipline in `/review` + `security-reviewer`, the `variant-analysis`
  skill, and the agent-action audit in `llm-security`. Their CC-BY-SA text was deliberately **not**
  copied, so keystone stays MIT. For the full implementations, install their plugin separately
  (it stays CC-BY-SA-4.0).
- **BehiSec VibeSec** ([`BehiSecc/VibeSec-Skill`](https://github.com/BehiSecc/VibeSec-Skill),
  Apache-2.0): three `security-review` additions (XXE hardening, open-redirect / IDN-homograph
  guarding, account/session lifecycle revocation), reimplemented original.
- **GSD**, **BMAD**, and **ponytail** (DietrichGebert, MIT): several rigor techniques were adapted
  idea-only and written original; no framework machinery or text was copied.
- **Anthropic's model-specific prompting guides** (platform docs for
  [Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)
  and [Claude Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1)):
  the 0.7.0 multi-task pass — spawn discipline, tool-call batching, keep-working-while-workers-run,
  effort-as-a-tier-axis, and the unattended-run contract — was adapted from these guides in
  keystone's wording. Two load-bearing sentences in the `dispatching-parallel-agents` packet
  footer (the batching nudge and the "not watching in real time" opener) stay close to the
  guides' phrasing because the guides note that the wording carries the effect.
- **Andrej Karpathy's January 2026 observations on LLM coding failure modes**, as packaged by
  Forrest Chang in [`multica-ai/andrej-karpathy-skills`](https://github.com/multica-ai/andrej-karpathy-skills):
  two narrow **idea-only** folds in 0.8.0, written original — defensive code for impossible states
  as an over-engineering category (the `defend:` tag in `auditing-for-overengineering`), and
  "every changed line should trace to the request" as a reviewer check. The remaining principles
  in that file (think before coding, simplicity first, surgical changes, goal-driven execution)
  were assessed and **deliberately not adopted**: keystone already covers each in more depth, and
  a surface restating them would collide with `auditing-for-overengineering`'s routing — the
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
