#!/usr/bin/env node
"use strict";
// Tests for the harness split in guard.js. Codex CLI (0.166) treats permissionDecision "ask"
// as unsupported and runs the call, so on a Codex payload the guard-integrity and patch asks
// become denies. Claude Code payloads keep main's decisions. Careful-mode and SQL asks stay
// asks on both. Codex is recognized by the turn_id + model fields its PreToolUse stdin always
// carries (codex-rs/hooks/src/schema.rs); Claude Code's PreToolUse input has neither.
const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const guard = require("./guard.js");

const SF = ["keystone", "guard.json"].join("-"); // the guard state file's basename
const GS = "node /plugin/hooks/guard-state.js";
const P = (...l) => ["*** Begin Patch", ...l, "*** End Patch"].join("\n");

const CODEX = {
  session_id: "s-1",
  turn_id: "t-1",
  transcript_path: null,
  hook_event_name: "PreToolUse",
  model: "gpt-test",
  permission_mode: "default",
  tool_use_id: "call-1",
};
const CLAUDE = {
  session_id: "s-1",
  transcript_path: "/tmp/t.jsonl",
  permission_mode: "default",
  hook_event_name: "PreToolUse",
  tool_use_id: "toolu_1",
};
function on(harness, tool_name, tool_input, state = {}, cwd = "/tmp/allowed") {
  const r = guard.decide({ ...harness, tool_name, tool_input, cwd }, {}, state);
  return r ? r.decision : "allow";
}
const both = (...a) => [on(CODEX, ...a), on(CLAUDE, ...a)];

// ── Detection ────────────────────────────────────────────────────────────────
test("detection: a Codex payload (turn_id + model) is Codex", () =>
  assert.equal(guard.isCodexPayload({ ...CODEX, tool_name: "Bash" }), true));
test("detection: a Claude Code payload is not Codex", () =>
  assert.equal(guard.isCodexPayload({ ...CLAUDE, tool_name: "Bash" }), false));
test("detection: a payload with neither field is not Codex", () =>
  assert.equal(guard.isCodexPayload({ tool_name: "Bash", tool_input: { command: "ls" } }), false));
test("detection: only one of the two fields, or non-string values, is not Codex", () => {
  assert.equal(guard.isCodexPayload({ turn_id: "t-1" }), false);
  assert.equal(guard.isCodexPayload({ model: "m" }), false);
  assert.equal(guard.isCodexPayload({ turn_id: 1, model: "m" }), false);
  assert.equal(guard.isCodexPayload(null), false);
});
test("detection: an apply_patch payload is Codex even without turn_id/model", () => {
  assert.equal(guard.isCodexPayload({ tool_name: "apply_patch", tool_input: { command: "x" } }), true);
  // so a malformed patch still denies (never an ask that Codex would fail open on)
  const r = guard.decide(
    { tool_name: "apply_patch", tool_input: { command: "not a patch" }, cwd: "/tmp/allowed" },
    {},
    {},
  );
  assert.equal(r.decision, "deny");
});

// ── Guard-integrity asks: deny on Codex, ask on Claude Code ──────────────────
test("integrity: an echo into the state file → deny on Codex, ask on Claude Code", () =>
  assert.deepEqual(both("Bash", { command: `echo '{}' > ~/.claude/${SF}` }), ["deny", "ask"]));
test("integrity: a protection-removing guard-state.js call → deny on Codex, ask on Claude Code", () =>
  assert.deepEqual(both("Bash", { command: `${GS} off` }, { freeze: "/tmp/allowed" }), ["deny", "ask"]));
test("integrity: a Write to the state file → deny on Codex, ask on Claude Code", () =>
  assert.deepEqual(both("Write", { file_path: `/home/u/.claude/${SF}` }), ["deny", "ask"]));
test("integrity: a protective guard-state.js call is allowed on both", () =>
  assert.deepEqual(both("Bash", { command: `${GS} status` }), ["allow", "allow"]));

// ── Patch checks: deny on Codex, ask on Claude Code ──────────────────────────
test("apply_patch: a malformed patch → deny on any payload (apply_patch is Codex-only)", () =>
  assert.deepEqual(both("apply_patch", { command: "*** Add File: a.py\n+x" }), ["deny", "deny"]));
test("shell form: a patch naming the state file → deny on Codex; Claude Code keeps main's ask", () =>
  assert.deepEqual(both("Bash", { command: `apply_patch <<'EOF'\n${P(`*** Add File: ${SF}`, "+{}")}\nEOF` }), [
    "deny",
    "ask",
  ]));
test("shell form: a secret-file patch is denied on Codex; Claude Code keeps main's allow", () =>
  assert.deepEqual(both("Bash", { command: `apply_patch <<'EOF'\n${P("*** Add File: ." + "env", "+x")}\nEOF` }), [
    "deny",
    "allow",
  ]));

// ── Every other ask stays an ask on both (Codex ignores it) ──────────────────
test("careful mode: an ask on both harnesses", () =>
  assert.deepEqual(both("Bash", { command: "git push origin main" }, { careful: true }), ["ask", "ask"]));
test("SQL guard: an ask on both harnesses", () =>
  assert.deepEqual(both("Bash", { command: "psql -c 'DROP TABLE users'" }), ["ask", "ask"]));
test("deny layers deny on both harnesses", () =>
  assert.deepEqual(both("Bash", { command: "r" + "m -rf ~" }), ["deny", "deny"]));

// ── Reviewer's Claude Code regressions: back to main's decisions ─────────────
const docs = (hdr) => `cat > docs/codex.md <<'EOF'\nCodex applies patches with apply_patch:\n${P(hdr, "+x")}\nEOF`;
const CORRUPT = { careful: true, corrupt: "invalid JSON" };
test("Claude Code: a docs heredoc naming the state file asks (main: ask), not deny", () =>
  assert.equal(on(CLAUDE, "Bash", { command: docs(`*** Add File: ${SF}`) }), "ask"));
test("Claude Code: a docs heredoc under a corrupt state file is unchanged (main: allow)", () =>
  assert.equal(on(CLAUDE, "Bash", { command: docs("*** Add File: src/app.py") }, CORRUPT), "allow"));
test("Claude Code: a docs heredoc naming the state file under a corrupt state asks (main: ask)", () =>
  assert.equal(on(CLAUDE, "Bash", { command: docs(`*** Add File: ${SF}`) }, CORRUPT), "ask"));

// ── main(): the same split over real stdin ───────────────────────────────────
function viaMain(harness, tool_name, tool_input) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ks-harness-"));
  const stateFile = path.join(dir, "state.json");
  fs.writeFileSync(stateFile, JSON.stringify({ freeze: "/tmp/allowed" }));
  const r = spawnSync(process.execPath, [path.join(__dirname, "guard.js")], {
    input: JSON.stringify({ ...harness, cwd: "/tmp/allowed", tool_name, tool_input }),
    encoding: "utf8",
    env: { ...process.env, KEYSTONE_GUARD_FILE: stateFile, KEYSTONE_GUARD_OFF: "" },
  });
  const o = JSON.parse(r.stdout || "{}");
  return o.hookSpecificOutput ? o.hookSpecificOutput.permissionDecision : "allow";
}
test("main(): guard-state.js off → deny on Codex, ask on Claude Code", () => {
  assert.equal(viaMain(CODEX, "Bash", { command: `${GS} off` }), "deny");
  assert.equal(viaMain(CLAUDE, "Bash", { command: `${GS} off` }), "ask");
});

// ── Fail closed when guard itself breaks ──────────────────────────────────────
function spawnGuard(guardPath, payload, preload) {
  const args = preload ? ["-r", preload, guardPath] : [guardPath];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ks-broken-"));
  const r = spawnSync(process.execPath, args, {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, KEYSTONE_GUARD_FILE: path.join(dir, "state.json"), KEYSTONE_GUARD_OFF: "" },
  });
  const o = JSON.parse(r.stdout || "{}");
  return o.hookSpecificOutput ? o.hookSpecificOutput.permissionDecision : "allow";
}
const SHELL_PATCH = `apply_patch <<'EOF'\n${P("*** Add File: a.py", "+x")}\nEOF`;
test("main(): an internal error denies ANY Codex call, and asks on Claude Code", () => {
  // Preload a stub that makes path.resolve throw once guard.js has loaded, so evaluating an
  // ordinary Bash call throws inside main() and reaches its catch.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ks-throw-"));
  const preload = path.join(dir, "throw.js");
  fs.writeFileSync(
    preload,
    'process.nextTick(() => { require("path").resolve = () => { throw new Error("boom"); }; });\n',
  );
  const G = path.join(__dirname, "guard.js");
  const call = { cwd: "/tmp/allowed", tool_name: "Bash", tool_input: { command: "ls -la" } };
  assert.equal(spawnGuard(G, { ...CODEX, ...call }, preload), "deny");
  assert.equal(spawnGuard(G, { ...CLAUDE, ...call }, preload), "ask");
  assert.equal(spawnGuard(G, { ...CODEX, ...call }), "allow"); // without the stub: no error
});
test("main(): with patch-paths.js missing, a Codex shell patch is denied and other calls still work", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ks-nopp-"));
  const G = path.join(dir, "guard.js");
  fs.copyFileSync(path.join(__dirname, "guard.js"), G); // no patch-paths.js beside it
  assert.equal(spawnGuard(G, { ...CODEX, cwd: "/tmp/allowed", tool_name: "Bash", tool_input: { command: SHELL_PATCH } }), "deny");
  assert.equal(spawnGuard(G, { ...CODEX, cwd: "/tmp/allowed", tool_name: "apply_patch", tool_input: { command: P("*** Add File: a.py", "+x") } }), "deny");
  assert.equal(spawnGuard(G, { ...CODEX, cwd: "/tmp/allowed", tool_name: "Bash", tool_input: { command: "ls -la" } }), "allow");
  assert.equal(spawnGuard(G, { ...CLAUDE, cwd: "/tmp/allowed", tool_name: "Bash", tool_input: { command: "r" + "m -rf ~" } }), "deny");
});
