---
name: unfreeze
description: Lift all keystone guardrails — clears the freeze boundary and careful mode set by /freeze, /careful, or /guard.
allowed-tools:
  - Bash
---

# Unfreeze — lift the guardrails

Clear keystone's guard state file, removing any freeze boundary and careful mode. After
this, `guard.js` returns to its always-on baseline (catastrophic-command blocks + secret-
file blocks + SQL/Databricks confirmation), with no extra fencing.

```bash
STATE="$HOME/.claude/keystone-guard.json"
if [ -f "$STATE" ]; then rm -f "$STATE" && echo "🔓 Unfrozen — keystone guardrails lifted (baseline guard still active)."; else echo "Nothing to lift — no active freeze/careful state."; fi
```

Confirm to the user that the extra guardrails are off.
