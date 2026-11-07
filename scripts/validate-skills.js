#!/usr/bin/env node
"use strict";
/**
 * validate-skills.js — keystone's own skill-frontmatter and cross-reference rules.
 *
 *   node scripts/validate-skills.js
 *   node scripts/validate-skills.js --verbose     # also lists the exemptions
 *
 * Rules (see scripts/lib/skill-lint.js for the reasoning):
 *   - frontmatter carries `name` and `description` only
 *   - `name` matches the directory, and both are kebab-case
 *   - `description` says WHEN to use the skill, not only what it does
 *   - warn (never error) on a description past the length ratchet
 *   - error on a backticked skill/command reference that resolves to nothing
 *   - error on an unbraced $CLAUDE_PLUGIN_ROOT or a ${CLAUDE_PLUGIN_ROOT:-...} default
 *     form in any shipped .md (only the literal braced form is known to be substituted;
 *     use the two-step R="${CLAUDE_PLUGIN_ROOT}"; [ -f ... ] || R="${PLUGIN_ROOT}" fallback)
 *
 * Exemptions live in the validator, never in skill frontmatter, so a skill cannot
 * exempt itself. Warnings do not affect the exit code.
 */

const path = require("node:path");

const { runCli } = require("./lib/cli.js");
const {
  DESCRIPTION_WARN_CHARS,
  PLUGIN_ROOT_EXEMPTIONS,
  REFERENCE_EXEMPTIONS,
  lintCatalog,
} = require("./lib/skill-lint.js");

const USAGE = `Usage: node scripts/validate-skills.js [options]

  --root <dir>   repository root to check (default: this checkout)
  --verbose      list every skill, and the reference exemptions with their reasons
  --help         show this message`;

function body(options) {
  const pluginDir = path.join(options.root, "plugins", "keystone");
  const result = lintCatalog({
    skillsDir: path.join(pluginDir, "skills"),
    commandsDir: path.join(pluginDir, "commands"),
    agentsDir: path.join(pluginDir, "agents"),
  });

  const lines = [`keystone skill catalog — ${result.skills.length} skill(s)`, ""];

  if (options.verbose) {
    for (const skill of result.skills) {
      const mark = skill.errors.length ? "✗" : skill.warnings.length ? "⚠" : "✓";
      lines.push(`  ${mark} ${skill.dir} (${skill.descriptionLength} chars)`);
    }
    lines.push("", `Reference exemptions (${REFERENCE_EXEMPTIONS.length})`);
    for (const entry of REFERENCE_EXEMPTIONS) {
      lines.push(`  · \`${entry.name}\` — ${entry.reason}`);
    }
    lines.push("", `Plugin-root exemptions (${PLUGIN_ROOT_EXEMPTIONS.length})`);
    for (const entry of PLUGIN_ROOT_EXEMPTIONS) {
      lines.push(`  · ${entry.file} (${entry.form} form) — ${entry.reason}`);
    }
    lines.push("");
  }

  if (result.warnings.length) {
    lines.push(`Warnings (${result.warnings.length}) — advisory, do not fail the run`);
    for (const warning of result.warnings) lines.push(`  ⚠ ${warning}`);
    lines.push("");
  }

  if (result.errors.length) {
    lines.push(`Errors (${result.errors.length})`);
    for (const error of result.errors) lines.push(`  ✗ ${error}`);
  } else {
    lines.push("  ✓ frontmatter, naming, trigger clauses, cross-references, and plugin-root references all clean");
    lines.push(`  ✓ no description over the ${DESCRIPTION_WARN_CHARS}-char ratchet`);
  }

  lines.push("", result.ok ? "PASSED" : "FAILED");
  return { lines, failed: !result.ok };
}

if (require.main === module) runCli({ usage: USAGE, body });

module.exports = { USAGE, body };
