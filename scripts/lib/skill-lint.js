"use strict";
/**
 * skill-lint.js — keystone's own frontmatter and cross-reference rules.
 *
 * These are HOUSE rules, not a vendored upstream lint. keystone skills carry
 * `name` and `description` and nothing else, and there is no required-section
 * list: the body shape is the author's call.
 *
 * Integrity property, taken from upstream deliberately: exemptions live HERE, in
 * the validator, never in the artifact being validated. A skill cannot exempt
 * itself — and the name+description-only rule is what makes that airtight, since
 * any `validator-skip:`-style key is itself an error. Every exemption carries a
 * written reason.
 *
 * Node stdlib only.
 */

const fs = require("node:fs");
const path = require("node:path");

const { parseFrontmatter, stripFencedCode, lineOf, walkMarkdown } = require("./markdown.js");

/** The only two frontmatter keys a keystone skill may carry. */
const ALLOWED_KEYS = ["name", "description"];

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
      "separate plugin'), and coding-standards routes React/UI work to it by name.",
  },
  {
    name: "clear",
    reason:
      "Claude Code's built-in /clear command, not a keystone command. " +
      "commands/handoff.md documents the /handoff -> /clear -> /pickup flow, which " +
      "only makes sense naming the built-in.",
  },
  {
    name: "deep-research",
    reason:
      "Harness-provided research capability, referenced in commands/research-notes.md " +
      "alongside find-docs as the thing that DOES the investigation while /research-notes " +
      "persists the conclusions. Not shipped by keystone. Flagged for a human: unlike " +
      "impeccable it is documented nowhere in this repo, so it is the weakest of the three.",
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
        "keystone skills declare name and description only",
    );
  }
  for (const key of ALLOWED_KEYS) {
    if (!keys.includes(key) || !values[key]) {
      errors.push(`${dir}/SKILL.md: frontmatter is missing "${key}"`);
    }
  }

  const name = values.name || null;
  const description = values.description || null;

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

  return {
    dir,
    name,
    description,
    descriptionLength: description ? description.length : 0,
    errors,
    warnings,
  };
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
function lintCatalog({ skillsDir, commandsDir = null, agentsDir = null } = {}) {
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

  return { ok: errors.length === 0, skills, known: [...known].sort(), errors, warnings };
}

module.exports = {
  ALLOWED_KEYS,
  DESCRIPTION_WARN_CHARS,
  KEBAB,
  REFERENCE_EXEMPTIONS,
  findSkillReferences,
  hasTriggerClause,
  lintCatalog,
  lintSkill,
};
