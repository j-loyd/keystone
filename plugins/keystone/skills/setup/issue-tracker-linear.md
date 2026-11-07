# Issue tracker: Linear

Specs and tickets for this repo live in Linear, team `<TEAM>` (project `<PROJECT>` if used).
Drafts still start at `.scratch/<feature-slug>/spec.md`; `/spec` publishes the finished spec here.

## Conventions

- **Tools**: use the Linear MCP server's tools when connected; otherwise ask the user how they
  reach Linear from this machine and record it here. Don't guess at an API.
- **Spec**: one issue (or a Linear project document, if the team prefers) holding the spec body.
- **Tickets**: one issue per ticket, created as sub-issues of the spec issue, in dependency order.
- **Blocking**: Linear's native "blocked by" relation between issues. A ticket is unblocked when
  every blocker is in a completed state.
- **State**: create tickets in the team's normal backlog/todo state (`<STATE>`), not an inbox
  state that most views hide, unless the user says otherwise.
- **Comment / close**: comment with the evidence, then move the issue to the team's done state.

## Labels

| Role              | Label in this team | Meaning                                  |
| ----------------- | ------------------ | ---------------------------------------- |
| `ready-for-agent` | `ready-for-agent`  | Fully specified; an agent can pick it up |
| `ready-for-human` | `ready-for-human`  | Needs a human to implement or decide     |
| `needs-info`      | `needs-info`       | Waiting on more information              |

## When a skill says "publish to the issue tracker"

Create a Linear issue in `<TEAM>`.

## When a skill says "fetch the relevant ticket"

Read the issue by its identifier (e.g. `ABC-123`), including comments and relations.
