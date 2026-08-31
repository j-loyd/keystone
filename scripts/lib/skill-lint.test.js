"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  DESCRIPTION_WARN_CHARS,
  REFERENCE_EXEMPTIONS,
  findSkillReferences,
  hasTriggerClause,
  lintCatalog,
  lintSkill,
} = require("./skill-lint.js");

const ROOT = path.resolve(__dirname, "..", "..");
const SKILLS_DIR = path.join(ROOT, "plugins", "keystone", "skills");
const COMMANDS_DIR = path.join(ROOT, "plugins", "keystone", "commands");

const frontmatter = (fields) =>
  `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n# Body\n`;

const good = (over = {}) =>
  frontmatter({
    name: "zoom-out",
    description: "Step back from tunnel vision. Use when the user says are we off track.",
    ...over,
  });

// ---------- trigger clauses ----------

const TRIGGERS = [
  "Use when the user says fix this.",
  "Use whenever an agent loop is being written.",
  "Use before opening a PR.",
  "Use after finishing a chunk of work.",
  "Use during a rebase that has stopped mid-stack.",
  "Use at the start of net-new or ambiguous work.",
  "Use immediately after any bug fix or security finding.",
  "Load it when a plan file already exists.",
  "Trigger on continuous loops and scheduled agents.",
  // "Use to X ... before Y" — purpose-led, but still binds use to a situation.
  "Use to stress-test a finished doc before building from it.",
];

for (const description of TRIGGERS) {
  test(`trigger clause accepted: ${description}`, () => {
    assert.strictEqual(hasTriggerClause(description).ok, true, description);
  });
}

const NON_TRIGGERS = [
  // No usage verb at all.
  "A cross-cutting coding baseline covering naming, DRY, and error handling.",
  // Usage verb, but purpose only — never says *when*.
  "Use this to format numbers consistently.",
  "Use for React components.",
  // Negated forms describe exclusions, not triggers.
  "Do not use when editing YAML.",
  "Never use when the tests are red.",
  "Don't use when the repo has no git history.",
];

for (const description of NON_TRIGGERS) {
  test(`trigger clause rejected: ${description}`, () => {
    assert.strictEqual(hasTriggerClause(description).ok, false, description);
  });
}

test("a negated exclusion does not cancel a real trigger elsewhere", () => {
  const d = "Use when a test fails. Do not use when the build is broken.";
  assert.strictEqual(hasTriggerClause(d).ok, true);
});

test("a trigger clause reports the evidence it matched", () => {
  // Evidence names the usage verb and the situation word, which can be far apart.
  const evidence = hasTriggerClause("Use when a test fails.").evidence;
  assert.match(evidence, /\bUse\b/i);
  assert.match(evidence, /\bwhen\b/i);
});

// ---------- frontmatter rules ----------

test("a well-formed skill passes with no errors", () => {
  assert.deepStrictEqual(lintSkill("zoom-out", good()).errors, []);
});

test("missing frontmatter is an error", () => {
  const result = lintSkill("zoom-out", "# No frontmatter here\n");
  assert.match(result.errors.join("\n"), /frontmatter/i);
});

test("a third frontmatter key is an error", () => {
  const source = good();
  const withExtra = source.replace("---\n\n# Body", "allowed-tools: Bash\n---\n\n# Body");
  const result = lintSkill("zoom-out", withExtra);
  assert.match(result.errors.join("\n"), /allowed-tools/);
});

test("a missing description is an error", () => {
  const result = lintSkill("zoom-out", frontmatter({ name: "zoom-out" }));
  assert.match(result.errors.join("\n"), /description/);
});

test("a name that does not match the directory is an error naming both", () => {
  const result = lintSkill("zoom-out", good({ name: "zoomout" }));
  const text = result.errors.join("\n");
  assert.match(text, /zoomout/);
  assert.match(text, /zoom-out/);
});

test("a non-kebab-case name is an error", () => {
  assert.match(lintSkill("Zoom_Out", good({ name: "Zoom_Out" })).errors.join("\n"), /kebab/i);
});

test("a non-kebab-case directory is an error even when name matches it", () => {
  assert.match(lintSkill("zoomOut", good({ name: "zoomOut" })).errors.join("\n"), /kebab/i);
});

test("a description with no trigger clause is an error", () => {
  const result = lintSkill("zoom-out", good({ description: "A tool for looking at code." }));
  assert.match(result.errors.join("\n"), /trigger|when/i);
});

// ---------- self-exemption is structurally impossible ----------

test("a skill cannot exempt itself through frontmatter", () => {
  // Exemptions live in this validator, never in the artifact being validated.
  // The name+description-only rule is what makes that airtight.
  const source = good().replace(
    "---\n\n# Body",
    "exempt-references: deep-research\nvalidator-skip: true\n---\n\n# Body",
  );
  const result = lintSkill("zoom-out", source);
  assert.match(result.errors.join("\n"), /exempt-references/);
  assert.match(result.errors.join("\n"), /validator-skip/);
});

test("every exemption carries a written reason", () => {
  assert.ok(REFERENCE_EXEMPTIONS.length > 0);
  for (const entry of REFERENCE_EXEMPTIONS) {
    assert.ok(entry.name, "exemption needs a name");
    assert.ok(
      typeof entry.reason === "string" && entry.reason.trim().length > 20,
      `exemption "${entry.name}" needs a written reason`,
    );
  }
});

// ---------- description length warning ----------

test("an over-long description warns rather than errors", () => {
  const long = `Use when the user asks. ${"x".repeat(DESCRIPTION_WARN_CHARS)}`;
  const result = lintSkill("zoom-out", good({ description: long }));
  assert.deepStrictEqual(result.errors, []);
  assert.match(result.warnings.join("\n"), /description/i);
});

test("the length threshold sits above every description in the catalog today", () => {
  // Chosen from the real distribution, not invented: it is a ratchet on the
  // observed ceiling, so it warns on growth rather than on the status quo.
  const result = lintCatalog({ skillsDir: SKILLS_DIR, commandsDir: COMMANDS_DIR });
  const longest = Math.max(...result.skills.map((s) => s.descriptionLength));
  assert.ok(
    DESCRIPTION_WARN_CHARS > longest,
    `threshold ${DESCRIPTION_WARN_CHARS} is below the current longest description (${longest})`,
  );
});

// ---------- cross-skill reference detection ----------

const REF_PHRASINGS = [
  ["the `foo-bar` skill", "foo-bar"],
  ["`foo-bar` skill", "foo-bar"],
  ["see `foo-bar`", "foo-bar"],
  ["→ `foo-bar`", "foo-bar"],
  ["load the `foo-bar` skill", "foo-bar"],
  ["invoke `foo-bar`", "foo-bar"],
  ["see `/foo-bar`", "foo-bar"],
];

for (const [text, expected] of REF_PHRASINGS) {
  test(`reference phrasing detected: ${text}`, () => {
    assert.deepStrictEqual(findSkillReferences(text).map((r) => r.name), [expected]);
  });
}

const NON_REFERENCES = [
  // Ordinary backticked tokens are everywhere; a broad sweep is useless.
  "install `express-rate-limit` from npm",
  "the value `measured-now` is a sentinel",
  "`invoiceDate` should be named for intent",
  // Filenames are not skill names.
  "see `DEEPENING.md`",
  "see `./parallel-waves.md`",
  "see `docs/plans/<plan>.run-state.md`",
];

for (const text of NON_REFERENCES) {
  test(`not treated as a skill reference: ${text}`, () => {
    assert.deepStrictEqual(findSkillReferences(text), []);
  });
}

test("references inside fenced code are ignored", () => {
  assert.deepStrictEqual(findSkillReferences("```\nsee `ghost-skill`\n```\n"), []);
});

test("a reference reports its line number", () => {
  assert.strictEqual(findSkillReferences("a\nb\nthe `foo-bar` skill\n")[0].line, 3);
});

// ---------- catalog-level linting ----------

function catalogFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-cat-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return root;
}

test("a live cross-skill reference passes", () => {
  const root = catalogFixture({
    "skills/zoom-out/SKILL.md": good(),
    "skills/other-skill/SKILL.md": frontmatter({
      name: "other-skill",
      description: "Does a thing. Use when a thing needs doing.",
    }) + "\nsee the `zoom-out` skill\n",
  });
  const result = lintCatalog({ skillsDir: path.join(root, "skills") });
  assert.deepStrictEqual(result.errors, []);
});

test("a reference to a command counts as live", () => {
  const root = catalogFixture({
    "skills/zoom-out/SKILL.md": good() + "\nsee the `review` skill\n",
    "commands/review.md": "---\nname: review\n---\n",
  });
  const result = lintCatalog({
    skillsDir: path.join(root, "skills"),
    commandsDir: path.join(root, "commands"),
  });
  assert.deepStrictEqual(result.errors, []);
});

test("a dead cross-skill reference is an error naming the file and the name", () => {
  const root = catalogFixture({
    "skills/zoom-out/SKILL.md": good() + "\nsee the `ghost-skill` skill\n",
  });
  const result = lintCatalog({ skillsDir: path.join(root, "skills") });
  const text = result.errors.join("\n");
  assert.match(text, /ghost-skill/);
  assert.match(text, /zoom-out\/SKILL\.md/);
});

test("an exempted name is not reported as dead", () => {
  const exempt = REFERENCE_EXEMPTIONS[0].name;
  const root = catalogFixture({
    "skills/zoom-out/SKILL.md": good() + `\nsee the \`${exempt}\` skill\n`,
  });
  assert.deepStrictEqual(lintCatalog({ skillsDir: path.join(root, "skills") }).errors, []);
});

test("a directory with no SKILL.md is an error, not a silent skip", () => {
  const root = catalogFixture({
    "skills/zoom-out/SKILL.md": good(),
    "skills/empty-skill/reference.md": "orphan\n",
  });
  const result = lintCatalog({ skillsDir: path.join(root, "skills") });
  assert.match(result.errors.join("\n"), /empty-skill/);
});

// ---------- the real catalog ----------

test("the real keystone catalog passes every rule", () => {
  const result = lintCatalog({ skillsDir: SKILLS_DIR, commandsDir: COMMANDS_DIR });
  assert.deepStrictEqual(result.errors, []);
  assert.ok(result.skills.length >= 30, `only ${result.skills.length} skills found`);
});
