"use strict";
/**
 * hooks-config.test.js — config-lint for hooks.json against the Claude Code hook schema.
 *
 * This is the regression guard for the PreCompact/PostCompact bug class: a hook that emits
 * hookSpecificOutput.additionalContext on an event that does NOT honor that field, so the
 * context is silently dropped. It validates the declaration, not the runtime behavior.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const HOOKS_JSON = path.join(__dirname, "hooks.json");
const raw = fs.readFileSync(HOOKS_JSON, "utf8");

// Full set of real Claude Code hook events (from the hooks reference). Used to catch typos.
const KNOWN_EVENTS = new Set([
  "SessionStart",
  "Setup",
  "UserPromptSubmit",
  "UserPromptExpansion",
  "PreToolUse",
  "PermissionRequest",
  "PermissionDenied",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "Notification",
  "MessageDisplay",
  "SubagentStart",
  "SubagentStop",
  "TaskCreated",
  "TaskCompleted",
  "Stop",
  "StopFailure",
  "TeammateIdle",
  "InstructionsLoaded",
  "ConfigChange",
  "CwdChanged",
  "FileChanged",
  "WorktreeCreate",
  "WorktreeRemove",
  "PreCompact",
  "PostCompact",
  "Elicitation",
  "ElicitationResult",
  "SessionEnd",
]);

// Events that honor hookSpecificOutput.additionalContext (context injection).
// PreCompact / PostCompact / Notification are deliberately ABSENT — they do not honor it.
const ADDITIONAL_CONTEXT_EVENTS = new Set([
  "SessionStart",
  "Setup",
  "SubagentStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "Stop",
  "SubagentStop",
]);

// Events that honor a permission decision (permissionDecision / permissionDecisionReason).
const PERMISSION_EVENTS = new Set(["PreToolUse", "PermissionRequest"]);

// The command string for `node …/foo.js` invocations doesn't reveal the output field,
// so map the bundled scripts to what they emit.
const SCRIPTS_EMITTING_ADDITIONAL_CONTEXT = [
  "instincts.js",
  "learnings.js",
  "scan.js",
];
const SCRIPTS_EMITTING_PERMISSION_DECISION = ["guard.js"];

const parsed = () => JSON.parse(raw);

function emitsAdditionalContext(cmd) {
  return (
    cmd.includes("additionalContext") ||
    SCRIPTS_EMITTING_ADDITIONAL_CONTEXT.some((s) => cmd.includes(s))
  );
}
function emitsPermissionDecision(cmd) {
  return (
    cmd.includes("permissionDecision") ||
    SCRIPTS_EMITTING_PERMISSION_DECISION.some((s) => cmd.includes(s))
  );
}

// Flatten to [{event, matcher, command, hook}].
function eachHook() {
  const out = [];
  const cfg = parsed().hooks || {};
  for (const [event, groups] of Object.entries(cfg)) {
    for (const group of groups) {
      for (const h of group.hooks || []) {
        out.push({
          event,
          matcher: group.matcher,
          command: h.command || "",
          hook: h,
        });
      }
    }
  }
  return out;
}

test("hooks.json is valid JSON with a top-level hooks object", () => {
  const obj = parsed();
  assert.ok(obj && typeof obj.hooks === "object", "missing hooks object");
});

test("every declared hook event is a real Claude Code event", () => {
  for (const event of Object.keys(parsed().hooks)) {
    assert.ok(KNOWN_EVENTS.has(event), `unknown hook event: ${event}`);
  }
});

test("additionalContext is only emitted on events that honor it", () => {
  for (const { event, command } of eachHook()) {
    if (emitsAdditionalContext(command)) {
      assert.ok(
        ADDITIONAL_CONTEXT_EVENTS.has(event),
        `${event} hook emits additionalContext, but that event does not honor it ` +
          `— it would be silently dropped (the PreCompact/PostCompact bug class)`,
      );
    }
  }
});

test("permissionDecision is only emitted on events that honor it", () => {
  for (const { event, command } of eachHook()) {
    if (emitsPermissionDecision(command)) {
      assert.ok(
        PERMISSION_EVENTS.has(event),
        `${event} hook emits permissionDecision, but only ${[...PERMISSION_EVENTS].join("/")} honor it`,
      );
    }
  }
});

test("every referenced bundled hook script exists", () => {
  for (const { command } of eachHook()) {
    const refs = command.match(/\/hooks\/[\w.-]+\.js/g) || [];
    for (const ref of refs) {
      const file = ref.split("/").pop();
      assert.ok(
        fs.existsSync(path.join(__dirname, file)),
        `hooks.json references ${file}, which does not exist in hooks/`,
      );
    }
  }
});

// Bundled node hooks must resolve the plugin root via ${CLAUDE_PLUGIN_ROOT} (inline-substituted
// by Claude Code at parse time) with a ${PLUGIN_ROOT} fallback (exported by Codex-style
// harnesses), and must degrade to exit 0 when the script is missing — a plugin update that
// replaces the version directory mid-session otherwise turns every hook into exit-1 spam.
test("node hook commands carry the root-fallback chain and a missing-script degrade path", () => {
  for (const { command } of eachHook()) {
    if (!command.includes("/hooks/") || !command.includes(".js")) continue;
    assert.ok(
      command.includes("${CLAUDE_PLUGIN_ROOT}"),
      `node hook command should reference \${CLAUDE_PLUGIN_ROOT}: ${command}`,
    );
    assert.ok(
      command.includes("${PLUGIN_ROOT}"),
      `node hook command should fall back to \${PLUGIN_ROOT}: ${command}`,
    );
    assert.ok(
      command.includes("systemMessage") || command.includes("|| true"),
      `node hook command must not exit nonzero when its script is missing: ${command}`,
    );
  }
});

test("every hook with a timeout uses a numeric value", () => {
  for (const { hook, event } of eachHook()) {
    if ("timeout" in hook) {
      assert.ok(
        Number.isFinite(hook.timeout),
        `${event} hook has a non-numeric timeout`,
      );
    }
  }
});
