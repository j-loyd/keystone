# Issue tracker: GitLab

Specs and tickets for this repo live as GitLab issues. Use the [`glab`](https://gitlab.com/gitlab-org/cli)
CLI for all operations. Drafts still start at `.scratch/<feature-slug>/spec.md`; `/spec` publishes
the finished spec here.

## Conventions

- **Create an issue**: `glab issue create --title "..." --description "..."`. Use a heredoc for multi-line descriptions.
- **Read an issue**: `glab issue view <number> --comments`. Use `-F json` for machine-readable output.
- **List issues**: `glab issue list -O json` with appropriate `--label` filters.
- **Comment on an issue**: `glab issue note <number> --message "..."`. GitLab calls comments "notes".
- **Apply / remove labels**: `glab issue update <number> --label "..."` / `--unlabel "..."`.
- **Blocking**: GitLab's native blocking link, added with the `/blocked_by #<n>` quick action posted as a note (`glab issue note <child> --message "/blocked_by #<blocker>"`). Native blocking links are a Premium/Ultimate feature; elsewhere fall back to a `Blocked by: #<n>, #<n>` line at the top of the description. A ticket is unblocked when every blocker is closed.
- **Close**: `glab issue close <number>`. It takes no closing comment, so post the explanation first with `glab issue note`, then close.
- **Merge requests**: `glab mr create`, `glab mr view`, `glab mr note`, the same shape as `gh pr ...`.

Infer the repo from `git remote -v`; `glab` does this automatically inside a clone.

## Labels

| Role              | Label in this repo | Meaning                                  |
| ----------------- | ------------------ | ---------------------------------------- |
| `ready-for-agent` | `ready-for-agent`  | Fully specified; an agent can pick it up |
| `ready-for-human` | `ready-for-human`  | Needs a human to implement or decide     |
| `needs-info`      | `needs-info`       | Waiting on more information              |

## When a skill says "publish to the issue tracker"

Create a GitLab issue.

## When a skill says "fetch the relevant ticket"

Run `glab issue view <number> --comments`.
