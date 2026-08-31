"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { checkLinksInFile, checkSkillLinks } = require("./reference-links.js");

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-links-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return root;
}

test("a link to an existing sibling resolves", () => {
  const root = tree({
    "a/SKILL.md": "see [ref](./ref.md)\n",
    "a/ref.md": "x",
  });
  const dead = checkLinksInFile(path.join(root, "a", "SKILL.md"));
  assert.deepStrictEqual(dead, []);
});

test("a bare sibling filename resolves against the skill's own directory", () => {
  const root = tree({ "a/SKILL.md": "see [ref](ref.md)\n", "a/ref.md": "x" });
  assert.deepStrictEqual(checkLinksInFile(path.join(root, "a", "SKILL.md")), []);
});

test("a ../ cross-skill link resolves", () => {
  // improve-codebase-architecture -> ../grill-with-docs/ADR-FORMAT.md is real.
  const root = tree({
    "a/SKILL.md": "see [adr](../b/ADR-FORMAT.md)\n",
    "b/ADR-FORMAT.md": "x",
  });
  assert.deepStrictEqual(checkLinksInFile(path.join(root, "a", "SKILL.md")), []);
});

test("a missing target is reported with its target and line number", () => {
  const root = tree({ "a/SKILL.md": "intro\n\nsee [gone](./gone.md)\n" });
  const dead = checkLinksInFile(path.join(root, "a", "SKILL.md"));
  assert.strictEqual(dead.length, 1);
  assert.strictEqual(dead[0].target, "./gone.md");
  assert.strictEqual(dead[0].line, 3);
});

test("an anchor fragment is stripped before the existence check", () => {
  const root = tree({
    "a/SKILL.md": "see [ref](./ref.md#some-heading)\n",
    "a/ref.md": "x",
  });
  assert.deepStrictEqual(checkLinksInFile(path.join(root, "a", "SKILL.md")), []);
});

test("a missing target with an anchor is still reported", () => {
  const root = tree({ "a/SKILL.md": "see [ref](./gone.md#h)\n" });
  assert.strictEqual(checkLinksInFile(path.join(root, "a", "SKILL.md")).length, 1);
});

test("non-markdown targets are out of scope", () => {
  const root = tree({
    "a/SKILL.md": "[s](./find-polluter.sh) [t](./example.ts) [i](./x.png)\n",
  });
  assert.deepStrictEqual(checkLinksInFile(path.join(root, "a", "SKILL.md")), []);
});

test("absolute URLs and pure anchors are out of scope", () => {
  const root = tree({
    "a/SKILL.md": "[h](https://example.com/x.md) [m](mailto:a@b.c) [a](#local)\n",
  });
  assert.deepStrictEqual(checkLinksInFile(path.join(root, "a", "SKILL.md")), []);
});

test("a link inside a fenced code block is not a reference", () => {
  const root = tree({
    "a/SKILL.md": "```md\n[example](./tasks/todo.md)\n```\n",
  });
  assert.deepStrictEqual(checkLinksInFile(path.join(root, "a", "SKILL.md")), []);
});

test("a bare path in prose is not a link", () => {
  // Skills legitimately name paths that do not exist, e.g. tasks/todo.md.
  const root = tree({ "a/SKILL.md": "Write your notes to tasks/todo.md when done.\n" });
  assert.deepStrictEqual(checkLinksInFile(path.join(root, "a", "SKILL.md")), []);
});

test("checkSkillLinks walks every markdown file under the skills tree", () => {
  const root = tree({
    "a/SKILL.md": "[ok](./ref.md)\n",
    "a/ref.md": "[bad](./nope.md)\n",
    "b/SKILL.md": "[bad](./also-nope.md)\n",
  });
  const result = checkSkillLinks(root);
  assert.strictEqual(result.filesScanned, 3);
  assert.strictEqual(result.dead.length, 2);
  assert.strictEqual(result.ok, false);
});

test("checkSkillLinks passes on a clean tree", () => {
  const root = tree({ "a/SKILL.md": "[ok](./ref.md)\n", "a/ref.md": "x" });
  const result = checkSkillLinks(root);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.linksChecked, 1);
});

test("the real keystone skills tree has no dead markdown references", () => {
  const skillsDir = path.resolve(__dirname, "..", "..", "plugins", "keystone", "skills");
  const result = checkSkillLinks(skillsDir);
  assert.strictEqual(
    result.ok,
    true,
    result.dead.map((d) => `${d.file}:${d.line} -> ${d.target}`).join("\n"),
  );
  assert.ok(result.linksChecked > 20, `only ${result.linksChecked} links checked`);
});
