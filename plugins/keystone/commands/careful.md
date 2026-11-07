---
name: careful
description: Turn on careful mode — guard.js asks for confirmation before a broader set of destructive Bash commands (rm -rf, git push, overwrite/move) on top of its always-on catastrophic blocks.
disable-model-invocation: true
allowed-tools:
  - Bash
---

# Careful — confirm before destructive commands

Raise the safety bar for this machine. With careful mode on, keystone's `guard.js`
escalates a broader set of destructive shell commands to **ask** (a confirmation prompt)
— things that are legitimate but you never want to run on autopilot: `rm -rf`,
`git push`, force operations, bulk overwrite/move. guard.js still **hard-blocks** the
truly catastrophic commands and secret-file access regardless of this flag.

Enable it (any active freeze boundary is kept):

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"
node "$R/hooks/guard-state.js" careful on
```

Confirm to the user that careful mode is active. To turn only careful mode off later, the
user can run the same command with `careful off` instead of `careful on` (or `/unfreeze`
to lift everything) — guard.js asks for confirmation first, since that removes protection.
