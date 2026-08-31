#!/usr/bin/env node
"use strict";
/**
 * validate-versions.js — keystone's version must be identical in all three
 * release-critical files (see CLAUDE.md "Releasing — bump the version as a unit").
 *
 *   node scripts/validate-versions.js
 *   node scripts/validate-versions.js --root /path/to/checkout
 *
 * Exits non-zero and names every mismatching path and its value. This replaces the
 * manual `grep -rn "<old-version>"` step CLAUDE.md asks for after a bump.
 *
 * Rule logic lives in scripts/lib/version-check.js; this is a thin wrapper.
 */

const { runCli } = require("./lib/cli.js");
const { checkVersions } = require("./lib/version-check.js");

const USAGE = `Usage: node scripts/validate-versions.js [options]

  --root <dir>   repository root to check (default: this checkout)
  --verbose      list every version source, not just the problems
  --help         show this message`;

function body(options) {
  const result = checkVersions(options.root);
  const lines = ["keystone version consistency", ""];

  for (const entry of result.entries) {
    if (entry.error) lines.push(`  ✗ ${entry.path} (${entry.label}) — ${entry.error}`);
    else if (!result.ok || options.verbose) {
      const mark = entry.value === result.version ? "✓" : "✗";
      lines.push(`  ${mark} ${entry.path} (${entry.label}) — ${entry.value}`);
    }
  }

  if (result.problems.length) {
    lines.push("", `Problems (${result.problems.length})`);
    for (const problem of result.problems) lines.push(`  ✗ ${problem}`);
  } else {
    lines.push(`  ✓ all ${result.entries.length} sources agree on ${result.version}`);
  }

  lines.push("", result.ok ? "PASSED" : "FAILED");
  return { lines, failed: !result.ok };
}

if (require.main === module) runCli({ usage: USAGE, body });

module.exports = { USAGE, body };
