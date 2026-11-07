"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { checkCrossReferences, findCrossReferences, knownNames } = require("./cross-refs.js");

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-xref-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return root;
}

const names = (text) => findCrossReferences(text).map((r) => `${r.kind}:${r.name}`);

const PLUGIN = {
  "plugins/keystone/skills/real-skill/SKILL.md": "---\nname: real-skill\n---\n",
  "plugins/keystone/commands/ship.md": "---\ndescription: x\n---\n",
  "plugins/keystone/agents/implementer.md": "---\nname: implementer\n---\n",
};

test("finds the namespaced form, including inside fenced code", () => {
  assert.deepStrictEqual(names("load `keystone:real-skill`\n```\nkeystone:other\n```\n"), [
    "namespaced:real-skill",
    "namespaced:other",
  ]);
});

test("the `keystone: <ceiling>` marker (with a space) is not a reference", () => {
  assert.deepStrictEqual(names("mark it `keystone: stub, upgrade when X`"), []);
});

test("finds slash commands in prose and as inline code spans", () => {
  assert.deepStrictEqual(names("run /ship, then `/pickup` or `/spec <idea>`."), [
    "slash:pickup",
    "slash:spec",
    "slash:ship",
  ]);
});

test("paths, closing tags, and slashes after code are not slash commands", () => {
  const text = [
    "see a/b and ./x and ~/x and </div> and /usr/bin and /x.md",
    "await/join/flush and `UNEXAMINED`/high-blast and `alg:none`/confusion",
    "`/tmp/foo` and `src/x`",
  ].join("\n");
  assert.deepStrictEqual(names(text), []);
});

test("slash commands inside fenced code are skipped", () => {
  assert.deepStrictEqual(names("```sh\nls /etc\n/gone\n```\n"), []);
});

test("finds backticked names explicitly called a skill, command, or agent", () => {
  assert.deepStrictEqual(
    names("load the `real-skill` skill; the agent `implementer`; `/ship` command"),
    ["slash:ship", "backticked:real-skill", "backticked:implementer", "backticked:ship"],
  );
});

test("ordinary backticked identifiers are not references", () => {
  assert.deepStrictEqual(names("use `express-rate-limit` and `invoiceDate`"), []);
  // "command `x`" without "the" is too ambiguous to check.
  assert.deepStrictEqual(names("every skill/command `description` loads"), []);
});

test("line numbers are reported against the original file", () => {
  const [ref] = findCrossReferences("a\n\nrun /ship\n");
  assert.strictEqual(ref.line, 3);
});

test("knownNames lists skills (with SKILL.md), commands, and agents", () => {
  const root = tree({ ...PLUGIN, "plugins/keystone/skills/no-skill-md/ref.md": "x" });
  assert.deepStrictEqual(
    [...knownNames(path.join(root, "plugins", "keystone"))].sort(),
    ["implementer", "real-skill", "ship"],
  );
});

test("references to existing names, built-ins, and exemptions pass", () => {
  const root = tree({
    ...PLUGIN,
    "README.md": "`keystone:real-skill`, /ship, /code-review, /simplify, /clear, `/tmp`, `impeccable` skill\n",
  });
  const result = checkCrossReferences(root);
  assert.deepStrictEqual(result.dangling, []);
  assert.strictEqual(result.ok, true);
});

test("dangling references are reported with file, line, and name", () => {
  const root = tree({
    ...PLUGIN,
    "plugins/keystone/skills/real-skill/SKILL.md":
      "---\nname: real-skill\n---\nload `keystone:gone-skill`\nrun /gone-command\n",
    "templates/X.md": "the `gone-agent` agent\n",
  });
  const result = checkCrossReferences(root);
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(
    result.dangling.map((d) => `${path.relative(root, d.file)}:${d.line}:${d.name}`).sort(),
    [
      "plugins/keystone/skills/real-skill/SKILL.md:4:gone-skill",
      "plugins/keystone/skills/real-skill/SKILL.md:5:gone-command",
      "templates/X.md:1:gone-agent",
    ],
  );
});

test("a built-in name is not accepted in the keystone: namespace", () => {
  const root = tree({ ...PLUGIN, "README.md": "use `keystone:code-review`\n" });
  assert.strictEqual(checkCrossReferences(root).dangling.length, 1);
});

test("hooks.json additionalContext is scanned", () => {
  const root = tree({
    ...PLUGIN,
    "plugins/keystone/hooks/hooks.json": '{"x":"read the note or run /gone to resume"}',
  });
  assert.deepStrictEqual(checkCrossReferences(root).dangling.map((d) => d.name), ["gone"]);
});

test("CHANGELOG and ATTRIBUTION are history, not checked", () => {
  const root = tree({ ...PLUGIN, "CHANGELOG.md": "removed /gone\n", "ATTRIBUTION.md": "/gone\n" });
  assert.strictEqual(checkCrossReferences(root).ok, true);
});

test("the real keystone tree has no dangling cross-references", () => {
  const root = path.resolve(__dirname, "..", "..");
  const result = checkCrossReferences(root);
  assert.strictEqual(
    result.ok,
    true,
    result.dangling.map((d) => `${path.relative(root, d.file)}:${d.line} -> ${d.raw}`).join("\n"),
  );
  assert.ok(result.refsChecked > 100, `only ${result.refsChecked} references checked`);
});
