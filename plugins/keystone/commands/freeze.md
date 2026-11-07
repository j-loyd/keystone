---
name: freeze
description: Restrict file edits to a single directory for this machine — guard.js hard-blocks Edit/Write outside the boundary until /unfreeze. Use when working in a sensitive repo.
argument-hint: "[optional: directory to allow; defaults to current dir]"
disable-model-invocation: true
allowed-tools:
  - Bash
---

# Freeze — fence edits to one directory

Set an edit boundary. While frozen, keystone's `guard.js` PreToolUse hook **denies any
Edit/Write whose target resolves outside the allowed directory**. Reads and Bash are not
fenced by freeze (use `/careful` for destructive-command guarding).

Set the boundary to **$ARGUMENTS** (or the current directory if no argument); any existing
`careful` flag is kept:

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"
node "$R/hooks/guard-state.js" freeze "$ARGUMENTS"
```

After running it, confirm the active boundary to the user. If a freeze is already active,
guard.js asks for confirmation before moving it (a new boundary could be wider).
