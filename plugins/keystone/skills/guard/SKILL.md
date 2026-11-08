---
name: guard
description: Keystone's opt-in safety modes in one skill — fence Edit/Write to a directory, ask before destructive shell commands, or both, then lift them. Use when the user runs /guard (freeze, careful, on, off, or status) to protect a sensitive or shared repo.
argument-hint: "[on [dir] | off | freeze [dir] | careful [on|off] | status]"
disable-model-invocation: true
allowed-tools:
  - Bash
---

# Guard — fence edits, confirm destructive commands

Requested mode: **$ARGUMENTS**

keystone's `guard.js` hook always hard-blocks catastrophic commands and secret-file access.
`/guard` adds two opt-in layers on top, stored per machine in one state file:

- **freeze**: any Edit/Write whose target resolves outside the boundary directory is denied.
  Reads and Bash are not fenced.
- **careful**: a broader set of destructive Bash commands asks for confirmation first: `rm -rf`,
  `git push`, `gh pr merge`, a checkout of main/master followed by `git merge`, force
  operations, and bulk overwrite or move. On Codex CLI these asks are ignored (Codex runs the
  command anyway), so careful mode only takes effect in Claude Code.

## Pick the mode

| You ran | Does | Runs |
| --- | --- | --- |
| `/guard` or `/guard on [dir]` | freeze + careful | `guard [dir]` |
| `/guard freeze [dir]` | freeze only (careful kept as-is) | `freeze [dir]` |
| `/guard careful` or `/guard careful on` | careful on (freeze kept) | `careful on` |
| `/guard careful off` | careful off (freeze kept) | `careful off` |
| `/guard off` | lift both | `unfreeze` |
| `/guard status` | show the current state | `status` |

A bare directory (`/guard ./api`) means `/guard on ./api`, as it did before 1.0. `[dir]` defaults
to the current directory. Anything else isn't a mode: show this table and stop.

Run the matching block **exactly as written**, replacing `<dir>` with the directory from the
argument (single-quote it if it contains spaces), or deleting `<dir>` to use the current
directory. Never substitute a variable, `$(...)`, or a second command: guard.js lets only these
exact protection-adding forms run without a prompt.

**on**

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"
node "$R/hooks/guard-state.js" guard <dir>
```

**freeze**

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"
node "$R/hooks/guard-state.js" freeze <dir>
```

**careful on**

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"
node "$R/hooks/guard-state.js" careful on
```

**careful off**

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"
node "$R/hooks/guard-state.js" careful off
```

**off**

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"
node "$R/hooks/guard-state.js" unfreeze
```

**status**

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"
node "$R/hooks/guard-state.js" status
```

## Expect a prompt when protection shrinks

`/guard off`, `/guard careful off`, and moving an active freeze (a new boundary could be wider)
always ask for confirmation. The hook can't tell a user-typed `/guard off` from the model
running the same command, so anything that removes or widens protection goes to a human.
Adding protection runs unprompted.

On Codex CLI, hooks can't ask, so those same commands are **denied** instead. To lift or widen
protection there, run the `guard-state.js` command above yourself, in your own terminal.

Afterwards, tell the user the active state: the boundary (or none) and careful on/off.
