#!/usr/bin/env node
"use strict";
/**
 * validate-reference-links.js — every relative markdown link inside a skill must
 * resolve relative to that skill's OWN directory. keystone has 13 multi-file
 * skills plus at least one cross-skill link
 * (improve-codebase-architecture -> ../grill-with-docs/ADR-FORMAT.md), so `../`
 * forms are supported and expected.
 *
 *   node scripts/validate-reference-links.js
 *   node scripts/validate-reference-links.js --verbose
 *
 * Scope is deliberately narrow — see the header of scripts/lib/reference-links.js.
 * In short: only `](target)` markdown links, only under plugins/keystone/skills/**,
 * only `.md` targets, and fenced code is stripped first, because skills legitimately
 * name paths that do not exist here (tasks/todo.md, docs/adr/).
 *
 * The tree is walked with fs.readdirSync, never `grep`: this shell's grep respects
 * .gitignore, which is exactly how an earlier reference census reported clean while
 * missing two dead references.
 */

const path = require("node:path");

const { runCli } = require("./lib/cli.js");
const { checkSkillLinks } = require("./lib/reference-links.js");

const USAGE = `Usage: node scripts/validate-reference-links.js [options]

  --root <dir>   repository root to check (default: this checkout)
  --verbose      print the per-file link counts
  --help         show this message`;

function body(options) {
  const skillsDir = path.join(options.root, "plugins", "keystone", "skills");
  const result = checkSkillLinks(skillsDir);
  const lines = [
    `Skill reference links — ${result.filesScanned} markdown file(s), ` +
      `${result.linksChecked} relative .md link(s)`,
    "",
  ];

  if (options.verbose) {
    lines.push(`  scanned: ${path.relative(options.root, skillsDir) || skillsDir}`);
  }

  if (result.dead.length) {
    lines.push(`Dead references (${result.dead.length})`);
    for (const dead of result.dead) {
      lines.push(`  ✗ ${path.relative(options.root, dead.file)}:${dead.line} -> ${dead.target}`);
      lines.push(`        resolves to ${dead.resolved}, which does not exist`);
    }
  } else {
    lines.push("  ✓ every relative markdown link resolves from its own skill directory");
  }

  lines.push("", result.ok ? "PASSED" : "FAILED");
  return { lines, failed: !result.ok };
}

if (require.main === module) runCli({ usage: USAGE, body });

module.exports = { USAGE, body };
