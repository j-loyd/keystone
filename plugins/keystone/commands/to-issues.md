---
name: to-issues
description: Turn a plan, spec, or discussion into discrete, independently-actionable Linear issues. Always creates them in Backlog.
argument-hint: "[plan/spec to break down, or a file path]"
allowed-tools:
  - Read
  - Grep
  - Glob
---

# To Issues — break the work into actionable tickets

Convert **$ARGUMENTS** into a set of discrete Linear issues.

> **Hard rule (the always-Backlog rule):** create every issue in the
> **Backlog** state, never Triage — Triage is hidden in most views. Use the Linear MCP
> tools to create them (search the available `linear` tools if not already loaded).

## How to slice

- One issue = one independently-shippable unit of work. If it can't be picked up on its
  own, it's too big (split it) or too small (fold it into a sibling).
- Order by dependency: foundational/data-layer work before the things that build on it.
- Each issue gets: a clear imperative title, a short description (what + why), acceptance
  criteria, and any dependency links to its blockers.

## Process

1. Read the source and list the candidate issues with their dependency order.
2. **Show the user the proposed issue list first** and confirm before creating anything
   in Linear.
3. On confirmation, create them in **Backlog**, wiring up blocked-by/blocks relationships.
4. Report back the created issue IDs and the dependency graph.
5. Point the source plan at them: once the issues exist in a tracker, that tracker holds
   task state and the plan's task list becomes an **ordered index of issue IDs or links**,
   not a second checklist — keep both and they drift apart silently.

If the source is still fuzzy, push it through `writing-plans` (or `/office-hours`) before
slicing into issues — don't manufacture tickets from an unresolved plan.
