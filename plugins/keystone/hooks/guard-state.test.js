#!/usr/bin/env node
"use strict";
// Tests for guard-state.js — the JSON-safe writer behind the /guard skill.
// Every run points KEYSTONE_GUARD_FILE at a fresh temp file; the real home state file is
// never read or written.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const guard = require("./guard.js");

const CLI = path.join(__dirname, "guard-state.js");

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ks-guard-state-"));
  return { dir, file: path.join(dir, "nested", "keystone-guard.json") };
}

function run(file, args, cwd, extraEnv = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: cwd || os.tmpdir(),
    env: { ...process.env, ...extraEnv, KEYSTONE_GUARD_FILE: file },
    encoding: "utf8",
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

test("freeze writes valid JSON for a directory containing a quote and a backslash", () => {
  const { dir, file } = sandbox();
  const tricky = path.join(dir, 'we"ird\\name');
  fs.mkdirSync(tricky);
  const r = run(file, ["freeze", tricky]);
  assert.strictEqual(r.code, 0, r.out);
  // The guard reads it back exactly — previously printf-built JSON broke here and
  // readState() failed open, silently disabling the freeze.
  assert.strictEqual(guard.readState(file).freeze, tricky);
  assert.strictEqual(readJson(file).careful, false);
});

test("freeze defaults to the working directory, keeping the shell's logical path", () => {
  // os.tmpdir() is behind a symlink on macOS (/var -> /private/var). The old `cd && pwd`
  // recorded the logical path; a realpath'd boundary would deny edits made via the
  // logical path the harness actually uses.
  const { dir, file } = sandbox();
  const r = run(file, ["freeze"], dir, { PWD: dir });
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(readJson(file).freeze, dir);
});

test("freeze ignores a stale PWD that does not match the real working directory", () => {
  const { dir, file } = sandbox();
  const r = run(file, ["freeze"], dir, { PWD: os.homedir() });
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(fs.realpathSync(readJson(file).freeze), fs.realpathSync(dir));
});

test("freeze with an empty-string argument also defaults to the working directory", () => {
  const { dir, file } = sandbox();
  const r = run(file, ["freeze", ""], dir);
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(readJson(file).freeze);
});

test("freeze resolves a relative directory against the working directory", () => {
  const { dir, file } = sandbox();
  fs.mkdirSync(path.join(dir, "sub"));
  const r = run(file, ["freeze", "sub"], dir, { PWD: dir });
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(readJson(file).freeze, path.join(dir, "sub"));
});

test("freeze rejects a missing directory and writes nothing", () => {
  const { dir, file } = sandbox();
  const r = run(file, ["freeze", path.join(dir, "nope")]);
  assert.notStrictEqual(r.code, 0);
  assert.strictEqual(fs.existsSync(file), false);
});

test("freeze rejects a file (not a directory)", () => {
  const { dir, file } = sandbox();
  const f = path.join(dir, "plain.txt");
  fs.writeFileSync(f, "x");
  assert.notStrictEqual(run(file, ["freeze", f]).code, 0);
  assert.strictEqual(fs.existsSync(file), false);
});

test("freeze preserves an active careful flag; careful on preserves the boundary", () => {
  const { dir, file } = sandbox();
  assert.strictEqual(run(file, ["careful", "on"]).code, 0);
  assert.deepStrictEqual(readJson(file), { freeze: null, careful: true });
  assert.strictEqual(run(file, ["freeze", dir]).code, 0);
  assert.deepStrictEqual(readJson(file), { freeze: dir, careful: true });
  assert.strictEqual(run(file, ["careful", "off"]).code, 0);
  assert.deepStrictEqual(readJson(file), { freeze: dir, careful: false });
  assert.strictEqual(run(file, ["careful", "on"]).code, 0);
  assert.deepStrictEqual(readJson(file), { freeze: dir, careful: true });
});

test("guard sets both the boundary and careful mode", () => {
  const { dir, file } = sandbox();
  const r = run(file, ["guard", dir]);
  assert.strictEqual(r.code, 0, r.out);
  assert.deepStrictEqual(readJson(file), { freeze: dir, careful: true });
});

test("unfreeze removes the state file; a second unfreeze is a no-op success", () => {
  const { dir, file } = sandbox();
  run(file, ["guard", dir]);
  const r = run(file, ["unfreeze"]);
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(fs.existsSync(file), false);
  const again = run(file, ["unfreeze"]);
  assert.strictEqual(again.code, 0);
  assert.match(again.out, /Nothing to lift/);
});

test("status reports the active state and the no-state case", () => {
  const { dir, file } = sandbox();
  assert.match(run(file, ["status"]).out, /no active/i);
  run(file, ["guard", dir]);
  const r = run(file, ["status"]);
  assert.strictEqual(r.code, 0);
  assert.ok(r.out.includes(dir), r.out);
  assert.match(r.out, /careful: on/);
});

test("a corrupt state file is reported by status and replaced by a valid write", () => {
  const { dir, file } = sandbox();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"freeze": "/a"b"}');
  assert.match(run(file, ["status"]).out, /unreadable/i);
  assert.strictEqual(run(file, ["freeze", dir]).code, 0);
  assert.deepStrictEqual(readJson(file), { freeze: dir, careful: false });
});

for (const bad of ['{"freeze":123}', '{"freeze":"rel/dir"}', '{"careful":"yes"}', "null", "[]"])
  test(`wrong-shape state ${bad} is reported unreadable and repaired by freeze`, () => {
    const { dir, file } = sandbox();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bad);
    assert.match(run(file, ["status"]).out, /unreadable/i);
    const r = run(file, ["freeze", dir]);
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /replacing unreadable/);
    assert.deepStrictEqual(guard.readState(file), { freeze: dir, careful: false });
  });

test("writes leave no temp files behind", () => {
  const { dir, file } = sandbox();
  run(file, ["guard", dir]);
  run(file, ["careful", "off"]);
  assert.deepStrictEqual(fs.readdirSync(path.dirname(file)), ["keystone-guard.json"]);
});

for (const args of [
  [],
  ["bogus"],
  ["careful"],
  ["careful", "maybe"],
  ["careful", "on", "off"],
  ["unfreeze", "now"],
  ["status", "x"],
  ["freeze", "/tmp", "extra"],
])
  test(`strict arity: ${JSON.stringify(args)} is rejected and writes nothing`, () => {
    const { file } = sandbox();
    const r = run(file, args);
    assert.notStrictEqual(r.code, 0, r.out);
    assert.match(r.out, /Usage/);
    assert.strictEqual(fs.existsSync(file), false);
  });
