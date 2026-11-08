"use strict";
/**
 * cross-refs.js — bare cross-skill references must resolve to something that exists.
 *
 * reference-links.js only checks `](./path.md)` links. Most cross-skill references in
 * keystone are bare names instead, so a deleted skill used to leave its callers
 * pointing at nothing while CI stayed green. This check closes that gap for three
 * reference shapes, chosen because each one unambiguously means "a keystone (or
 * built-in) skill, command, or agent":
 *
 *   1. `keystone:<name>`        — the namespaced form (Skill tool, subagent_type).
 *                                 Checked everywhere, fenced code included.
 *   2. `/<name>`                — a slash command, in prose or as an inline code span.
 *                                 Fenced code is skipped (shell paths live there), and
 *                                 the slash must start a token: `a/b`, `./x`, `~/x`,
 *                                 `</div>`, and `/x/y` paths never match.
 *   3. `` `<name>` skill ``     — a backticked name explicitly called a skill,
 *      `` the skill `<name>` ``   command, agent, or subagent ("the" is required in
 *                                 the second form; bare "command `x`" is too noisy).
 *                                 A bare backtick sweep is deliberately NOT done:
 *                                 ordinary identifiers are backticked everywhere.
 *
 * A name resolves when it is a keystone skill directory, command file, or agent file,
 * a Claude Code built-in slash command (BUILTIN_COMMANDS), or a documented exemption
 * (NOT_REFERENCES, plus skill-lint's REFERENCE_EXEMPTIONS). Every exemption carries a
 * reason; adding one is a deliberate edit to this file, never something a skill can do
 * for itself.
 *
 * Node stdlib only. Walks with fs.readdirSync (never grep: see markdown.js header).
 */

const fs = require("node:fs");
const path = require("node:path");

const { lineOf, stripFencedCode, walkMarkdown } = require("./markdown.js");
const { REFERENCE_EXEMPTIONS } = require("./skill-lint.js");

/**
 * Claude Code built-in slash commands (and bundled skills) keystone prose may name.
 * Not exhaustive of the harness — only what a keystone doc plausibly points at.
 */
const BUILTIN_COMMANDS = new Set([
  "add-dir", "agents", "batch", "btw", "bug", "clear", "code-review", "compact",
  "config", "context", "cost", "doctor", "exit", "export", "feedback", "goal", "help",
  "hooks", "init", "insights", "login", "logout", "loop", "mcp", "memory", "model",
  "permissions", "plan", "plugin", "pr-comments", "release-notes", "resume", "review",
  "rewind", "sandbox", "schedule", "security-review", "simplify", "skills", "status",
  "statusline", "tasks", "terminal-setup", "todos", "usage", "verify",
]);

/** Names that look like references but are routes, paths, or harness built-ins. Each has a reason. */
const NOT_REFERENCES = [
  { name: "general-purpose", reason: "the harness's built-in general-purpose subagent type" },
  {
    name: "worktree",
    reason: "using-git-worktrees names a generic harness `/worktree` command as one way a host may expose worktrees",
  },
  { name: "tmp", reason: "the /tmp filesystem path (temp-dir fallbacks)" },
  { name: "v1", reason: "an API route segment (api-security: retire deprecated /v1 endpoints)" },
  { name: "test", reason: "an API route segment (api-security: debug routes like /test)" },
];

const EXEMPT = new Set([
  ...BUILTIN_COMMANDS,
  ...NOT_REFERENCES.map((e) => e.name),
  ...REFERENCE_EXEMPTIONS.map((e) => e.name),
]);

const NAME = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";

const NAMESPACED = new RegExp(`\\bkeystone:(${NAME})(?![\\w-])`, "g");

// In prose the slash must open a token (start of line, whitespace, or an opening
// delimiter) and close it too: no further path segment, extension, or word char.
const SLASH = new RegExp(`(?:^|(?<=[\\s(\\["'*|]))/(${NAME})(?![\\w/-]|\\.\\w)`, "gm");

// An inline code span that opens with a slash command: `/name` or `/name args`.
const CODE_SPAN = /`([^`\n]*)`/g;
const SPAN_COMMAND = new RegExp(`^/(${NAME})(?:\\s|$)`);

/**
 * Blank code spans with a word character (not a space), so the prose scan sees
 * `x`/high-blast as one token — the slash there follows code, it does not open a
 * command. Offsets survive, as with markdown.js's strippers.
 */
function maskCodeSpans(text) {
  return text.replace(CODE_SPAN, (span) => span.replace(/[^\n]/g, "x"));
}

const KIND = "(?:skills?|commands?|agents?|subagents?)";
const BACKTICKED = new RegExp(
  `\`/?(${NAME})\`\\s+${KIND}\\b|\\bthe\\s+${KIND}\\s+\`/?(${NAME})\``,
  "g",
);

/** Every bare cross-reference in `text`, as { kind, name, line, raw }. */
function findCrossReferences(text) {
  const source = String(text);
  const found = [];
  const push = (kind, name, index, raw) =>
    found.push({ kind, name, line: lineOf(source, index), raw });

  let m;
  NAMESPACED.lastIndex = 0;
  while ((m = NAMESPACED.exec(source)) !== null) push("namespaced", m[1], m.index, m[0]);

  const prose = stripFencedCode(source);
  CODE_SPAN.lastIndex = 0;
  while ((m = CODE_SPAN.exec(prose)) !== null) {
    const cmd = m[1].match(SPAN_COMMAND);
    if (cmd) push("slash", cmd[1], m.index, `/${cmd[1]}`);
  }
  const masked = maskCodeSpans(prose);
  SLASH.lastIndex = 0;
  while ((m = SLASH.exec(masked)) !== null) push("slash", m[1], m.index, m[0]);

  BACKTICKED.lastIndex = 0;
  while ((m = BACKTICKED.exec(prose)) !== null) {
    push("backticked", m[1] || m[2], m.index, m[0].trim());
  }
  return found;
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function listBasenames(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}

/** Skill, command, and agent names the plugin actually ships. */
function knownNames(pluginDir) {
  const skillsDir = path.join(pluginDir, "skills");
  return new Set([
    ...listDirs(skillsDir).filter((d) => fs.existsSync(path.join(skillsDir, d, "SKILL.md"))),
    ...listBasenames(path.join(pluginDir, "commands")),
    ...listBasenames(path.join(pluginDir, "agents")),
  ]);
}

/**
 * The files whose cross-references are checked: the whole plugin (markdown plus
 * hooks.json, whose additionalContext text tells the model which command to run),
 * the README, and the shipped templates and continuity docs. CHANGELOG and
 * ATTRIBUTION are history and provenance — they name removed and upstream things
 * on purpose — so they are out of scope.
 */
function scanFiles(root) {
  const plugin = path.join(root, "plugins", "keystone");
  const files = [
    ...walkMarkdown(plugin),
    path.join(plugin, "hooks", "hooks.json"),
    path.join(root, "README.md"),
    ...walkMarkdown(path.join(root, "templates")),
    ...walkMarkdown(path.join(root, "docs", "handoffs")),
  ];
  return files.filter((f) => fs.existsSync(f));
}

/** Check every scanned file; dangling refs as { file, line, kind, name, raw }. */
function checkCrossReferences(root) {
  const known = knownNames(path.join(root, "plugins", "keystone"));
  const files = scanFiles(root);
  const dangling = [];
  let refsChecked = 0;
  for (const file of files) {
    let source;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const ref of findCrossReferences(source)) {
      refsChecked++;
      if (known.has(ref.name)) continue;
      if (ref.kind !== "namespaced" && EXEMPT.has(ref.name)) continue;
      dangling.push({ file, ...ref });
    }
  }
  return { ok: dangling.length === 0, filesScanned: files.length, refsChecked, dangling };
}

module.exports = {
  BUILTIN_COMMANDS,
  NOT_REFERENCES,
  checkCrossReferences,
  findCrossReferences,
  knownNames,
};
