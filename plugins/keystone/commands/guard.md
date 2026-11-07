---
name: guard
description: Full safety mode — freeze edits to the current directory AND turn on careful mode for destructive commands. Combines /freeze + /careful.
argument-hint: "[optional: directory to allow; defaults to current dir]"
disable-model-invocation: true
allowed-tools:
  - Bash
---

# Guard — full safety mode

Turn on both guardrails at once: fence edits to a directory (like `/freeze`) **and**
require confirmation for destructive commands (like `/careful`). Use in production or
shared repos where you want maximum protection.

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"
node "$R/hooks/guard-state.js" guard "$ARGUMENTS"
```

Confirm the active protections to the user. If a freeze is already active, guard.js asks
for confirmation before moving it (a new boundary could be wider).
