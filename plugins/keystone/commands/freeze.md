---
name: freeze
description: Restrict file edits to a single directory for this machine — guard.js hard-blocks Edit/Write outside the boundary until /unfreeze. Use when working in a sensitive repo.
argument-hint: "[optional: directory to allow; defaults to current dir]"
allowed-tools:
  - Bash
---

# Freeze — fence edits to one directory

Set an edit boundary. While frozen, keystone's `guard.js` PreToolUse hook **denies any
Edit/Write whose target resolves outside the allowed directory**. Reads and Bash are not
fenced by freeze (use `/careful` for destructive-command guarding).

Set the boundary to **$ARGUMENTS** (or the current directory if no argument), preserving
any existing `careful` flag:

```bash
DIR="$ARGUMENTS"; [ -n "$DIR" ] || DIR="$PWD"
ABS="$(cd "$DIR" 2>/dev/null && pwd)" || { echo "No such directory: $DIR"; exit 1; }
STATE="$HOME/.claude/keystone-guard.json"
CAREFUL=false
[ -f "$STATE" ] && grep -q '"careful": *true' "$STATE" && CAREFUL=true
printf '{\n  "freeze": "%s",\n  "careful": %s\n}\n' "$ABS" "$CAREFUL" > "$STATE"
echo "🧊 Frozen. Edits restricted to: $ABS"
echo "   (careful mode: $CAREFUL). Run /unfreeze to lift."
```

After running it, confirm the active boundary to the user.
