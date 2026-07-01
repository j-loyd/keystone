# Memory Index

> Template. One line per memory file — the passive index loaded into context each
> session. Memory _content_ lives in sibling files (one fact per file, with
> frontmatter); this file only points at them. Pair with `INSTINCTS.md`, which is the
> active auto-apply layer (rules that FIRE, not just load).

## Environment

- [Example setup note](reference_example.md) — what's non-obvious about the local setup

## Active Projects

### <Project Name>

- **Location:** `<path>`
- **Stack:** `<stack>`
- **Status:** `<one line>`
- **Memory file:** [project\_<slug>.md](project_<slug>.md)

## Feedback

- [Short title](feedback_<slug>.md) — the rule, in a few words

## Patterns & Lessons

- Reusable lessons that aren't tied to one project.

---

### Memory file frontmatter

```markdown
---
name: <short-kebab-case-slug>
description: <one-line summary — used to decide relevance during recall>
metadata:
  type: user | feedback | project | reference
---

<the fact. for feedback/project, add **Why:** and **How to apply:** lines.
Link related memories with [[their-name]].>
```
