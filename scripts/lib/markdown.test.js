"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  findMarkdownLinks,
  lineOf,
  parseFrontmatter,
  stripFencedCode,
  stripInlineCode,
  walkMarkdown,
} = require("./markdown.js");

// ---------- parseFrontmatter ----------

test("parseFrontmatter returns null when there is no frontmatter", () => {
  assert.strictEqual(parseFrontmatter("# Just a heading\n"), null);
});

test("parseFrontmatter reads name and description in order", () => {
  const fm = parseFrontmatter("---\nname: zoom-out\ndescription: Step back.\n---\n\nbody\n");
  assert.deepStrictEqual(fm.keys, ["name", "description"]);
  assert.strictEqual(fm.values.name, "zoom-out");
  assert.strictEqual(fm.values.description, "Step back.");
});

test("parseFrontmatter folds an indented continuation into one value", () => {
  const fm = parseFrontmatter(
    "---\nname: x\ndescription: First line\n  second line\n---\n",
  );
  assert.strictEqual(fm.values.description, "First line second line");
});

test("parseFrontmatter reports a list-valued key so a third key is still detected", () => {
  const fm = parseFrontmatter(
    "---\nname: x\ndescription: y\nallowed-tools:\n  - Bash\n  - Read\n---\n",
  );
  assert.deepStrictEqual(fm.keys, ["name", "description", "allowed-tools"]);
});

test("parseFrontmatter strips matching surrounding quotes", () => {
  const fm = parseFrontmatter('---\nname: "x"\ndescription: \'y\'\n---\n');
  assert.strictEqual(fm.values.name, "x");
  assert.strictEqual(fm.values.description, "y");
});

test("parseFrontmatter handles a block scalar description", () => {
  const fm = parseFrontmatter("---\nname: x\ndescription: |\n  one\n  two\n---\n");
  assert.strictEqual(fm.values.description, "one two");
});

test("parseFrontmatter ignores a --- that is not at the very start", () => {
  assert.strictEqual(parseFrontmatter("intro\n---\nname: x\n---\n"), null);
});

// ---------- stripFencedCode ----------

test("stripFencedCode removes backtick fences but keeps surrounding prose", () => {
  const out = stripFencedCode("before\n```js\n](ghost.md)\n```\nafter\n");
  assert.match(out, /before/);
  assert.match(out, /after/);
  assert.doesNotMatch(out, /ghost\.md/);
});

test("stripFencedCode removes tilde fences", () => {
  const out = stripFencedCode("a\n~~~\n](ghost.md)\n~~~\nb\n");
  assert.doesNotMatch(out, /ghost\.md/);
});

test("stripFencedCode preserves line numbering", () => {
  const src = "one\n```\ntwo\nthree\n```\nfour\n";
  assert.strictEqual(stripFencedCode(src).split("\n").length, src.split("\n").length);
});

test("stripFencedCode leaves an unterminated fence's content out", () => {
  const out = stripFencedCode("a\n```\n](ghost.md)\n");
  assert.doesNotMatch(out, /ghost\.md/);
});

// ---------- stripInlineCode ----------

test("stripInlineCode blanks a code span without shifting offsets", () => {
  const src = "see `](x.md)` here";
  const out = stripInlineCode(src);
  assert.strictEqual(out.length, src.length);
  assert.doesNotMatch(out, /x\.md/);
});

// ---------- findMarkdownLinks ----------

test("findMarkdownLinks finds relative targets and their line numbers", () => {
  const links = findMarkdownLinks("intro\n\nsee [a](./a.md) and [b](../b/c.md)\n");
  assert.deepStrictEqual(links.map((l) => l.target), ["./a.md", "../b/c.md"]);
  assert.deepStrictEqual(links.map((l) => l.line), [3, 3]);
});

test("findMarkdownLinks keeps a title attribute out of the target", () => {
  const links = findMarkdownLinks('[a](./a.md "the title")');
  assert.deepStrictEqual(links.map((l) => l.target), ["./a.md"]);
});

test("findMarkdownLinks ignores links inside fenced code", () => {
  assert.deepStrictEqual(findMarkdownLinks("```\n[a](./ghost.md)\n```\n"), []);
});

test("findMarkdownLinks ignores link syntax inside an inline code span", () => {
  assert.deepStrictEqual(findMarkdownLinks("`[a](./ghost.md)`"), []);
});

// ---------- lineOf ----------

test("lineOf is 1-based", () => {
  assert.strictEqual(lineOf("a\nb\nc", 0), 1);
  assert.strictEqual(lineOf("a\nb\nc", 4), 3);
});

// ---------- walkMarkdown ----------

test("walkMarkdown recurses the real filesystem and ignores non-markdown", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-walk-"));
  fs.mkdirSync(path.join(root, "nested", "deep"), { recursive: true });
  fs.writeFileSync(path.join(root, "top.md"), "");
  fs.writeFileSync(path.join(root, "nested", "mid.md"), "");
  fs.writeFileSync(path.join(root, "nested", "deep", "leaf.md"), "");
  fs.writeFileSync(path.join(root, "nested", "notes.txt"), "");

  const found = walkMarkdown(root).map((f) => path.relative(root, f)).sort();
  assert.deepStrictEqual(found, [
    "nested/deep/leaf.md",
    "nested/mid.md",
    "top.md",
  ]);
});

test("walkMarkdown does not consult .gitignore", () => {
  // The bug this validator exists to avoid: a shell grep that respects .gitignore
  // silently skipped an ignored directory and reported a clean census.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-walk-ignored-"));
  fs.writeFileSync(path.join(root, ".gitignore"), "hidden/\n");
  fs.mkdirSync(path.join(root, "hidden"));
  fs.writeFileSync(path.join(root, "hidden", "a.md"), "");

  const found = walkMarkdown(root).map((f) => path.relative(root, f));
  assert.deepStrictEqual(found, ["hidden/a.md"]);
});

test("walkMarkdown returns an empty list for a missing directory", () => {
  assert.deepStrictEqual(walkMarkdown("/definitely/not/a/real/path"), []);
});
