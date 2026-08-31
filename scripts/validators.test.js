"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const SCRIPTS = __dirname;
const ROOT = path.resolve(SCRIPTS, "..");

const VALIDATORS = [
  "validate-versions.js",
  "validate-reference-links.js",
  "validate-skills.js",
];

function run(script, args = [], cwd = ROOT) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

for (const script of VALIDATORS) {
  test(`${script} exits 0 against the current tree`, () => {
    const { code, stdout } = run(script);
    assert.strictEqual(code, 0, stdout);
    assert.match(stdout, /PASSED/);
  });

  test(`${script} accepts --root and honours --help`, () => {
    const { code, stdout } = run(script, ["--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /--root/);
  });

  test(`${script} rejects an unknown flag with a non-zero exit`, () => {
    assert.notStrictEqual(run(script, ["--nope"]).code, 0);
  });
}

test("validate-versions.js exits non-zero on a drifted manifest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-cli-ver-"));
  fs.mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
  fs.mkdirSync(path.join(root, "plugins", "keystone", ".claude-plugin"), { recursive: true });
  fs.writeFileSync(path.join(root, "VERSION"), "0.5.0\n");
  fs.writeFileSync(
    path.join(root, "plugins", "keystone", ".claude-plugin", "plugin.json"),
    JSON.stringify({ version: "0.4.1" }),
  );
  fs.writeFileSync(
    path.join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ metadata: { version: "0.5.0" }, plugins: [] }),
  );

  const { code, stdout } = run("validate-versions.js", ["--root", root]);
  assert.strictEqual(code, 1);
  assert.match(stdout, /0\.4\.1/);
  assert.match(stdout, /FAILED/);
});

test("validate-reference-links.js exits non-zero on a dead link", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-cli-link-"));
  const dir = path.join(root, "plugins", "keystone", "skills", "a-skill");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), "see [gone](./gone.md)\n");

  const { code, stdout } = run("validate-reference-links.js", ["--root", root]);
  assert.strictEqual(code, 1);
  assert.match(stdout, /gone\.md/);
});

test("validate-skills.js exits non-zero on a bad skill", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-cli-skill-"));
  const dir = path.join(root, "plugins", "keystone", "skills", "a-skill");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    "---\nname: a-skill\ndescription: Formats numbers.\nallowed-tools: Bash\n---\n",
  );

  const { code, stdout } = run("validate-skills.js", ["--root", root]);
  assert.strictEqual(code, 1);
  assert.match(stdout, /allowed-tools/);
  assert.match(stdout, /trigger/i);
});

test("validate-skills.js prints every exemption with its reason", () => {
  const { stdout } = run("validate-skills.js", ["--verbose"]);
  assert.match(stdout, /impeccable/);
  assert.match(stdout, /deep-research/);
});
