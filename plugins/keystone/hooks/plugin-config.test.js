"use strict";
/**
 * plugin-config.test.js — config-lint for the plugin/marketplace manifests, version sync,
 * and skill/command frontmatter. Turns the manual plugin schema audit into a regression guard.
 *
 * Lives in hooks/ only because that's where `node --test` already discovers the suite; it
 * validates the whole plugin, reaching up to the repo root via relative paths.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../.."); // repo root
const PLUGIN = path.join(ROOT, "plugins", "keystone");
const VERSION_FILE = path.join(ROOT, "VERSION");
const PLUGIN_JSON = path.join(PLUGIN, ".claude-plugin", "plugin.json");
const MARKETPLACE_JSON = path.join(ROOT, ".claude-plugin", "marketplace.json");

const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// Minimal frontmatter reader — enough to grab name/description for validation.
function frontmatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const block = m[1];
  const grab = (key) => {
    const mm = block.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"));
    return mm ? mm[1].replace(/^["']|["']$/g, "") : null;
  };
  return { name: grab("name"), description: grab("description") };
}

test("version is in sync across VERSION, plugin.json, and marketplace.json", () => {
  const v = fs.readFileSync(VERSION_FILE, "utf8").trim();
  assert.strictEqual(
    readJSON(PLUGIN_JSON).version,
    v,
    "plugin.json version != VERSION",
  );
  assert.strictEqual(
    readJSON(MARKETPLACE_JSON).metadata.version,
    v,
    "marketplace.json metadata.version != VERSION",
  );
});

test("plugin.json has a name and resolvable component paths", () => {
  const m = readJSON(PLUGIN_JSON);
  assert.ok(m.name, "plugin.json missing name");
  for (const rel of m.agents || []) {
    assert.ok(
      fs.existsSync(path.join(PLUGIN, rel)),
      `agent path does not resolve: ${rel}`,
    );
  }
  for (const key of ["hooks", "skills", "commands"]) {
    if (m[key]) {
      assert.ok(
        fs.existsSync(path.join(PLUGIN, m[key])),
        `${key} path does not resolve: ${m[key]}`,
      );
    }
  }
});

test("marketplace.json has required keys and a resolvable source", () => {
  const m = readJSON(MARKETPLACE_JSON);
  assert.ok(m.name, "marketplace.json missing name");
  assert.ok(m.owner, "marketplace.json missing owner");
  assert.ok(
    Array.isArray(m.plugins) && m.plugins.length,
    "marketplace.json missing plugins[]",
  );
  for (const p of m.plugins) {
    assert.ok(p.name, "plugin entry missing name");
    assert.ok(
      fs.existsSync(path.join(ROOT, p.source)),
      `plugin source does not resolve: ${p.source}`,
    );
  }
});

test("every skill has frontmatter with name matching its directory and a description", () => {
  const skillsDir = path.join(PLUGIN, "skills");
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(skillsDir, entry.name, "SKILL.md");
    assert.ok(fs.existsSync(skillMd), `skill ${entry.name} has no SKILL.md`);
    const fm = frontmatter(skillMd);
    assert.ok(fm, `skill ${entry.name} SKILL.md has no frontmatter`);
    assert.strictEqual(
      fm.name,
      entry.name,
      `skill name "${fm.name}" != dir "${entry.name}"`,
    );
    assert.ok(fm.description, `skill ${entry.name} missing description`);
  }
});

test("every command has a description and (when present) a name matching its filename", () => {
  const cmdDir = path.join(PLUGIN, "commands");
  for (const file of fs.readdirSync(cmdDir)) {
    if (!file.endsWith(".md")) continue;
    const fm = frontmatter(path.join(cmdDir, file));
    assert.ok(fm, `command ${file} has no frontmatter`);
    assert.ok(fm.description, `command ${file} missing description`);
    if (fm.name) {
      assert.strictEqual(
        fm.name,
        file.replace(/\.md$/, ""),
        `command name "${fm.name}" != filename "${file}"`,
      );
    }
  }
});

test("explicit ./ sibling .md references in SKILL.md files resolve", () => {
  const skillsDir = path.join(PLUGIN, "skills");
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(skillsDir, entry.name);
    const skillMd = path.join(dir, "SKILL.md");
    if (!fs.existsSync(skillMd)) continue;
    const body = fs.readFileSync(skillMd, "utf8");
    const refs = new Set(body.match(/\.\/[\w./-]+\.md/g) || []);
    for (const ref of refs) {
      // A "./" ref may target a sibling file in this skill's own dir, or a cross-skill
      // file under skills/ (e.g. ./grill-with-docs/CONTEXT-FORMAT.md). Accept either base.
      const resolves =
        fs.existsSync(path.join(dir, ref)) ||
        fs.existsSync(path.join(skillsDir, ref));
      assert.ok(
        resolves,
        `${entry.name}/SKILL.md references a missing file: ${ref}`,
      );
    }
  }
});
