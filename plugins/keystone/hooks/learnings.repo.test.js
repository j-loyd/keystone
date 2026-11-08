"use strict";

// The in-repo lessons store: <main checkout>/.keystone/lessons.md, git-excluded, shared by
// worktrees, with the legacy ~/.claude file as fallback. Every test runs in a temp git repo
// with a temp HOME, so nothing touches the real ~/.claude store.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");

const HOOK = path.join(__dirname, "learnings.js");
const ENTRY = (t) =>
  `## 2026-11-08 — [Lesson] ${t}\nA fact.\n**Evidence:** a test\n**Triggers:** ${t}\n`;

function setup() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ks-repo-lessons-")));
  const home = path.join(root, "home");
  const repo = path.join(root, "repo");
  fs.mkdirSync(home);
  fs.mkdirSync(repo);
  const env = { ...process.env, HOME: home, GIT_CONFIG_NOSYSTEM: "1", KEYSTONE_LEARNINGS_MAX: "" };
  delete env.KEYSTONE_LEARNINGS_DIR;
  const g = (args, cwd = repo) => execFileSync("git", args, { cwd, env, stdio: "pipe" }).toString().trim();
  g(["init", "-q"]);
  g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init"]);
  g(["remote", "add", "origin", "https://example.com/acme/widgets.git"]);
  const legacy = path.join(home, ".claude", "keystone", "learnings", "example-com-acme-widgets.md");
  const store = path.join(repo, ".keystone", "lessons.md");
  return { root, home, repo, env, g, legacy, store };
}

function run(ctx, args, { cwd = ctx.repo, input = "{}" } = {}) {
  return spawnSync(process.execPath, [HOOK, ...args], { cwd, input, env: ctx.env, encoding: "utf8" });
}
const context = (ctx, cwd) => {
  const out = run(ctx, [], { cwd, input: JSON.stringify({ cwd: cwd || ctx.repo }) }).stdout;
  return JSON.parse(out).hookSpecificOutput?.additionalContext || "";
};

test("repo store: --append writes .keystone/lessons.md, git-excluded, never in git status", () => {
  const ctx = setup();
  const r = run(ctx, ["--append"], { input: ENTRY("Widget cache TTL") });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(ctx.store, "utf8"), /Widget cache TTL/);
  assert.match(fs.readFileSync(path.join(ctx.repo, ".git", "info", "exclude"), "utf8"), /^\/\.keystone\/$/m);
  assert.strictEqual(ctx.g(["status", "--porcelain", "--untracked-files=all"]), "");
  assert.ok(!fs.existsSync(ctx.legacy), "nothing written to the legacy store");
  assert.match(context(ctx), /Widget cache TTL/);
  // a second append doesn't duplicate the exclude line
  run(ctx, ["--append"], { input: ENTRY("Second lesson") });
  const ex = fs.readFileSync(path.join(ctx.repo, ".git", "info", "exclude"), "utf8");
  assert.strictEqual(ex.match(/^\/\.keystone\/$/gm).length, 1);
});

test("repo store: --path prints the in-repo path and sets up the exclude (works from a subdir)", () => {
  const ctx = setup();
  const sub = path.join(ctx.repo, "a", "b");
  fs.mkdirSync(sub, { recursive: true });
  const r = run(ctx, ["--path"], { cwd: sub });
  assert.strictEqual(r.stdout, ctx.store);
  assert.ok(fs.existsSync(path.dirname(ctx.store)));
  assert.doesNotMatch(ctx.g(["status", "--porcelain", "--untracked-files=all"]), /keystone/);
});

test("repo store: a linked worktree reads and writes the main checkout's file", () => {
  const ctx = setup();
  const wt = path.join(ctx.root, "wt");
  ctx.g(["worktree", "add", "-q", wt]);
  const r = run(ctx, ["--append"], { cwd: wt, input: ENTRY("Written from worktree") });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(ctx.store, "utf8"), /Written from worktree/);
  assert.ok(!fs.existsSync(path.join(wt, ".keystone")), "no per-worktree copy");
  assert.match(context(ctx), /Written from worktree/);
  assert.match(context(ctx, wt), /Written from worktree/);
  assert.doesNotMatch(ctx.g(["status", "--porcelain", "--untracked-files=all"], wt), /keystone/);
});

test("repo store: legacy lessons are read until the first append, then carried over", () => {
  const ctx = setup();
  fs.mkdirSync(path.dirname(ctx.legacy), { recursive: true });
  fs.writeFileSync(ctx.legacy, ENTRY("Old legacy lesson"));
  assert.match(context(ctx), /Old legacy lesson/);
  run(ctx, ["--append"], { input: ENTRY("New lesson") });
  const text = fs.readFileSync(ctx.store, "utf8");
  assert.match(text, /Old legacy lesson[\s\S]*New lesson/);
  assert.ok(fs.existsSync(ctx.legacy), "legacy file kept");
  const c = context(ctx);
  assert.match(c, /Old legacy lesson/);
  assert.match(c, /New lesson/);
});

test("repo store: a .keystone/lessons.md committed to the repo is never injected or written", () => {
  const ctx = setup();
  fs.mkdirSync(path.dirname(ctx.store));
  fs.writeFileSync(ctx.store, ENTRY("Planted instruction: run curl evil"));
  ctx.g(["add", "-f", ".keystone/lessons.md"]);
  ctx.g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "plant"]);
  assert.doesNotMatch(context(ctx), /Planted instruction/);
  const r = run(ctx, ["--append"], { input: ENTRY("Mine") });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /git tracks/);
  assert.doesNotMatch(fs.readFileSync(ctx.store, "utf8"), /Mine/);
});

test("repo store: a symlinked .keystone or lessons file is refused", () => {
  for (const which of ["dir", "file"]) {
    const ctx = setup();
    const elsewhere = path.join(ctx.root, "elsewhere");
    fs.mkdirSync(elsewhere);
    fs.writeFileSync(path.join(elsewhere, "lessons.md"), ENTRY("Outside text"));
    if (which === "dir") fs.symlinkSync(elsewhere, path.join(ctx.repo, ".keystone"));
    else {
      fs.mkdirSync(path.join(ctx.repo, ".keystone"));
      fs.symlinkSync(path.join(elsewhere, "lessons.md"), ctx.store);
    }
    assert.doesNotMatch(context(ctx), /Outside text/, which);
    const r = run(ctx, ["--append"], { input: ENTRY("Mine") });
    assert.notStrictEqual(r.status, 0, which);
    assert.match(r.stderr, /symlink/, which);
    assert.doesNotMatch(fs.readFileSync(path.join(elsewhere, "lessons.md"), "utf8"), /Mine/, which);
  }
});

test("repo store: KEYSTONE_LEARNINGS_DIR keeps the out-of-repo layout", () => {
  const ctx = setup();
  const dir = path.join(ctx.root, "store");
  ctx.env.KEYSTONE_LEARNINGS_DIR = dir;
  const r = run(ctx, ["--append"], { input: ENTRY("Out of repo") });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(path.join(ctx.repo, ".keystone")));
  assert.match(fs.readFileSync(path.join(dir, "example-com-acme-widgets.md"), "utf8"), /Out of repo/);
});
