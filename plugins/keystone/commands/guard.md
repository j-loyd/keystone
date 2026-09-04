---
name: guard
description: Full safety mode — freeze edits to the current directory AND turn on careful mode for destructive commands. Combines /freeze + /careful.
argument-hint: "[optional: directory to allow; defaults to current dir]"
allowed-tools:
  - Bash
---

# Guard — full safety mode

Turn on both guardrails at once: fence edits to a directory (like `/freeze`) **and**
require confirmation for destructive commands (like `/careful`). Use in production or
shared repos where you want maximum protection.

```bash
DIR="$ARGUMENTS"; [ -n "$DIR" ] || DIR="$PWD"
ABS="$(cd "$DIR" 2>/dev/null && pwd)" || { echo "No such directory: $DIR"; exit 1; }
STATE="$HOME/.claude/keystone-guard.json"
printf '{\n  "freeze": "%s",\n  "careful": true\n}\n' "$ABS" > "$STATE"
echo "🛡️  Guard mode ON — edits fenced to $ABS, careful mode on. Run /unfreeze to lift."
```

Confirm the active protections to the user.
