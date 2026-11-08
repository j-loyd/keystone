---
name: unfreeze
description: Lift all keystone guardrails — clears the freeze boundary and careful mode set by /freeze, /careful, or /guard.
disable-model-invocation: true
allowed-tools:
  - Bash
---

# Unfreeze — lift the guardrails

Clear keystone's guard state file, removing any freeze boundary and careful mode. After
this, `guard.js` returns to its always-on baseline (catastrophic-command blocks + secret-
file blocks + SQL/Databricks confirmation), with no extra fencing.

```bash
R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"
node "$R/hooks/guard-state.js" unfreeze
```

Expect a confirmation prompt: guard.js always asks before guardrails are removed, because
a hook cannot tell a user-typed `/unfreeze` from the model running the same command.
Confirm to the user that the extra guardrails are off.
