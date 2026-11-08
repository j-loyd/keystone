#!/usr/bin/env node
"use strict";
// Tests for guard.js on Codex apply_patch calls. Codex runs the PreToolUse hook for its
// apply_patch tool (Write/Edit are matcher aliases) with tool_name "apply_patch" and
// tool_input { command: "<raw patch>" }. Every path in the patch must get the checks a
// Write/Edit to it gets. Codex 0.166 treats permissionDecision "ask" as unsupported and
// fails OPEN, so on a Codex payload every fail-closed case for a patch must DENY; the same
// payload without Codex's fields keeps the ask. Calls go through decide(), as main() does.
const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const guard = require("./guard.js");

const ENV = "." + "env"; // keep secret-looking literals out of this file's own text
const P = (...lines) => ["*** Begin Patch", ...lines, "*** End Patch"].join("\n");
const patch = (...lines) => ["apply_patch", { command: P(...lines) }];
const rawPatch = (command) => ["apply_patch", { command }];
const add = (p) => [`*** Add File: ${p}`, "+x"];
const upd = (p) => [`*** Update File: ${p}`, "@@", "-a", "+b"];
const del = (p) => [`*** Delete File: ${p}`];
const mv = (from, to) => [`*** Update File: ${from}`, `*** Move to: ${to}`, "@@", "-a", "+b"];

const FROZEN = { freeze: "/tmp/allowed" };
// Codex's PreToolUse payload always carries turn_id and model (codex-rs/hooks/src/schema.rs).
const CODEX = { session_id: "s-1", turn_id: "t-1", model: "gpt-test", hook_event_name: "PreToolUse" };
const CLAUDE = { session_id: "s-1", hook_event_name: "PreToolUse", tool_use_id: "toolu_1" };
function run(args, state = {}, cwd = "/tmp/allowed", env = {}, harness = CODEX) {
  return guard.decide({ ...harness, tool_name: args[0], tool_input: args[1], cwd }, env, state);
}
const decision = (...a) => {
  const r = run(...a);
  return r ? r.decision : "allow";
};
// The decision on a Claude Code payload (no Codex fields) for the same call.
const claude = (args, state = {}, cwd = "/tmp/allowed") => decision(args, state, cwd, {}, CLAUDE);

// ── Freeze boundary, per header kind ─────────────────────────────────────────
test("freeze: Add outside the boundary is denied, naming the path", () => {
  const r = run(patch(...add("/etc/outside.txt")), FROZEN);
  assert.equal(r.decision, "deny");
  assert.match(r.why, /\/etc\/outside\.txt/);
});
test("freeze: Update outside is denied", () =>
  assert.equal(decision(patch(...upd("/etc/outside.txt")), FROZEN), "deny"));
test("freeze: Delete outside is denied", () =>
  assert.equal(decision(patch(...del("/etc/outside.txt")), FROZEN), "deny"));
test("freeze: Move from inside to outside is denied", () =>
  assert.equal(decision(patch(...mv("/tmp/allowed/a.py", "/etc/a.py")), FROZEN), "deny"));
test("freeze: Move from outside to inside is denied", () =>
  assert.equal(decision(patch(...mv("/etc/a.py", "/tmp/allowed/a.py")), FROZEN), "deny"));
test("freeze: every path inside the boundary allows", () =>
  assert.equal(
    decision(
      patch(...add("/tmp/allowed/new.py"), ...upd("src/app.py"), ...del("old.py"), ...mv("a.py", "b/a.py")),
      FROZEN,
    ),
    "allow",
  ));
test("freeze: one bad path in a multi-file patch denies the whole patch", () => {
  const r = run(patch(...add("src/a.py"), ...upd("src/b.py"), ...add("/etc/bad.txt"), ...add("src/c.py")), FROZEN);
  assert.equal(r.decision, "deny");
  assert.match(r.why, /\/etc\/bad\.txt/);
});
test("freeze: relative paths resolve against the hook cwd", () => {
  assert.equal(decision(patch(...add("src/app.py")), FROZEN, "/tmp/allowed"), "allow");
  assert.equal(decision(patch(...add("src/app.py")), FROZEN, "/tmp/other"), "deny");
  assert.equal(decision(patch(...add("../escape.py")), FROZEN, "/tmp/allowed"), "deny");
});
test("no freeze: a patch anywhere is allowed", () =>
  assert.equal(decision(patch(...add("/etc/outside.txt"))), "allow"));
test("\\r\\n patch: outside denied, inside allowed", () => {
  const crlf = (...l) => rawPatch(P(...l).replace(/\n/g, "\r\n"));
  assert.equal(decision(crlf(...add("/etc/outside.txt")), FROZEN), "deny");
  assert.equal(decision(crlf(...add("/tmp/allowed/in.txt")), FROZEN), "allow");
});
test("heredoc-wrapped freeform patch is still checked", () =>
  assert.equal(
    decision(rawPatch(`<<'EOF'\n${P(...add("/etc/outside.txt"))}\nEOF`), FROZEN),
    "deny",
  ));

// ── Secret files, via each header kind (no freeze needed) ────────────────────
for (const [kind, lines] of [
  ["Add", add(ENV)],
  ["Update", upd(`/tmp/allowed/${ENV}`)],
  ["Delete", del(`config/${ENV}.local`)],
  ["Move destination", mv("notes.txt", ENV)],
  ["Move source", mv(`${ENV}`, "notes.txt")],
])
  test(`secret file via ${kind} is denied`, () => assert.equal(decision(patch(...lines)), "deny"));
test("secret file: an SSH key path is denied", () =>
  assert.equal(decision(patch(...add("/home/u/.ssh/id_" + "ed25519"))), "deny"));
test("secret file: a dot-segment path Codex normalizes onto the secret is denied", () => {
  assert.equal(decision(patch(...upd(`${ENV}/.`))), "deny");
  assert.equal(decision(patch(...upd(`${ENV}/x/..`))), "deny");
});
test("secret file: the NEL whitespace Codex trims cannot hide the name", () =>
  assert.equal(decision(patch(...add(`${ENV}\u0085`))), "deny"));
test("secret file: allowlisted templates still pass", () =>
  assert.equal(decision(patch(...add(`${ENV}.example`))), "allow"));
test("secret file: KEYSTONE_ALLOW_SECRETS=1 relaxes only the secret layer", () => {
  const env = { KEYSTONE_ALLOW_SECRETS: "1" };
  assert.equal(decision(patch(...add(ENV)), {}, "/tmp/allowed", env), "allow");
  assert.equal(decision(patch(...add("/etc/x")), FROZEN, "/tmp/allowed", env), "deny");
});
test("KEYSTONE_GUARD_OFF=1 disables the patch checks too", () =>
  assert.equal(decision(patch(...add(ENV)), FROZEN, "/tmp/allowed", { KEYSTONE_GUARD_OFF: "1" }), "allow"));

// ── Guard state file and corrupt state: an ask, which Codex would run → deny (apply_patch is Codex-only) ──
const SF = ["keystone", "guard.json"].join("-");
test("guard state file via a patch: deny on any payload (apply_patch is Codex-only)", () => {
  const r = run(patch(...upd(`/home/u/.claude/${SF}`)));
  assert.equal(r.decision, "deny");
  assert.match(r.why, /guard state file/);
  assert.match(r.why, /Codex hooks cannot ask/);
  assert.equal(claude(patch(...upd(`/home/u/.claude/${SF}`))), "deny");
});
test("guard state file via a Move destination: deny on any payload (apply_patch is Codex-only)", () => {
  assert.equal(decision(patch(...mv("x.json", SF))), "deny");
  assert.equal(claude(patch(...mv("x.json", SF))), "deny");
});
test("corrupt guard state: patches deny on any payload (apply_patch is Codex-only)", () => {
  const corrupt = { careful: true, corrupt: "invalid JSON" };
  assert.equal(decision(patch(...add("/tmp/allowed/a.py")), corrupt), "deny");
  assert.equal(claude(patch(...add("/tmp/allowed/a.py")), corrupt), "deny");
});

// ── Multi-environment patches ────────────────────────────────────────────────
test("Environment ID + relative path under a freeze: deny on any payload (apply_patch is Codex-only)", () => {
  assert.equal(decision(patch("*** Environment ID: remote-1", ...add("src/a.py")), FROZEN), "deny");
  assert.equal(claude(patch("*** Environment ID: remote-1", ...add("src/a.py")), FROZEN), "deny");
});
test("Environment ID + absolute path inside the freeze allows", () =>
  assert.equal(decision(patch("*** Environment ID: remote-1", ...add("/tmp/allowed/a.py")), FROZEN), "allow"));

// ── Malformed input fails closed (deny, since Codex drops ask) ────────────────
for (const [name, input] of [
  ["a non-string command (array)", { command: [P(...add("/etc/x"))] }],
  ["a non-string command (object)", { command: { patch: "x" } }],
  ["a missing command", {}],
  ["no envelope", { command: "*** Add File: /etc/x\n+x" }],
  ["no file headers", { command: P() }],
  ["an empty path", { command: P("*** Add File: ", "+x") }],
  ["a BOM-prefixed header Codex would reject", { command: P("\uFEFF*** Add File: a.py", "+x") }],
])
  test(`malformed patch: ${name}: deny on any payload (apply_patch is Codex-only)`, () => {
    assert.equal(decision(["apply_patch", input], {}), "deny");
    assert.equal(claude(["apply_patch", input], {}), "deny");
  });

// ── Shell heredoc form: Codex intercepts `apply_patch <<'EOF'` inside exec_command,
//    but the PreToolUse hook sees it as a Bash command. ──────────────────────
const sh = (body, prefix = "") => ["Bash", { command: `${prefix}apply_patch <<'EOF'\n${body}\nEOF` }];
test("shell form: a secret file is denied", () =>
  assert.equal(decision(sh(P(...add(ENV)))), "deny"));
test("shell form: outside the freeze is denied", () =>
  assert.equal(decision(sh(P(...add("/etc/outside.txt"))), FROZEN), "deny"));
test("shell form: inside the freeze allows", () =>
  assert.equal(decision(sh(P(...add("src/app.py"))), FROZEN), "allow"));
test("shell form: `cd <dir> &&` sets the base for relative paths", () => {
  assert.equal(decision(sh(P(...add("src/app.py")), "cd /tmp/allowed && "), FROZEN, "/tmp"), "allow");
  assert.equal(decision(sh(P(...add("src/app.py")), "cd /tmp/other && "), FROZEN, "/tmp/allowed"), "deny");
});
test("shell form: `applypatch` spelling is checked too", () =>
  assert.equal(
    decision(["Bash", { command: `applypatch <<'EOF'\n${P(...add(ENV))}\nEOF` }]),
    "deny",
  ));
// Codex also puts a real `apply_patch` binary on PATH (codex-rs/arg0), so non-heredoc
// shell forms apply patches too.
test("shell form: the patch as a quoted argument is checked", () =>
  assert.equal(decision(["Bash", { command: `apply_patch '${P(...add(ENV))}'` }]), "deny"));
test("shell form: a $'…' one-liner with \\n escapes is checked", () =>
  assert.equal(
    decision(["Bash", { command: `apply_patch $'${P(...add("/etc/outside.txt")).replace(/\n/g, "\\n")}'` }], FROZEN),
    "deny",
  ));
test("shell form: a command that only mentions apply_patch is unaffected", () =>
  assert.equal(decision(["Bash", { command: "grep -rn apply_patch src/" }], FROZEN), "allow"));

// ── main(): the real stdin shape Codex sends (codex-rs/hooks/src/schema.rs) ────
function viaMain(toolInput, state, cwd = "/tmp/allowed") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ks-patch-"));
  const stateFile = path.join(dir, "keystone-guard.json");
  if (state) fs.writeFileSync(stateFile, JSON.stringify(state));
  const r = spawnSync(process.execPath, [path.join(__dirname, "guard.js")], {
    input: JSON.stringify({
      session_id: "s-1",
      turn_id: "t-1",
      transcript_path: null,
      cwd,
      hook_event_name: "PreToolUse",
      model: "gpt-test",
      permission_mode: "default",
      tool_name: "apply_patch",
      tool_input: toolInput,
      tool_use_id: "call-1",
    }),
    encoding: "utf8",
    env: { ...process.env, KEYSTONE_GUARD_FILE: stateFile, KEYSTONE_GUARD_OFF: "" },
  });
  const o = JSON.parse(r.stdout || "{}");
  return o.hookSpecificOutput ? o.hookSpecificOutput.permissionDecision : "allow";
}
test("main(): Codex apply_patch outside the freeze is denied", () =>
  assert.equal(viaMain({ command: P(...add("/etc/outside.txt")) }, FROZEN), "deny"));
test("main(): Codex apply_patch to a secret file is denied", () =>
  assert.equal(viaMain({ command: P(...upd(`/tmp/allowed/${ENV}`)) }, FROZEN), "deny"));
test("main(): Codex apply_patch inside the freeze is allowed", () =>
  assert.equal(viaMain({ command: P(...add("src/app.py")) }, FROZEN), "allow"));
test("main(): Codex apply_patch with a non-string command is denied", () =>
  assert.equal(viaMain({ command: 7 }, null), "deny"));

// ── Hook timeouts fail OPEN in Codex, so long inputs must stay fast ──────────
function timedMain(command) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ks-patch-"));
  const stateFile = path.join(dir, "state.json");
  fs.writeFileSync(stateFile, JSON.stringify(FROZEN));
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, "guard.js")], {
    input: JSON.stringify({ ...CODEX, cwd: "/tmp/allowed", tool_name: "apply_patch", tool_input: { command } }),
    encoding: "utf8",
    env: { ...process.env, KEYSTONE_GUARD_FILE: stateFile, KEYSTONE_GUARD_OFF: "" },
  });
  const o = JSON.parse(r.stdout || "{}");
  return { ms: Date.now() - t0, decision: o.hookSpecificOutput ? o.hookSpecificOutput.permissionDecision : "allow" };
}
test("main(): a 200k-whitespace patch body is denied in under 1 s", () => {
  const r = timedMain(P(...add("/etc/outside.txt"), `+${" \t".repeat(100000)}x`));
  assert.equal(r.decision, "deny");
  assert.ok(r.ms < 1000, `took ${r.ms} ms`);
});
test("main(): 200k whitespace around the whole patch is denied in under 1 s", () => {
  const ws = " ".repeat(200000);
  const r = timedMain(`${ws}x${P(...add("/tmp/allowed/a.py"))}${ws}`);
  assert.equal(r.decision, "deny");
  assert.ok(r.ms < 1000, `took ${r.ms} ms`);
});
test("a 200 KB target path is checked in linear time, with the normal decision", () => {
  for (const [p, want] of [
    ["serviceaccount".repeat(14000) + ".jsonx", "allow"],
    ["/w/" + "serviceaccount".repeat(14000) + ".json", "deny"], // GCP service-account key
    ["/.config/gcloud/".repeat(12000), "allow"],
    ["/.config/gcloud/".repeat(12000) + "token", "deny"], // gcloud credentials
  ]) {
    let best = Infinity;
    let r;
    for (let i = 0; i < 2; i++) {
      const t0 = process.hrtime.bigint();
      r = run(patch(...add(p)));
      best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6);
    }
    assert.equal(r ? r.decision : "allow", want);
    assert.ok(best < 150, `took ${best.toFixed(1)} ms`);
  }
});
test("shell form: a long Bash command naming apply_patch stays fast", () => {
  // Best of 3 (after a warm-up run): this guards against super-linear blow-ups, which take
  // seconds, not against scheduler noise when every test file runs in parallel.
  const command = `apply_patch <<'EOF'\n${" ".repeat(100000)}x\n${P(...add("a.py"))}\nEOF`;
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const t0 = process.hrtime.bigint();
    decision(["Bash", { command }], FROZEN);
    if (i > 0) best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6);
  }
  assert.ok(best < 150, `took ${best.toFixed(1)} ms`);
});
