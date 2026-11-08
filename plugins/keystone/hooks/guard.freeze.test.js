#!/usr/bin/env node
"use strict";
// Tests for the opt-in freeze/careful layer added to guard.js (keystone).
const { test } = require("node:test");
const assert = require("node:assert");
const guard = require("./guard.js");

const bash = (command) => ["Bash", { command }];
const read = (file_path) => ["Read", { file_path }];
const write = (file_path) => ["Write", { file_path }];

// evaluate(toolName, toolInput, env, cwd, state) — explicit state keeps tests hermetic.
function decide(args, state = {}, cwd = "") {
  const r = guard.evaluate(...args, {}, cwd, state);
  return r ? r.decision : "allow";
}

const FROZEN = { freeze: "/tmp/safe" };
const CAREFUL_ON = { careful: true };

test("freeze: allows write inside the boundary", () =>
  assert.equal(decide(write("/tmp/safe/a.txt"), FROZEN, "/tmp/safe"), "allow"));
test("freeze: denies write outside the boundary", () =>
  assert.equal(decide(write("/etc/hosts"), FROZEN, "/tmp/safe"), "deny"));
test("freeze: does NOT fence Read (edits only)", () =>
  assert.equal(decide(read("/etc/hosts"), FROZEN, "/tmp/safe"), "allow"));
test("freeze: resolves a relative path against cwd", () =>
  assert.equal(decide(write("a.txt"), FROZEN, "/tmp/safe"), "allow"));
test("no freeze state: write anywhere is allowed", () =>
  assert.equal(decide(write("/etc/hosts"), {}, "/tmp"), "allow"));

test("careful: git push escalates to ask", () =>
  assert.equal(decide(bash("git push origin main"), CAREFUL_ON), "ask"));
test("careful: recursive rm escalates to ask", () =>
  assert.equal(decide(bash("rm -rf build/"), CAREFUL_ON), "ask"));
test("careful OFF: ordinary push stays allowed", () =>
  assert.equal(decide(bash("git push origin feature"), {}), "allow"));
test("careful never downgrades a hard deny", () =>
  assert.equal(decide(bash("rm -fr ~"), CAREFUL_ON), "deny"));

test("isInside: nested true; sibling and escape false", () => {
  assert.equal(guard.isInside("/tmp/safe", "/tmp/safe/x"), true);
  assert.equal(guard.isInside("/tmp/safe", "/tmp/other"), false);
  assert.equal(guard.isInside("/tmp/safe", "/tmp/safe/../escape"), false);
});

// ── Guard state file: direct manipulation asks; protection-removing toggles ask ──
// The user-run /unfreeze executes through the same Bash tool the model uses, so a hook
// cannot tell who initiated it. Removing protection therefore always needs a human "yes".
const os = require("node:os");
const path = require("node:path");
const STATE_PATH = path.join(os.homedir(), ".claude", "keystone-guard.json");
const GS = "node /plugin/hooks/guard-state.js";

for (const cmd of [
  "rm ~/.claude/keystone-guard.json",
  `rm -f "${STATE_PATH}"`,
  "echo '{}' > ~/.claude/keystone-guard.json",
  "sed -i '' 's/true/false/' ~/.claude/keystone-guard.json",
  "mv ~/.claude/KEYSTONE-GUARD.JSON /tmp/x",
  "cat ~/.claude/keystone-guard.json",
  // Quote / backslash / empty-substitution splits inside the name (bash rejoins them).
  "rm ~/.claude/keystone-gu''ard.json",
  "rm ~/.claude/keystone\\-guard.json",
  'printf x >> ~/.claude/keystone-gu""ard.json',
  "rm ~/.claude/k'eystone-guard'.json",
  "rm ~/.claude/keystone-gu``ard.json",
  "rm ~/.claude/keystone-gu$()ard.json",
  "rm ~/.claude/keystone-gu$''ard.json",
])
  test(`state file: Bash touching it asks: ${JSON.stringify(cmd)}`, () =>
    assert.equal(decide(bash(cmd), FROZEN), "ask"));

test("state file: Write/Edit of it asks (no freeze active)", () => {
  assert.equal(decide(write(STATE_PATH), {}), "ask");
  assert.equal(decide(["Edit", { file_path: STATE_PATH }], {}), "ask");
  assert.equal(decide(write("/elsewhere/keystone-guard.json"), {}), "ask");
});
test("state file: freeze deny still wins over the state-file ask", () =>
  assert.equal(decide(write(STATE_PATH), FROZEN, "/tmp/safe"), "deny"));
test("state file: Read of it is not gated", () =>
  assert.equal(decide(read(STATE_PATH), {}), "allow"));
test("state file: a hard deny in the same command still denies", () =>
  assert.equal(decide(bash("rm ~/.claude/keystone-guard.json; " + "r" + "m -rf ~"), {}), "deny"));

// guard-state.js: protection-ADDING forms pass, protection-REMOVING (or unclear) forms ask.
for (const [cmd, state] of [
  [`${GS} status`, FROZEN],
  [`${GS} careful on`, FROZEN],
  [`${GS} freeze /tmp/safe`, {}],
  [`${GS} freeze`, {}],
  [`${GS} guard /tmp/safe`, {}],
  [`${GS} guard`, CAREFUL_ON],
  [`node "/plugin root/hooks/guard-state.js" freeze "/tmp/my dir"`, {}],
])
  test(`guard-state: protective form allowed: ${JSON.stringify(cmd)}`, () =>
    assert.equal(decide(bash(cmd), state), "allow"));

for (const [cmd, state] of [
  [`${GS} unfreeze`, FROZEN],
  [`${GS} unfreeze`, {}],
  [`${GS} careful off`, CAREFUL_ON],
  [`${GS} freeze /`, FROZEN], // re-freezing while frozen could widen the boundary
  [`${GS} guard /`, FROZEN],
  [`${GS} careful on off`, FROZEN], // extra args: not an exact safe form
  [`${GS} "unfreeze"`, FROZEN],
  [`${GS} $(echo unfreeze)`, FROZEN],
  [`${GS} status; ${GS} unfreeze`, FROZEN],
  [`${GS} careful on && ${GS} careful off`, FROZEN],
  [`node -e "require('/plugin/hooks/guard-state.js')"`, FROZEN],
  ["cp /plugin/hooks/guard-state.js /tmp/x.js", FROZEN],
  [`${GS}`, FROZEN],
  // Quote / backslash splits that bash rejoins into guard-state.js.
  ["node /p/hooks/guard-stat''e.js unfreeze", FROZEN],
  ["node /p/hooks/guard\\-state.js careful off", FROZEN],
  [`${GS} careful on; node /p/hooks/guard-sta""te.js unfreeze`, FROZEN],
  ["node /p/hooks/guard-st``ate.js unfreeze", {}],
  ["node /p/hooks/guard-state.j's' careful off", CAREFUL_ON],
  // Decoy: a quote-glued "safe" mention that vanishes once dequoted, hiding a split call.
  [`node /p/hooks/guard-state.js"status;" ; node /p/hooks/guard-sta''te.js unfreeze`, FROZEN],
  [`node /p/hooks/guard-state.js"careful on;" ; node /p/hooks/guard-sta''te.js unfreeze`, FROZEN],
  [`node /p/hooks/guard-state.js'status' unfreeze`, FROZEN],
])
  test(`guard-state: removing/unclear form asks: ${JSON.stringify(cmd)}`, () =>
    assert.equal(decide(bash(cmd), state), "ask"));

test("guard-state: an allowed form does not launder the rest of the command", () => {
  assert.equal(decide(bash(`${GS} status; ` + "r" + "m -rf ~"), FROZEN), "deny");
  assert.equal(decide(bash(`${GS} careful on && git push origin x`), CAREFUL_ON), "ask");
});
test("guard-state: reading the script by its test-file name is not an invocation", () =>
  assert.equal(decide(bash("node --test hooks/guard-state.test.js"), FROZEN), "allow"));

// The shipped command files, as the harness expands them, must route as intended:
// protection-adding commands run unprompted, /unfreeze asks.
const fs = require("node:fs");
// Claude Code substitutes ${CLAUDE_PLUGIN_ROOT}; Codex leaves it empty and the two-step
// fallback picks up $PLUGIN_ROOT — both expansions must route the same way.
const ROOTS = { claude: "/Users/u/.claude/plugins/cache/keystone/9.9.9", codex: "" };
function commandBash(name, args, root = ROOTS.claude) {
  const md = fs.readFileSync(path.join(__dirname, "..", "commands", `${name}.md`), "utf8");
  const block = md.match(/```bash\n([\s\S]*?)```/)[1].trim();
  return block.split("${CLAUDE_PLUGIN_ROOT}").join(root).split("$ARGUMENTS").join(args);
}
for (const harness of Object.keys(ROOTS))
for (const [name, args, state, want] of [
  ["freeze", "", {}, "allow"],
  ["freeze", "/tmp/safe", {}, "allow"],
  ["guard", "", {}, "allow"],
  ["careful", "", FROZEN, "allow"],
  ["freeze", "/", FROZEN, "ask"],
  ["guard", "", FROZEN, "ask"],
  ["unfreeze", "", FROZEN, "ask"],
])
  test(`command file /${name} ${JSON.stringify(args)} (${harness}) routes to ${want}`, () =>
    assert.equal(decide(bash(commandBash(name, args, ROOTS[harness])), state), want));

test("guard command files are user-only and use the two-harness plugin-root fallback", () => {
  for (const name of ["careful", "freeze", "unfreeze", "guard"]) {
    const md = fs.readFileSync(path.join(__dirname, "..", "commands", `${name}.md`), "utf8");
    const fm = md.split("---")[1];
    assert.match(fm, /^disable-model-invocation: true$/m, name);
    assert.ok(
      md.includes('R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/hooks/guard.js" ] || R="${PLUGIN_ROOT}"\nnode "$R/hooks/guard-state.js"'),
      name,
    );
    assert.doesNotMatch(md, /keystone-guard\.json|printf/, name);
  }
});

// ── readState: only a MISSING file means "no state"; anything else unreadable fails closed ─
// A corrupt file used to read as {} — silently lifting an active freeze/careful.
function stateFile(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ks-readstate-"));
  const file = path.join(dir, "keystone-guard.json");
  if (text !== undefined) fs.writeFileSync(file, text);
  return file;
}
const VALID = JSON.stringify({ freeze: "/tmp/safe", careful: true });

test("readState: missing file → no extra restrictions", () =>
  assert.deepStrictEqual(guard.readState(stateFile()), {}));
test("readState: missing parent directory → no extra restrictions", () =>
  assert.deepStrictEqual(guard.readState(path.join(stateFile(), "x", "y.json")), {}));
test("readState: valid state passes through", () =>
  assert.deepStrictEqual(guard.readState(stateFile(VALID)), { freeze: "/tmp/safe", careful: true }));
test("readState: {} and {freeze:null} are valid empty state", () => {
  assert.deepStrictEqual(guard.readState(stateFile("{}")), {});
  assert.deepStrictEqual(guard.readState(stateFile('{"freeze":null,"careful":false}')), {
    freeze: null,
    careful: false,
  });
});
for (const [label, text] of [
  ["trailing garbage", VALID + "x"],
  ["empty file", ""],
  ["freeze is a number", '{"freeze":123}'],
  ["freeze is an object", '{"freeze":{}}'],
  ["freeze is relative", '{"freeze":"tmp/safe"}'],
  ["freeze is empty string", '{"freeze":""}'],
  ["careful is a string", '{"careful":"yes"}'],
  ["null", "null"],
  ["array", "[]"],
  ["bare string", '"str"'],
])
  test(`readState: ${label} fails closed (careful on + corrupt marker)`, () => {
    const s = guard.readState(stateFile(text));
    assert.strictEqual(s.careful, true);
    assert.ok(typeof s.corrupt === "string" && s.corrupt.length, JSON.stringify(s));
    assert.ok(!s.freeze);
  });
test("readState: a directory where the file should be (EISDIR) fails closed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ks-readstate-"));
  assert.ok(guard.readState(dir).corrupt);
});

const CORRUPT = { careful: true, corrupt: "invalid JSON" };
test("corrupt state: every Write/Edit asks", () => {
  assert.equal(decide(write("/tmp/safe/a.txt"), CORRUPT, "/tmp/safe"), "ask");
  assert.equal(decide(["Edit", { file_path: "/anywhere/b.js" }], CORRUPT), "ask");
});
test("corrupt state: careful-mode Bash asks, ordinary Bash and Read pass", () => {
  assert.equal(decide(bash("rm -rf build/"), CORRUPT), "ask");
  assert.equal(decide(bash("ls"), CORRUPT), "allow");
  assert.equal(decide(read("/tmp/x"), CORRUPT), "allow");
});
test("corrupt state: hard denies still deny", () => {
  assert.equal(decide(bash("r" + "m -rf ~"), CORRUPT), "deny");
  assert.equal(decide(read("/p/" + ".env"), CORRUPT), "deny");
});
test("corrupt state: guard-state status runs; any write through it asks (boundary unknown)", () => {
  assert.equal(decide(bash(`${GS} status`), CORRUPT), "allow");
  assert.equal(decide(bash(`${GS} freeze /tmp/safe`), CORRUPT), "ask");
  assert.equal(decide(bash(`${GS} careful on`), CORRUPT), "ask");
});
test("unreadable state path: the ask reason says to fix it by hand, not via /freeze", () => {
  const why = guard.evaluate("Write", { file_path: "/tmp/a" }, {}, "", {
    careful: true,
    corrupt: "unreadable (EISDIR)",
  }).why;
  assert.match(why, /by hand/);
  assert.doesNotMatch(why, /\/freeze/);
});
test("corrupt state: the ask reason says how to repair", () =>
  assert.match(
    guard.evaluate("Write", { file_path: "/tmp/a" }, {}, "", CORRUPT).why,
    /guard-state\.js status|\/freeze/,
  ));
