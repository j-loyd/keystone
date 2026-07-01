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
