"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { clusterEntries, missContext, repoFile } = require("./learnings.js");

const HOOK = path.join(__dirname, "learnings.js");

// Run the SessionStart hook as a real child process (so we exercise stdout, the fail-open
// path, and env-driven storage). `cwd` sets what git repo it resolves; `learningsDir` overrides
// KEYSTONE_LEARNINGS_DIR so tests never touch the real ~/.claude store.
function runSessionStart(input, { cwd, learningsDir } = {}) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: input || "{}",
    cwd: cwd || __dirname,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(learningsDir ? { KEYSTONE_LEARNINGS_DIR: learningsDir } : {}),
    },
  });
  return res.stdout;
}

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("clusterEntries returns [] for fewer than two entries", () => {
  assert.deepStrictEqual(clusterEntries([]), []);
  assert.deepStrictEqual(
    clusterEntries(["## 2026-06-13 — [Lesson] Solo entry about caching"]),
    [],
  );
});

test("clusterEntries groups two entries sharing a domain token", () => {
  const entries = [
    "## 2026-06-13 — [Lesson] Auth token refresh race condition",
    "## 2026-06-12 — [Lesson] Token refresh needs a mutex",
  ];
  const clusters = clusterEntries(entries);
  assert.strictEqual(clusters.length, 1);
  assert.strictEqual(clusters[0].entries.length, 2);
  assert.ok(clusters[0].key, "cluster carries a representative key token");
  assert.ok(["token", "refresh"].includes(clusters[0].key));
});

test("clusterEntries does not group on the type tag alone (domain terms only)", () => {
  // Both are [Lesson] but share no domain term — must NOT cluster.
  const entries = [
    "## 2026-06-13 — [Lesson] Auth token refresh race",
    "## 2026-06-12 — [Lesson] Database migration ordering matters",
  ];
  assert.deepStrictEqual(clusterEntries(entries), []);
});

test("missContext is a one-line /learn nudge", () => {
  const msg = missContext("my-repo");
  assert.match(msg, /\/learn/);
  assert.match(msg, /No lessons banked/i);
  assert.match(msg, /my-repo/);
  assert.ok(!msg.includes("\n"), "miss nudge stays a single line");
});

test("SessionStart in a git repo with no banked lessons emits the /learn nudge, not bare {}", () => {
  const store = mkTmp("ks-empty-store-"); // fresh, so no <slug>.md exists
  try {
    const out = runSessionStart("{}", { cwd: __dirname, learningsDir: store });
    assert.notStrictEqual(out.trim(), "{}", "must not fall back to bare {}");
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /\/learn/);
    assert.match(ctx, /No lessons banked/i);
  } finally {
    fs.rmSync(store, { recursive: true, force: true });
  }
});

test("SessionStart still surfaces banked lessons when they exist (hit path intact)", () => {
  const store = mkTmp("ks-hit-store-");
  try {
    // repoFile().slug is independent of the storage dir, so we can seed the right file.
    const info = repoFile(__dirname);
    fs.writeFileSync(
      path.join(store, info.slug + ".md"),
      "## 2026-01-01 — [Lesson] Widget cache needs a TTL\nDetail line.\n",
    );
    const out = runSessionStart("{}", { cwd: __dirname, learningsDir: store });
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /Lessons learned in this repo/);
    assert.match(ctx, /Widget cache needs a TTL/);
  } finally {
    fs.rmSync(store, { recursive: true, force: true });
  }
});

test("SessionStart outside a git repo stays silent (fail-open {})", () => {
  const nonRepo = mkTmp("ks-nonrepo-"); // a bare temp dir is not a git repo
  const store = mkTmp("ks-store-");
  try {
    const out = runSessionStart("{}", { cwd: nonRepo, learningsDir: store });
    assert.strictEqual(out.trim(), "{}");
  } finally {
    fs.rmSync(nonRepo, { recursive: true, force: true });
    fs.rmSync(store, { recursive: true, force: true });
  }
});
