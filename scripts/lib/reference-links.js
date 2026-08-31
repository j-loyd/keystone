"use strict";
/**
 * reference-links.js — every relative markdown link inside a skill must resolve
 * relative to that skill's own directory.
 *
 * SCOPE, deliberately narrow:
 *   - Only files under plugins/keystone/skills/** (SKILL.md and its sibling
 *     reference files). Commands and repo-root docs are out of scope.
 *   - Only markdown link syntax `](target)`. Bare paths in prose are NOT checked:
 *     skills legitimately name paths that do not exist in this repo (tasks/todo.md,
 *     docs/adr/, CONTEXT.md), because they describe what to create in the *user's*
 *     repo, not what exists here.
 *   - Only targets whose path component ends in `.md`. Scripts, TypeScript
 *     examples, and images are linked too but are not this check's business.
 *   - Fenced code blocks and inline code spans are stripped first, so example
 *     links written for the reader are not mistaken for real references.
 *   - http(s)/mailto targets and pure `#anchor` links are skipped.
 *
 * `../` forms are supported and load-bearing: improve-codebase-architecture links
 * to ../grill-with-docs/ADR-FORMAT.md.
 *
 * Node stdlib only.
 */

const fs = require("node:fs");
const path = require("node:path");

const { findMarkdownLinks, walkMarkdown } = require("./markdown.js");

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Dead markdown references in one file, as { file, target, line, resolved }.
 * Resolution is always against the file's own directory — the property the
 * cross-skill `../` links depend on.
 */
function checkLinksInFile(file) {
  let source;
  try {
    source = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const dir = path.dirname(file);
  const dead = [];
  for (const link of findMarkdownLinks(source)) {
    const target = link.target;
    if (EXTERNAL.test(target) || target.startsWith("#")) continue;
    const [pathPart] = target.split("#");
    if (!pathPart || !pathPart.toLowerCase().endsWith(".md")) continue;
    const resolved = path.resolve(dir, decodeURIComponent(pathPart));
    if (fs.existsSync(resolved)) continue;
    dead.push({ file, target, line: link.line, resolved });
  }
  return dead;
}

/** Walk every markdown file under `skillsDir` and check its links. */
function checkSkillLinks(skillsDir) {
  const files = walkMarkdown(skillsDir);
  const dead = [];
  let linksChecked = 0;
  for (const file of files) {
    let source;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const link of findMarkdownLinks(source)) {
      const [pathPart] = link.target.split("#");
      if (EXTERNAL.test(link.target) || link.target.startsWith("#")) continue;
      if (!pathPart || !pathPart.toLowerCase().endsWith(".md")) continue;
      linksChecked++;
    }
    dead.push(...checkLinksInFile(file));
  }
  return { ok: dead.length === 0, filesScanned: files.length, linksChecked, dead };
}

module.exports = { checkLinksInFile, checkSkillLinks };
