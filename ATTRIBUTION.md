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
| `performance-optimization`, `observability`, `deprecation-and-migration`                                                                                                                                                                                                                                           | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) — Addy Osmani | MIT | **Written original** rewrites of upstream `performance-optimization`, `observability-and-instrumentation`, and `deprecation-and-migration` — the methods (measure→verify→revert-on-neutral discipline, questions-first instrumentation, expand/contract) are upstream's; the prose, structure, and keystone cross-references are original. Smaller idea-only folds from the same source landed in `adversarial-review` (blind dispatch, reconcile precedence, review-theater tripwire — from upstream `doubt-driven-development`), `brainstorming`/`grill-with-docs` (confidence hypothesis, want-vs-should-want, explicit-yes gate — from `interview-me`), `test-driven-development` (stack discovery), `llm-security` (external-CLI sandbox rule), and the `review`/`ship`/`qa`/`audit` commands (structural remedies, rollout thresholds, metric honesty). |
| `cost-aware-llm-pipeline`, `coding-standards`                                                                                                                                                                                                                                                                      | [affaan-m/ECC](https://github.com/affaan-m/ECC) — Affaan Mustafa        | MIT     | Copied and adapted; `coding-standards` cross-references retargeted to keystone/impeccable.                                                                                                                                                                                                                                                                                                     |
| `security-review`                                                                                                                                                                                                                                                                                                  | [affaan-m/ECC](https://github.com/affaan-m/ECC) — Affaan Mustafa        | MIT     | `SKILL.md` began as ECC's and was **substantially rewritten** for keystone (OWASP Top 10 2025 + API Top 10 2023 source→sink methodology). The sibling `cloud-infrastructure-security.md` remains largely ECC's (lightly edited). Treated as keystone-maintained.                                                                                                                               |

### Commands

| Component(s)                                                                                                                                          | Source                                                                  | License | Relationship                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `office-hours`, `plan-ceo-review`, `plan-eng-review`, `review`, `qa`, `cso`, `ship`, `retro`, `investigate`, `freeze`, `careful`, `guard`, `unfreeze` | [garrytan/gstack](https://github.com/garrytan/gstack) — Garry Tan       | MIT     | Re-authored for keystone (gstack-specific infra removed; adapted to keystone's conventions and the Chrome MCP tools). Not verbatim copies. |
| `to-issues`, `to-prd`                                                                                                                                 | [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock | MIT     | Re-authored; `to-issues` retargeted from GitHub issues to Linear.                                                                          |

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
