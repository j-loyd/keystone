"use strict";
/**
 * cli.js — the argument handling the three catalog validators share.
 * Node stdlib only.
 */

const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Parse `--root <dir>`, `--verbose`/`-v`, and `--help`/`-h`.
 * Throws on anything else, so a typo fails loudly instead of being ignored.
 */
function parseArgs(argv) {
  const options = { root: REPO_ROOT, verbose: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--verbose" || arg === "-v") options.verbose = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--root") {
      const value = argv[++i];
      if (!value) throw new Error("--root needs a directory");
      options.root = path.resolve(value);
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

/**
 * Wrap a validator body in the shared CLI shell: parse, --help, report, exit code.
 * `body(options)` returns { lines, failed }.
 */
function runCli({ usage, body }, argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (e) {
    console.error(`${e.message}\n\n${usage}`);
    process.exitCode = 1;
    return;
  }
  if (options.help) {
    console.log(usage);
    return;
  }
  let result;
  try {
    result = body(options);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
    return;
  }
  console.log(result.lines.join("\n"));
  if (result.failed) process.exitCode = 1;
}

module.exports = { REPO_ROOT, parseArgs, runCli };
