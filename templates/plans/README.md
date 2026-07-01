# Plans

Implementation plans / specs for this repo, written by keystone's `writing-plans` skill
(via `/spec`) and executed by `subagent-driven-development` / `executing-plans`.

## Layout (adaptive)

- **Small / medium effort → one file:** `YYYY-MM-DD-<feature>.md` (header + `### Task N`
  sections with `- [ ]` steps).
- **Large / multi-phase effort → a folder:** `YYYY-MM-DD-<feature>/` containing `plan.md`
  (goal, architecture, phase index, revision log) + `phase-N-<name>.md` files. Use a folder
  when the work has ~3+ phases or spans multiple subsystems.
- **Completed** plans (file or folder) move to `archive/`.
- **Versioning** is git. For a deliberate re-plan, add a `## Revision log` entry in the plan
  rather than duplicating files; reserve a `-v2` suffix for a genuinely separate redo.

## Active plans

| Plan                                             | Status                          | Started    |
| ------------------------------------------------ | ------------------------------- | ---------- |
| [example-feature](2026-01-01-example-feature.md) | Planned / In progress / Blocked | 2026-01-01 |

_Move rows to the bottom (or delete) once the plan is archived._

## Archived

See [`archive/`](archive/).
