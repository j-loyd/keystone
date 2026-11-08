"use strict";
/**
 * skill-lint.js — keystone's own frontmatter and cross-reference rules.
 *
 * These are HOUSE rules, not a vendored upstream lint. keystone skills carry
 * `name` and `description`, plus `disable-model-invocation: true` on user-only
 * skills, and optionally the two documented invocation fields `argument-hint` and
 * `allowed-tools` (the former commands carry them). Nothing else. A model-invocable
 * skill may pre-approve only read-only tools (see unsafeModelTool). There is no
 * required-section list: the body shape is the author's call.
 *
 * User-only skills must be user-only on BOTH harnesses: Claude Code reads
 * `disable-model-invocation: true` from the frontmatter, Codex reads
 * `policy.allow_implicit_invocation: false` from the skill's `agents/openai.yaml`.
 * lintCatalog fails when one flag is set without the other.
 *
 * Integrity property, taken from upstream deliberately: exemptions live HERE, in
 * the validator, never in the artifact being validated. A skill cannot exempt
 * itself — and the closed frontmatter key list is what makes that airtight, since
 * any `validator-skip:`-style key is itself an error. Every exemption carries a
 * written reason.
 *
 * Node stdlib only.
 */

const fs = require("node:fs");
const path = require("node:path");

const { parseFrontmatter, stripFencedCode, lineOf, walkMarkdown } = require("./markdown.js");

/**
 * The only frontmatter keys a keystone skill may carry. `disable-model-invocation`
 * marks a user-only skill (its description is not loaded into context, and the model
 * cannot load it); it is optional and, when present, must be `true`. `argument-hint`
 * (autocomplete text) and `allowed-tools` (per-turn pre-approval) are Claude Code
 * skill fields the converted commands keep.
 */
const ALLOWED_KEYS = [
  "name",
  "description",
  "disable-model-invocation",
  "argument-hint",
  "allowed-tools",
];
const REQUIRED_KEYS = ["name", "description"];
const USER_ONLY_KEY = "disable-model-invocation";

/** Codex's per-skill policy: `allow_implicit_invocation: false` under `policy:`. */
const CODEX_NO_IMPLICIT = /^policy:[ \t]*\r?\n(?:[ \t]+.*\r?\n)*?[ \t]+allow_implicit_invocation:[ \t]*false\b/m;

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Description length at which we warn. Descriptions are always-loaded context, so
 * growth is a real cost — but the threshold is taken from the catalog's own
 * distribution rather than invented: across the 30 skills the shortest is 230
 * chars, the median 331, p90 434, and the longest 512 (security-review). 550 sits
 * just above the observed ceiling, so it is a ratchet on growth: nothing warns
 * today, and any description that grows past the current worst case gets flagged.
 * Warn-only on purpose — a long description can be the right call.
 */
const DESCRIPTION_WARN_CHARS = 550;

/**
 * SKILL.md body budget (repo CLAUDE.md: "SKILL.md files stay under ~500 lines; push depth
 * into sibling reference files"). Warn-only, like the description ratchet: the "~" is real,
 * and the fix is a judgment call about what to move out.
 */
const SKILL_LINES_WARN = 500;

/**
 * Backticked names that are NOT keystone skills or commands but are legitimate
 * references. Each entry states why. Adding an entry is a deliberate act recorded
 * in this file's history; it cannot be done from inside a skill.
 */
const REFERENCE_EXEMPTIONS = [
  {
    name: "impeccable",
    reason:
      "External design/UI plugin. keystone deliberately excludes the design layer " +
      "(README: 'Design is intentionally out of scope — the impeccable suite stays a " +
      "separate plugin'), so a skill that routes UI work elsewhere names it.",
  },
  {
    name: "clear",
    reason:
      "Claude Code's built-in /clear command, not a keystone skill. " +
      "skills/handoff/SKILL.md documents the /handoff -> /clear -> /pickup flow, which " +
      "only makes sense naming the built-in.",
  },
  {
    name: "security-audit",
    reason:
      "Cloudflare's security-audit skill, an optional companion listed as a separate " +
      "entry in keystone's marketplace.json (not part of the keystone plugin). /cso and " +
      "the security skills hand full-audit methodology off to it by name.",
  },
];

const EXEMPT_NAMES = new Set(REFERENCE_EXEMPTIONS.map((e) => e.name));

// ---------- trigger clauses ----------

/**
 * Words that bind usage to a SITUATION rather than to a purpose. "Use to format
 * numbers" says what the skill does; "Use when a test fails" says when to reach
 * for it, which is the only thing a router can act on.
 */
const SITUATION =
  /\b(?:when|whenever|before|after|during|while|upon|immediately|as soon as|any ?time|at the (?:start|end|point|moment)|on first)\b/i;

/** Verbs that introduce a usage instruction. */
const USE_LEAD = /\b(?:use|using|load|invoke|apply|reach for)\b/gi;

/**
 * A negator immediately before the usage verb. "Do not use when X" describes an
 * exclusion, not a trigger, and must not satisfy the rule.
 */
const NEGATOR =
  /(?:\bdo(?:es)?\s+not\b|\bdon['’]t\b|\bnever\b|\bavoid\b|\brather\s+than\b|\binstead\s+of\b|\bnot\b)[^.]{0,12}$/i;

/** An explicit trigger declaration is a trigger clause on its own terms. */
const EXPLICIT_TRIGGER = /\btrigger(?:s|ed)?\s+(?:on|when|whenever|for)\b|^TRIGGER\b/im;

/** Split on sentence boundaries. Imperfect on "e.g."; harmless here. */
function sentences(text) {
  return String(text).split(/(?<=[.!?])\s+(?=[A-Z(“"'[])/);
}

/**
 * Does this description say WHEN to use the skill?
 * Returns { ok, evidence, reason }.
 */
function hasTriggerClause(description) {
  const text = String(description || "");
  const explicit = text.match(EXPLICIT_TRIGGER);
  if (explicit) return { ok: true, evidence: explicit[0], reason: null };

  for (const sentence of sentences(text)) {
    if (!SITUATION.test(sentence)) continue;
    USE_LEAD.lastIndex = 0;
    let match;
    while ((match = USE_LEAD.exec(sentence)) !== null) {
      if (NEGATOR.test(sentence.slice(0, match.index))) continue;
      const situation = sentence.match(SITUATION);
      return {
        ok: true,
        evidence: `${match[0]} … ${situation[0]}`.trim(),
        reason: null,
      };
    }
  }
  return {
    ok: false,
    evidence: null,
    reason:
      'no trigger clause — say when to use it ("Use when …", "Use before/after/during …"), ' +
      "not only what it does",
  };
}

// ---------- cross-skill references ----------

/**
 * Explicit reference phrasings only. A broad backtick sweep is useless here:
 * ordinary tokens like `express-rate-limit`, `measured-now`, and `invoiceDate`
 * are backticked throughout the catalog, and every one would be a false positive.
 */
const REFERENCE_PHRASE =
  /(?:\b(?:see|load|invoke)\s+(?:the\s+)?|→\s*|->\s*)`([^`\n]+)`|`([^`\n]+)`\s+skill\b/gi;

/**
 * Backticked skill/command references in `text`, as { name, line, phrase }.
 * Fenced code is stripped first. A candidate must look like a skill or command
 * name (kebab-case, optionally slash-prefixed) — which is what filters out
 * filenames (`DEEPENING.md`), paths (`./parallel-waves.md`), and identifiers
 * (`invoiceDate`).
 */
function findSkillReferences(text) {
  const source = String(text);
  const scannable = stripFencedCode(source);
  const found = [];
  REFERENCE_PHRASE.lastIndex = 0;
  let match;
  while ((match = REFERENCE_PHRASE.exec(scannable)) !== null) {
    const raw = (match[1] || match[2] || "").trim();
    const name = raw.replace(/^\//, "");
    if (!KEBAB.test(name)) continue;
    found.push({ name, line: lineOf(source, match.index), phrase: match[0].trim() });
  }
  return found;
}

// ---------- plugin-root substitution ----------

/**
 * Only the literal braced `${CLAUDE_PLUGIN_ROOT}` is known to be substituted by Claude
 * Code in shipped markdown. Two forms are rejected:
 *   - unbraced `$CLAUDE_PLUGIN_ROOT`: reaches the shell as a plain, usually unset, env
 *     var, so `node "$CLAUDE_PLUGIN_ROOT/hooks/x.js"` quietly runs `/hooks/x.js`;
 *   - `${CLAUDE_PLUGIN_ROOT:-...}`: whether the default-value form is substituted is
 *     unverified.
 * The supported pattern for both harnesses is the two-step fallback hooks.json uses:
 *   R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/<file>" ] || R="${PLUGIN_ROOT}"
 * (substituted on Claude Code; empty on Codex, which then uses its $PLUGIN_ROOT env var).
 * Fenced code is NOT stripped: the commands that matter live in fenced bash blocks.
 */
const PLUGIN_ROOT_MISUSE = [
  { form: "unbraced", re: /\$CLAUDE_PLUGIN_ROOT(?![A-Za-z0-9_])/g },
  { form: "default", re: /\$\{CLAUDE_PLUGIN_ROOT:-/g },
];

/**
 * Files allowed to keep a rejected form, by path relative to the plugin root, as
 * { file, form, reason }. Each entry states why; as with REFERENCE_EXEMPTIONS, a file
 * cannot exempt itself. Empty since 1.0 deleted the two files the 0.9.1 patch exempted.
 */
const PLUGIN_ROOT_EXEMPTIONS = [];

/** Every rejected plugin-root reference in `text`, as { line, form }, in source order. */
function findPluginRootMisuse(text) {
  const source = String(text);
  const found = [];
  for (const { form, re } of PLUGIN_ROOT_MISUSE) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) !== null) {
      found.push({ index: match.index, line: lineOf(source, match.index), form });
    }
  }
  return found.sort((a, b) => a.index - b.index).map(({ line, form }) => ({ line, form }));
}

const PLUGIN_ROOT_FIX = {
  unbraced: "unbraced $CLAUDE_PLUGIN_ROOT is not substituted by the harness",
  default: "${CLAUDE_PLUGIN_ROOT:-...} substitution is unverified",
};

// ---------- allowed-tools on model-invocable skills ----------

/**
 * `allowed-tools` pre-approves tools for the turn that invokes a skill. On a skill the
 * model can invoke by itself, that grant is reachable without a human: the model (or a
 * prompt injection steering it) invokes the skill and gets the tools unprompted. So a
 * model-invocable skill may pre-approve only read-only tools and narrowly scoped,
 * read-only Bash patterns. User-only skills (disable-model-invocation: true) may keep
 * broader grants, because a human typed the command. Fails closed: any tool not on the
 * read-only list (Write, Edit, NotebookEdit, unscoped Bash, every MCP tool, WebFetch, ...)
 * is an error.
 */
const READ_ONLY_TOOLS = new Set(["Read", "Grep", "Glob"]);

/**
 * Exact Bash(...) scopes a model-invocable skill may pre-approve. Exact commands only, no
 * wildcards: git's read commands accept write flags (`git log --output=<file>` and
 * `git diff --output=<file>` both write a file), so `Bash(git log *)` is a prompt-free
 * file write. `git branch` / `git remote` are excluded: their arguments delete or rewire.
 */
const READ_ONLY_BASH = [/^git status$/, /^git rev-parse --show-toplevel$/, /^ls$/, /^pwd$/];

/** Split an allowed-tools value (YAML list folded by parseFrontmatter, or a space/comma
 *  string) into tools, keeping `Bash(git log *)` together. Exported for tests. */
function parseAllowedTools(value) {
  const tools = [];
  let cur = "";
  let depth = 0;
  for (const ch of String(value || "")) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && /[\s,]/.test(ch)) {
      if (cur) tools.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) tools.push(cur);
  return tools.filter((t) => t !== "-");
}

/** Why `tool` is too broad to pre-approve on a model-invocable skill, or null. */
function unsafeModelTool(tool) {
  if (READ_ONLY_TOOLS.has(tool)) return null;
  const bash = tool.match(/^Bash\((.*)\)$/s);
  if (bash) {
    const scope = bash[1].trim();
    if (/[;&|`$<>\n]/.test(scope)) return "a Bash scope with shell operators";
    if (/[*?]/.test(scope)) return "a wildcard Bash scope (read commands like git log/diff take --output=<file>)";
    if (READ_ONLY_BASH.some((re) => re.test(scope))) return null;
    return "a Bash scope that isn't a read-only command";
  }
  if (tool === "Bash") return "unscoped Bash";
  if (/^mcp__/.test(tool)) return "an MCP tool";
  return "a tool that isn't read-only";
}

// ---------- per-skill rules ----------

/**
 * Lint one skill from its directory name and SKILL.md source. Pure — no fs — so
 * every frontmatter rule is unit-testable without a fixture tree.
 */
function lintSkill(dir, source) {
  const errors = [];
  const warnings = [];
  const parsed = parseFrontmatter(source);

  if (!parsed) {
    errors.push(`${dir}/SKILL.md: no YAML frontmatter block at the top of the file`);
    return { dir, name: null, description: null, descriptionLength: 0, errors, warnings };
  }

  const { keys, values } = parsed;
  const extras = keys.filter((k) => !ALLOWED_KEYS.includes(k));
  if (extras.length) {
    errors.push(
      `${dir}/SKILL.md: frontmatter carries ${extras.map((k) => `"${k}"`).join(", ")} — ` +
        "keystone skills declare only name, description, disable-model-invocation, " +
        "argument-hint, and allowed-tools",
    );
  }
  for (const key of REQUIRED_KEYS) {
    if (!keys.includes(key) || !values[key]) {
      errors.push(`${dir}/SKILL.md: frontmatter is missing "${key}"`);
    }
  }
  const userOnly = keys.includes(USER_ONLY_KEY);
  if (userOnly && values[USER_ONLY_KEY] !== "true") {
    errors.push(
      `${dir}/SKILL.md: "${USER_ONLY_KEY}" must be true when present ` +
        "(omit it for a model-invocable skill)",
    );
  }

  const name = values.name || null;
  const description = values.description || null;

  const isUserOnly = userOnly && values[USER_ONLY_KEY] === "true";
  if (!isUserOnly && keys.includes("allowed-tools")) {
    for (const tool of parseAllowedTools(values["allowed-tools"])) {
      const why = unsafeModelTool(tool);
      if (why) {
        errors.push(
          `${dir}/SKILL.md: allowed-tools pre-approves "${tool}" (${why}) on a model-invocable ` +
            "skill, so the model could grant it to itself — keep read-only tools and scoped " +
            "read-only Bash, or make the skill user-only",
        );
      }
    }
  }

  if (!KEBAB.test(dir)) {
    errors.push(`${dir}/SKILL.md: directory name "${dir}" is not kebab-case`);
  }
  if (name) {
    if (!KEBAB.test(name)) {
      errors.push(`${dir}/SKILL.md: name "${name}" is not kebab-case`);
    } else if (name !== dir) {
      errors.push(`${dir}/SKILL.md: name "${name}" does not match its directory "${dir}"`);
    }
  }

  if (description) {
    const trigger = hasTriggerClause(description);
    if (!trigger.ok) errors.push(`${dir}/SKILL.md: ${trigger.reason}`);
    if (description.length > DESCRIPTION_WARN_CHARS) {
      warnings.push(
        `${dir}/SKILL.md: description is ${description.length} chars ` +
          `(over ${DESCRIPTION_WARN_CHARS}) — it is always-loaded context`,
      );
    }
  }

  const lines = String(source).split("\n").length;
  if (lines > SKILL_LINES_WARN) {
    warnings.push(
      `${dir}/SKILL.md: ${lines} lines (over the ~${SKILL_LINES_WARN}-line budget) — ` +
        "push depth into sibling reference files",
    );
  }

  return {
    dir,
    name,
    description,
    descriptionLength: description ? description.length : 0,
    userOnly: userOnly && values[USER_ONLY_KEY] === "true",
    errors,
    warnings,
  };
}

/**
 * Both harnesses must agree on whether a skill is user-only. `yamlSource` is the
 * skill's agents/openai.yaml text, or null when the file is absent.
 */
function lintHarnessParity(dir, userOnly, yamlSource) {
  const codexUserOnly = yamlSource !== null && CODEX_NO_IMPLICIT.test(yamlSource);
  if (userOnly && !codexUserOnly) {
    return [
      `${dir}/: user-only skill (disable-model-invocation: true) needs agents/openai.yaml ` +
        "with policy.allow_implicit_invocation: false, or Codex will still auto-invoke it",
    ];
  }
  if (!userOnly && codexUserOnly) {
    return [
      `${dir}/: agents/openai.yaml disables implicit invocation but SKILL.md lacks ` +
        "disable-model-invocation: true, so Claude Code will still auto-invoke it",
    ];
  }
  return [];
}

// ---------- catalog ----------

function listDirs(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function listBasenames(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name.replace(/\.md$/, ""))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Lint the whole catalog: every skill's frontmatter, plus dead cross-references
 * across skill and command markdown. Commands are scanned for references (they
 * point at skills constantly) but are not held to the skill frontmatter rules —
 * they legitimately carry argument-hint and allowed-tools.
 */
function lintCatalog({
  skillsDir,
  commandsDir = null,
  agentsDir = null,
  pluginRootExemptions = PLUGIN_ROOT_EXEMPTIONS,
} = {}) {
  const errors = [];
  const warnings = [];
  const skills = [];

  const skillDirs = listDirs(skillsDir);
  for (const dir of skillDirs) {
    const file = path.join(skillsDir, dir, "SKILL.md");
    if (!fs.existsSync(file)) {
      errors.push(`${dir}/: directory under skills/ has no SKILL.md`);
      continue;
    }
    const result = lintSkill(dir, fs.readFileSync(file, "utf8"));
    skills.push(result);
    errors.push(...result.errors);
    const yamlFile = path.join(skillsDir, dir, "agents", "openai.yaml");
    const yamlSource = fs.existsSync(yamlFile) ? fs.readFileSync(yamlFile, "utf8") : null;
    errors.push(...lintHarnessParity(dir, result.userOnly, yamlSource));
    warnings.push(...result.warnings);
  }

  const commands = commandsDir ? listBasenames(commandsDir) : [];
  const agents = agentsDir ? listBasenames(agentsDir) : [];
  const known = new Set([...skillDirs, ...commands, ...agents]);

  const files = [...walkMarkdown(skillsDir), ...(commandsDir ? walkMarkdown(commandsDir) : [])];
  const scanRoot = path.dirname(skillsDir);
  for (const file of files) {
    let source;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const ref of findSkillReferences(source)) {
      if (known.has(ref.name) || EXEMPT_NAMES.has(ref.name)) continue;
      errors.push(
        `${path.relative(scanRoot, file)}:${ref.line}: references \`${ref.name}\`, ` +
          "which is not a keystone skill, command, or declared exemption",
      );
    }
  }

  // Plugin-root references in every shipped .md under the plugin root (skills, commands,
  // agents, templates, ...), minus the declared exemptions.
  for (const file of walkMarkdown(scanRoot)) {
    let source;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const rel = path.relative(scanRoot, file).split(path.sep).join("/");
    for (const hit of findPluginRootMisuse(source)) {
      if (pluginRootExemptions.some((e) => e.file === rel && e.form === hit.form)) continue;
      errors.push(
        `${rel}:${hit.line}: ${PLUGIN_ROOT_FIX[hit.form]} — use ` +
          'R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/<file>" ] || R="${PLUGIN_ROOT}"',
      );
    }
  }

  return { ok: errors.length === 0, skills, known: [...known].sort(), errors, warnings };
}

module.exports = {
  ALLOWED_KEYS,
  DESCRIPTION_WARN_CHARS,
  KEBAB,
  SKILL_LINES_WARN,
  REFERENCE_EXEMPTIONS,
  findSkillReferences,
  PLUGIN_ROOT_EXEMPTIONS,
  findPluginRootMisuse,
  hasTriggerClause,
  lintCatalog,
  lintSkill,
  parseAllowedTools,
};
