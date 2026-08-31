"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { VERSION_SOURCES, checkVersions, readVersionSources } = require("./version-check.js");

function fixture({ version = "1.2.3", plugin = "1.2.3", marketplace = "1.2.3", extra = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-ver-"));
  fs.mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
  fs.mkdirSync(path.join(root, "plugins", "keystone", ".claude-plugin"), { recursive: true });
  if (version !== null) fs.writeFileSync(path.join(root, "VERSION"), `${version}\n`);
  if (plugin !== null) {
    fs.writeFileSync(
      path.join(root, "plugins", "keystone", ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "keystone", version: plugin }, null, 2),
    );
  }
  if (marketplace !== null) {
    fs.writeFileSync(
      path.join(root, ".claude-plugin", "marketplace.json"),
      JSON.stringify(
        {
          name: "keystone",
          metadata: { description: "d", version: marketplace },
          plugins: [{ name: "keystone", source: "./plugins/keystone", ...extra }],
        },
        null,
        2,
      ),
    );
  }
  return root;
}

test("the three release-critical paths are the ones CLAUDE.md names", () => {
  assert.deepStrictEqual(
    VERSION_SOURCES.map((s) => s.path),
    [
      "VERSION",
      "plugins/keystone/.claude-plugin/plugin.json",
      ".claude-plugin/marketplace.json",
    ],
  );
});

test("three matching versions pass", () => {
  const result = checkVersions(fixture());
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.problems, []);
  assert.strictEqual(result.version, "1.2.3");
  assert.strictEqual(result.entries.length, 3);
});

test("VERSION is read with trailing whitespace trimmed", () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, "VERSION"), "1.2.3\n\n");
  assert.strictEqual(checkVersions(root).ok, true);
});

test("a stale plugin.json fails and the message names the path and both values", () => {
  // The real v0.4.1-class incident: VERSION moved, a manifest did not.
  const result = checkVersions(fixture({ version: "0.5.0", plugin: "0.4.1", marketplace: "0.5.0" }));
  assert.strictEqual(result.ok, false);
  const text = result.problems.join("\n");
  assert.match(text, /plugins\/keystone\/\.claude-plugin\/plugin\.json/);
  assert.match(text, /0\.4\.1/);
  assert.match(text, /0\.5\.0/);
});

test("a stale marketplace metadata.version fails", () => {
  const result = checkVersions(fixture({ marketplace: "0.1.0" }));
  assert.strictEqual(result.ok, false);
  assert.match(result.problems.join("\n"), /marketplace\.json/);
});

test("every mismatching path is reported, not just the first", () => {
  const result = checkVersions(fixture({ version: "3.0.0", plugin: "1.0.0", marketplace: "2.0.0" }));
  assert.strictEqual(result.problems.length >= 2, true);
});

test("a missing file is an error rather than a crash", () => {
  const result = checkVersions(fixture({ plugin: null }));
  assert.strictEqual(result.ok, false);
  assert.match(result.problems.join("\n"), /not found|missing/i);
});

test("unparseable JSON is an error rather than a crash", () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, ".claude-plugin", "marketplace.json"), "{ nope");
  const result = checkVersions(root);
  assert.strictEqual(result.ok, false);
  assert.match(result.problems.join("\n"), /JSON/i);
});

test("an absent version field is an error naming the field", () => {
  const root = fixture();
  fs.writeFileSync(
    path.join(root, "plugins", "keystone", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "keystone" }),
  );
  const result = checkVersions(root);
  assert.strictEqual(result.ok, false);
  assert.match(result.problems.join("\n"), /version/);
});

test("a non-semver value is an error", () => {
  const result = checkVersions(fixture({ version: "v1.2", plugin: "v1.2", marketplace: "v1.2" }));
  assert.strictEqual(result.ok, false);
  assert.match(result.problems.join("\n"), /semver|x\.y\.z/i);
});

test("a prerelease suffix is accepted", () => {
  const result = checkVersions(
    fixture({ version: "1.2.3-rc.1", plugin: "1.2.3-rc.1", marketplace: "1.2.3-rc.1" }),
  );
  assert.strictEqual(result.ok, true);
});

test("a version on a marketplace plugin entry is checked too when present", () => {
  // marketplace.json carries no per-plugin version today; if one is ever added it
  // becomes a fourth place that can drift, so it is checked opportunistically.
  const result = checkVersions(fixture({ extra: { version: "9.9.9" } }));
  assert.strictEqual(result.ok, false);
  assert.match(result.problems.join("\n"), /plugins\[0\]/);
});

test("readVersionSources exposes each path and value for reporting", () => {
  const entries = readVersionSources(fixture());
  assert.deepStrictEqual(
    entries.map((e) => e.value),
    ["1.2.3", "1.2.3", "1.2.3"],
  );
  for (const entry of entries) assert.ok(entry.path);
});

test("the real repository is self-consistent", () => {
  const result = checkVersions(path.resolve(__dirname, "..", ".."));
  assert.strictEqual(result.ok, true, result.problems.join("\n"));
});
