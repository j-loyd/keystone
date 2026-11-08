# Issue tracker: Local Markdown

Specs and tickets for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Tickets are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered
  from `01` in dependency order, never a single combined file
- Each ticket carries a `**Status:**` line (`ready-for-agent`, then `in-progress`, then `done`) and a
  `**Blocked by:**` line listing ticket numbers, or "None (can start immediately)"
- The **frontier** is every ticket that isn't `done` and whose blockers are all `done`
- Comments and history append to the bottom of the file under a `## Comments` heading
- Research notes for a feature go in `.scratch/<feature-slug>/notes/`

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the ticket number.
