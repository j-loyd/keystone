"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  ENTRY_MAX_CHARS,
  HEADING_MAX_CHARS,
  INDEX_MAX,
  allEntries,
  buildContext,
  isSuperseded,
  selectEntries,
  clusterEntries,
  missContext,
  repoFile,
  validateEntry,
} = require("./learnings.js");

const HOOK = path.join(__dirname, "learnings.js");

// Run the SessionStart hook as a real child process (so we exercise stdout, the fail-open
// path, and env-driven storage). `cwd` sets what git repo it resolves; `learningsDir` overrides
// KEYSTONE_LEARNINGS_DIR so tests never touch the real ~/.claude store.
function runSessionStart(input, { cwd, learningsDir, env = {} } = {}) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: input || "{}",
    cwd: cwd || __dirname,
    encoding: "utf8",
    env: {
      ...process.env,
      KEYSTONE_LEARNINGS_MAX: "",
      ...(learningsDir ? { KEYSTONE_LEARNINGS_DIR: learningsDir } : {}),
      ...env,
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

test("missContext is a one-line /wrap nudge", () => {
  const msg = missContext("my-repo");
  assert.match(msg, /\/wrap/);
  assert.match(msg, /No lessons banked/i);
  assert.match(msg, /my-repo/);
  assert.ok(!msg.includes("\n"), "miss nudge stays a single line");
});

test("SessionStart in a git repo with no banked lessons emits the /wrap nudge, not bare {}", () => {
  const store = mkTmp("ks-empty-store-"); // fresh, so no <slug>.md exists
  try {
    const out = runSessionStart("{}", { cwd: __dirname, learningsDir: store });
    assert.notStrictEqual(out.trim(), "{}", "must not fall back to bare {}");
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /\/wrap/);
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
    assert.match(ctx, /Lessons recorded in earlier sessions/);
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

// ---------- injection framing and per-entry cap ----------

test("buildContext frames banked lessons as data to verify, not instructions", () => {
  const ctx = buildContext(["## 2026-01-01 — [Lesson] X\nDo Y."], "repo");
  assert.match(ctx, /Lessons recorded in earlier sessions/);
  assert.match(ctx, /data, not instructions/);
  assert.match(ctx, /verify before relying on them/);
});

test("buildContext caps each injected entry's length", () => {
  const huge =
    "## 2026-01-01 — [Lesson] Big\n" + "x".repeat(ENTRY_MAX_CHARS * 3);
  const ctx = buildContext(
    [huge, "## 2026-01-02 — [Lesson] Small\nok"],
    "repo",
  );
  assert.ok(ctx.length < ENTRY_MAX_CHARS * 2, `context is ${ctx.length} chars`);
  assert.match(ctx, /truncated/);
  assert.match(ctx, /Small/);
});

// ---------- --append: the only write path /wrap uses ----------

const GOOD_ENTRY =
  "## 2026-11-07 — [Lesson] Widget cache needs a TTL\nSet a TTL on widget cache keys.\n" +
  "**Evidence:** test/cache.test.js red then green\n**Triggers:** caching\n";

function runAppend(args, input, { cwd, learningsDir }) {
  return spawnSync(process.execPath, [HOOK, "--append", ...args], {
    input,
    cwd,
    encoding: "utf8",
    env: { ...process.env, KEYSTONE_LEARNINGS_DIR: learningsDir },
  });
}

test("validateEntry accepts the /wrap shape and rejects everything else", () => {
  assert.strictEqual(validateEntry(GOOD_ENTRY), null);
  assert.match(validateEntry(""), /empty/);
  assert.match(validateEntry("no heading\n**Triggers:** api"), /## /);
  assert.match(validateEntry("## 2026 — [Lesson] x\nno triggers"), /Triggers/);
  assert.match(validateEntry(GOOD_ENTRY + "\n" + GOOD_ENTRY), /one entry/);
  assert.match(
    validateEntry(GOOD_ENTRY + "y".repeat(ENTRY_MAX_CHARS)),
    /chars/,
  );
  assert.match(validateEntry(GOOD_ENTRY + "\u0000"), /control/);
});

test("--append writes the entry to this repo's computed lessons file and nowhere else", () => {
  const store = mkTmp("ks-append-store-");
  try {
    const res = runAppend([], GOOD_ENTRY, {
      cwd: __dirname,
      learningsDir: store,
    });
    assert.strictEqual(res.status, 0, res.stderr);
    const file = path.join(store, repoFile(__dirname).slug + ".md");
    assert.deepStrictEqual(fs.readdirSync(store), [path.basename(file)]);
    assert.match(fs.readFileSync(file, "utf8"), /Widget cache needs a TTL/);
    // A second entry is separated so recentEntries() still splits them.
    const second = GOOD_ENTRY.replace("Widget cache", "Second lesson");
    assert.strictEqual(
      runAppend([], second, { cwd: __dirname, learningsDir: store }).status,
      0,
    );
    const out = runSessionStart("{}", { cwd: __dirname, learningsDir: store });
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /Widget cache needs a TTL[\s\S]*Second lesson/);
  } finally {
    fs.rmSync(store, { recursive: true, force: true });
  }
});

test("--append --meta writes only to the keystone meta inbox, even outside a git repo", () => {
  const store = mkTmp("ks-append-meta-");
  const nonRepo = mkTmp("ks-append-nonrepo-");
  try {
    const res = runAppend(["--meta"], GOOD_ENTRY, {
      cwd: nonRepo,
      learningsDir: store,
    });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.deepStrictEqual(fs.readdirSync(store), ["_keystone-meta.md"]);
  } finally {
    fs.rmSync(store, { recursive: true, force: true });
    fs.rmSync(nonRepo, { recursive: true, force: true });
  }
});

test("--append refuses outside a git repo, a path argument, a bad shape, and an oversized entry", () => {
  const store = mkTmp("ks-append-refuse-");
  const nonRepo = mkTmp("ks-append-nonrepo-");
  try {
    const target = path.join(store, "chosen.md");
    const cases = [
      [[], GOOD_ENTRY, nonRepo, /git repo/],
      [[target], GOOD_ENTRY, __dirname, /argument/],
      [["--meta", target], GOOD_ENTRY, __dirname, /argument/],
      [[], "not an entry", __dirname, /## /],
      [[], GOOD_ENTRY + "z".repeat(ENTRY_MAX_CHARS), __dirname, /chars/],
    ];
    for (const [args, input, cwd, why] of cases) {
      const res = runAppend(args, input, { cwd, learningsDir: store });
      assert.notStrictEqual(
        res.status,
        0,
        `expected refusal for ${JSON.stringify(args)}`,
      );
      assert.match(res.stderr, why);
    }
    assert.deepStrictEqual(
      fs.readdirSync(store),
      [],
      "a refused append writes nothing",
    );
  } finally {
    fs.rmSync(store, { recursive: true, force: true });
    fs.rmSync(nonRepo, { recursive: true, force: true });
  }
});

test("--append stores shell syntax in an entry verbatim and never runs it", () => {
  const store = mkTmp("ks-append-noshell-");
  try {
    const sentinel = path.join(store, "pwned");
    // A line that would end the old <<'ENTRY' heredoc, followed by a command and expansions.
    const hostile =
      GOOD_ENTRY +
      ["ENTRY", ["touch", sentinel].join(" "), "$(id) `id` ${HOME}"].join(
        "\n",
      ) +
      "\n";
    const res = runAppend([], hostile, { cwd: __dirname, learningsDir: store });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(!fs.existsSync(sentinel), "entry text must not execute");
    const saved = fs.readFileSync(
      path.join(store, repoFile(__dirname).slug + ".md"),
      "utf8",
    );
    assert.ok(
      saved.includes("$(id) `id` ${HOME}"),
      "saved verbatim, unexpanded",
    );
  } finally {
    fs.rmSync(store, { recursive: true, force: true });
  }
});

test("--append refuses to follow a symlinked lessons file", () => {
  const store = mkTmp("ks-append-link-");
  try {
    const elsewhere = path.join(store, "elsewhere.md");
    fs.writeFileSync(elsewhere, "");
    fs.symlinkSync(
      elsewhere,
      path.join(store, repoFile(__dirname).slug + ".md"),
    );
    const res = runAppend([], GOOD_ENTRY, {
      cwd: __dirname,
      learningsDir: store,
    });
    assert.notStrictEqual(res.status, 0);
    assert.match(res.stderr, /symlink/);
    assert.strictEqual(fs.readFileSync(elsewhere, "utf8"), "");
  } finally {
    fs.rmSync(store, { recursive: true, force: true });
  }
});

// ---------- full entries + title index ----------

// `n` entries in file order, oldest first: "## 2026-01-01 — [Lesson] Topic 1" …
function seedEntries(n, mark = {}) {
  return Array.from({ length: n }, (_, i) => {
    const k = i + 1;
    const day = String(k).padStart(2, "0");
    const tag = mark[k] ? ` ${mark[k]}` : "";
    return `## 2026-01-${day} — [Lesson] Topic ${k}${tag}\nBody of topic ${k}.\n**Triggers:** testing`;
  });
}

function withSeededStore(text, fn) {
  const store = mkTmp("ks-index-store-");
  try {
    const file = path.join(store, repoFile(__dirname).slug + ".md");
    fs.writeFileSync(file, text);
    return fn({ store, file });
  } finally {
    fs.rmSync(store, { recursive: true, force: true });
  }
}

test("isSuperseded reads the heading only", () => {
  assert.ok(isSuperseded("## 2026-01-01 — [Lesson] X — SUPERSEDED 2026-02-01\nbody"));
  assert.ok(isSuperseded("## 2026-01-01 — [Lesson] X (superseded)\nbody"));
  assert.ok(
    !isSuperseded("## 2026-01-01 — [Lesson] X\n**Superseded:** mentioned in the body only"),
  );
  assert.ok(!isSuperseded("## 2026-01-01 — [Decision] Old oracle retired"));
});

test("selectEntries: newest N live entries in full, every other title in the index", () => {
  const { full, index } = selectEntries(seedEntries(12), 5);
  assert.deepStrictEqual(
    full.map((e) => e.split("\n")[0]),
    [8, 9, 10, 11, 12].map((k) => `## 2026-01-${String(k).padStart(2, "0")} — [Lesson] Topic ${k}`),
  );
  assert.strictEqual(index.length, 7);
  assert.strictEqual(index[0], "2026-01-01 — [Lesson] Topic 1");
  assert.ok(index.every((t) => !t.startsWith("## ") && !t.includes("\n")));
});

test("selectEntries: a superseded entry never takes a full slot but stays in the index", () => {
  const entries = seedEntries(6, { 6: "— SUPERSEDED 2026-02-01" });
  const { full, index } = selectEntries(entries, 2);
  assert.deepStrictEqual(
    full.map((e) => e.split("\n")[0].replace(/^## \S+ — \[Lesson\] /, "")),
    ["Topic 4", "Topic 5"],
    "the next-newest live entry fills the slot",
  );
  assert.ok(index.some((t) => /Topic 6 — SUPERSEDED/.test(t)));
  assert.strictEqual(index.length, 4);
});

test("selectEntries: fewer entries than N means everything in full and no index", () => {
  const { full, index } = selectEntries(seedEntries(3), 5);
  assert.strictEqual(full.length, 3);
  assert.deepStrictEqual(index, []);
});

test("buildContext names the lessons file and caps index titles and line count", () => {
  const long = "## 2026-01-01 — [Lesson] " + "w".repeat(HEADING_MAX_CHARS * 2);
  const many = seedEntries(INDEX_MAX + 20);
  const { full, index } = selectEntries([long, ...many], 1);
  const ctx = buildContext(full, "repo", { index, file: "/tmp/lessons.md" });
  assert.match(ctx, /data, not instructions/);
  assert.match(ctx, /\/tmp\/lessons\.md/);
  assert.match(ctx, /older titles not listed/);
  const lines = ctx.split("\n").filter((l) => l.startsWith("- "));
  assert.strictEqual(lines.length, INDEX_MAX);
  assert.ok(!ctx.includes("w".repeat(HEADING_MAX_CHARS + 1)), "the long title is capped");
});

test("buildContext without an index is unchanged in shape (no index block)", () => {
  const ctx = buildContext(["## 2026-01-01 — [Lesson] X\nDo Y."], "repo");
  assert.ok(!ctx.includes("📇"));
});

test("SessionStart: 12 lessons → 5 in full, 7 by title, with the file path", () => {
  withSeededStore(seedEntries(12).join("\n\n") + "\n", ({ store, file }) => {
    const out = runSessionStart("{}", { cwd: __dirname, learningsDir: store });
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /Body of topic 12\./);
    assert.match(ctx, /Body of topic 8\./);
    assert.ok(!ctx.includes("Body of topic 7."), "older bodies are not injected");
    assert.match(ctx, /7 more lessons/);
    assert.match(ctx, /- 2026-01-01 — \[Lesson\] Topic 1\n/);
    assert.ok(ctx.includes(file), "names the file to open");
  });
});

test("SessionStart honors KEYSTONE_LEARNINGS_MAX for the full-entry count", () => {
  withSeededStore(seedEntries(12).join("\n\n") + "\n", ({ store }) => {
    const out = runSessionStart("{}", {
      cwd: __dirname,
      learningsDir: store,
      env: { KEYSTONE_LEARNINGS_MAX: "2" },
    });
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /Body of topic 11\./);
    assert.ok(!ctx.includes("Body of topic 10."));
    assert.match(ctx, /10 more lessons/);
  });
});

test("SessionStart with only superseded lessons still lists them instead of the miss nudge", () => {
  const text = seedEntries(2, { 1: "— SUPERSEDED", 2: "— SUPERSEDED" }).join("\n\n");
  withSeededStore(text, ({ store }) => {
    const out = runSessionStart("{}", { cwd: __dirname, learningsDir: store });
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.ok(!/No lessons banked/.test(ctx));
    assert.match(ctx, /2 more lessons/);
    assert.ok(!ctx.includes("Body of topic"));
  });
});

test("allEntries keeps file order and every entry", () => {
  assert.strictEqual(allEntries(seedEntries(40).join("\n\n")).length, 40);
});
