---
name: setup
description: Configure a repo for /spec, /to-tickets, and /implement — where tickets live (local .scratch/ files by default; GitHub, GitLab, or Linear optional), the label vocabulary, and the domain-doc layout (GLOSSARY.md + ADRs). Use when the user runs /setup, once per repo, or to switch trackers.
disable-model-invocation: true
---

# Setup

Scaffold the per-repo configuration the ticket pipeline reads:

- **Issue tracker**: where specs and tickets live. Local markdown under `.scratch/` is the default
  and needs no setup at all; GitHub, GitLab, and Linear are optional.
- **Labels**: the strings a remote tracker uses for "ready for an agent" and friends.
- **Domain docs**: where `GLOSSARY.md` and ADRs live, and how skills read them.

This is a prompt-driven skill, not a script. Explore, present what you found, confirm with the
user, then write.

## 1. Explore

Read whatever exists; don't assume:

- `git remote -v`: GitHub, GitLab, another host, or no remote?
- `CLAUDE.md` and `AGENTS.md` at the repo root: does either exist, and does either already have an
  `## Agent skills` section?
- `GLOSSARY.md` / `GLOSSARY-MAP.md` at the root, and the legacy `CONTEXT.md` / `CONTEXT-MAP.md`. If
  a legacy file exists, offer to `git mv` it to its `GLOSSARY` name.
- `docs/adr/` and any `src/*/docs/adr/` directories.
- `docs/agents/`: does this skill's earlier output already exist?
- `.scratch/`: already in use? Is it in `.gitignore`?
- Monorepo signals: a `pnpm-workspace.yaml`, a `workspaces` field in `package.json`, or a populated
  `packages/*` with its own `src/`. Their absence means single-context, which is almost every repo.

## 2. Present findings and ask

Summarise what's present and missing, then take the sections in order: one section, one answer,
then the next. Lead each with the recommended answer so the user can accept it in a word, and skip
a section entirely when exploration already settled it.

**A. Issue tracker.** Recommend **local markdown** (`.scratch/<feature>/`) unless the user already
tracks work somewhere else. Options:

- **Local markdown** (default): specs and tickets as files under `.scratch/<feature>/`. Then ask
  one follow-up: commit `.scratch/`, or keep it local by adding it to `.gitignore`? Recommend
  keeping it local in a public repo.
- **GitHub** (`gh` CLI) or **GitLab** (`glab` CLI): propose the one the `git remote` points at.
  It needs a reachable repo: if no remote points at that host, get the URL and wire it up
  (`git remote add origin <url>`). Done when `gh repo view` / `glab repo view` prints the project;
  if it can't, stop and say what's missing.
- **Linear**: ask for the team (and project, if used) and the state new tickets should land in.
- **Other** (Jira, ...): ask the user to describe the workflow in one paragraph and record it as
  prose.

**B. Labels** (remote trackers only; local tickets use `**Status:**` lines instead). Ask exactly
one question: keep the default labels `ready-for-agent`, `ready-for-human`, `needs-info`?
(recommended: **yes**). Only on "no" collect the overrides, usually because the tracker already
has its own names, so the pipeline applies existing labels instead of creating duplicates.

**C. Domain docs.** Default to **single-context** (one `GLOSSARY.md` + `docs/adr/` at the root)
and write it without asking. Offer **multi-context** (a root `GLOSSARY-MAP.md` pointing at
per-context glossaries) only when exploration found monorepo signals.

## 3. Confirm and edit

Show the user a draft of the `## Agent skills` block and of `docs/agents/issue-tracker.md` and
`docs/agents/domain.md`. Let them edit before writing.

## 4. Write

**Pick the file to edit:** `CLAUDE.md` if it exists, else `AGENTS.md`. If neither exists, ask which
to create; never create one when the other already exists. If an `## Agent skills` block already
exists, update it in place rather than appending a duplicate, and leave the surrounding sections
alone.

```markdown
## Agent skills

### Issue tracker

[one-line summary of where specs and tickets live]. See `docs/agents/issue-tracker.md`.

### Domain docs

[single-context or multi-context]. See `docs/agents/domain.md`.
```

Then write the docs from the seed templates in this skill's folder:

- [issue-tracker-local.md](issue-tracker-local.md): local markdown
- [issue-tracker-github.md](issue-tracker-github.md): GitHub
- [issue-tracker-gitlab.md](issue-tracker-gitlab.md): GitLab
- [issue-tracker-linear.md](issue-tracker-linear.md): Linear (fill in the placeholders)
- [domain.md](domain.md): domain-doc consumer rules and layout

For "other" trackers, write `docs/agents/issue-tracker.md` from the user's description, keeping
the same headings. On GitHub or GitLab, create each configured label the tracker lacks
(`gh label create` / `glab label create`). For local markdown, apply the `.gitignore` choice.

## 5. Done

Tell the user setup is complete and that `/spec`, `/to-tickets`, `/implement`, and `/pickup` now
read these files. They can edit `docs/agents/*.md` directly later; re-run `/setup` only to switch
trackers or start over.
