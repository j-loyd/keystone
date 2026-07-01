---
name: careful
description: Turn on careful mode — guard.js asks for confirmation before a broader set of destructive Bash commands (rm -rf, git push, overwrite/move) on top of its always-on catastrophic blocks.
allowed-tools:
  - Bash
---

# Careful — confirm before destructive commands

Raise the safety bar for this machine. With careful mode on, keystone's `guard.js`
escalates a broader set of destructive shell commands to **ask** (a confirmation prompt)
— things that are legitimate but you never want to run on autopilot: `rm -rf`,
`git push`, force operations, bulk overwrite/move. guard.js still **hard-blocks** the
truly catastrophic commands and secret-file access regardless of this flag.

Enable it (preserving any active freeze boundary):

```bash
STATE="$HOME/.claude/keystone-guard.json"
FREEZE=null
[ -f "$STATE" ] && FREEZE="$(grep -o '"freeze": *"[^"]*"' "$STATE" | sed 's/.*: *//')"
[ -z "$FREEZE" ] && FREEZE=null
printf '{\n  "freeze": %s,\n  "careful": true\n}\n' "$FREEZE" > "$STATE"
echo "⚠️  Careful mode ON (freeze boundary: $FREEZE). Run /unfreeze to lift."
```

Confirm to the user that careful mode is active.
