#!/usr/bin/env node
"use strict";
// Tests for patch-paths.js — the Codex apply_patch header parser guard.js uses.
// The grammar mirrors codex-rs/apply-patch (parser.rs + streaming_parser.rs).
const { test } = require("node:test");
const assert = require("node:assert");
const pp = require("./patch-paths.js");

const P = (...lines) => ["*** Begin Patch", ...lines, "*** End Patch"].join("\n");
const ok = (text) => {
  const r = pp.parsePatch(text);
  assert.equal(r.ok, true, `expected a valid patch, got: ${r.error}`);
  return r.hunks;
};
const bad = (text) => assert.equal(pp.parsePatch(text).ok, false);

test("parses add, delete, update and move (Codex's own multi-hunk vector)", () => {
  assert.deepEqual(
    ok(
      P(
        "*** Add File: path/add.py",
        "+abc",
        "+def",
        "*** Delete File: path/delete.py",
        "*** Update File: path/update.py",
        "*** Move to: path/update2.py",
        "@@ def f():",
        "-    pass",
        "+    return 123",
      ),
    ),
    [
      { kind: "add", path: "path/add.py", movePath: null },
      { kind: "delete", path: "path/delete.py", movePath: null },
      { kind: "update", path: "path/update.py", movePath: "path/update2.py" },
    ],
  );
});

test("update followed by another hunk", () =>
  assert.deepEqual(
    ok(P("*** Update File: file.py", "@@", "+line", "*** Add File: other.py", "+content")).map(
      (h) => h.path,
    ),
    ["file.py", "other.py"],
  ));

test("\\r\\n line endings parse to the same paths", () =>
  assert.deepEqual(
    ok(P("*** Add File: a.py", "+x", "*** Update File: b.py", "@@", "-y", "+z").replace(/\n/g, "\r\n")).map(
      (h) => h.path,
    ),
    ["a.py", "b.py"],
  ));

test("whitespace around markers is tolerated (Codex trims each line)", () =>
  assert.deepEqual(
    ok("  *** Begin Patch  \n   *** Add File: a.py   \n+x\n  *** End Patch  ").map((h) => h.path),
    ["a.py"],
  ));

test("trim follows Rust char::is_whitespace: NEL is trimmed off the path", () =>
  assert.deepEqual(ok(P("*** Add File: .env\u0085", "+x")).map((h) => h.path), [".env"]));

test("trim follows Rust char::is_whitespace: a BOM is NOT trimmed (Codex rejects the header)", () =>
  bad(P("\uFEFF*** Add File: a.py", "+x")));

test("inside an update hunk, an indented header line is a context line, not a header", () =>
  assert.deepEqual(
    ok(P("*** Update File: a.py", "@@", "  *** Add File: /etc/x", "-old", "+new")).map((h) => h.path),
    ["a.py"],
  ));

test("Move to is only valid before the first chunk", () =>
  bad(P("*** Update File: a.py", "@@", "-old", "+new", "*** Move to: b.py")));

test("the last line is matched with a full trim (Codex's finish())", () =>
  assert.deepEqual(ok("*** Begin Patch\n*** Update File: a.py\n@@\n-x\n+y\n   *** End Patch").length, 1));

test("lenient heredoc wrapper is unwrapped, as Codex does for freeform input", () =>
  assert.deepEqual(
    ok(`<<'EOF'\n${P("*** Add File: a.py", "+x")}\nEOF\n`).map((h) => h.path),
    ["a.py"],
  ));

test("Environment ID right after Begin Patch is parsed, not a file", () => {
  const r = pp.parsePatch(P("*** Environment ID: remote-1", "*** Add File: a.py", "+x"));
  assert.equal(r.ok, true);
  assert.equal(r.environmentId, "remote-1");
  assert.deepEqual(r.hunks.map((h) => h.path), ["a.py"]);
});

test("Environment ID after a hunk is rejected", () =>
  bad(P("*** Add File: a.py", "+x", "*** Environment ID: remote-1")));

for (const [name, text] of [
  ["no envelope", "*** Add File: a.py\n+x"],
  ["missing End Patch", "*** Begin Patch\n*** Add File: a.py\n+x"],
  ["empty string", ""],
  ["garbage after End Patch", `${P("*** Add File: a.py", "+x")}\n*** Add File: b.py`],
  ["an empty Add File path", P("*** Add File: ", "+x")],
  ["an unknown header", P("*** Rename File: a.py")],
  ["a non-+ line in an add hunk", P("*** Add File: a.py", "x")],
])
  test(`rejects ${name}`, () => bad(text));

test("parsePatch never throws on non-string input", () => {
  for (const v of [undefined, null, 5, {}, ["*** Begin Patch"]]) assert.equal(pp.parsePatch(v).ok, false);
});

test("headerLines: every header-looking line anywhere, for the shell heredoc form", () =>
  assert.deepEqual(
    pp.headerLines("apply_patch <<'EOF'\n*** Begin Patch\n*** Update File: a.py\n*** Move to: b.py\n@@\n  *** Add File: c.py\nEOF"),
    [
      { kind: "update", path: "a.py" },
      { kind: "move", path: "b.py" },
      { kind: "add", path: "c.py" },
    ],
  ));

// ── Linear time on long whitespace runs (a hook timeout lets Codex apply the patch unchecked)
const fast = (label, fn) => {
  const t0 = process.hrtime.bigint();
  fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 100, `${label} took ${ms.toFixed(1)} ms`);
};
const LONG = " ".repeat(100000) + "x";
test("trim is linear on 100k spaces + x", () => fast("trim", () => assert.equal(pp.trim(LONG), "x")));
test("trimEnd is linear on x + 100k spaces + x", () =>
  fast("trimEnd", () => assert.equal(pp.trimEnd(`x${LONG}`), `x${LONG}`)));
test("parsePatch is linear on a 100k-space line", () =>
  fast("parsePatch", () => assert.equal(pp.parsePatch(P("*** Add File: a.py", `+${LONG}`)).ok, true)));
test("parsePatch is linear on 100k spaces around the whole patch", () =>
  fast("parsePatch", () => assert.equal(pp.parsePatch(`${LONG.slice(0, -1)}${P("*** Add File: a.py", "+x")}${LONG}`).ok, false)));
test("headerLines is linear on 100k spaces + x", () => fast("headerLines", () => assert.deepEqual(pp.headerLines(LONG), [])));

test("trim/trimEnd keep Rust whitespace semantics", () => {
  assert.equal(pp.trim("\u0085\t a b 　\u0085"), "a b");
  assert.equal(pp.trim("\uFEFFa\uFEFF"), "\uFEFFa\uFEFF");
  assert.equal(pp.trimEnd("  a \r\n"), "  a");
  assert.equal(pp.trim("    "), "");
  assert.equal(pp.trim(""), "");
  assert.equal(pp.trim("\u001c a"), "\u001c a"); // U+001C-001F are not Rust White_Space
});
