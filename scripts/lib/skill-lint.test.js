"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  DESCRIPTION_WARN_CHARS,
  REFERENCE_EXEMPTIONS,
  SKILL_LINES_WARN,
  findSkillReferences,
  findPluginRootMisuse,
  PLUGIN_ROOT_EXEMPTIONS,
  hasTriggerClause,
  lintCatalog,
  lintSkill,
  parseAllowedTools,
} = require("./skill-lint.js");

const ROOT = path.resolve(__dirname, "..", "..");
const SKILLS_DIR = path.join(ROOT, "plugins", "keystone", "skills");

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
  const withExtra = source.replace("---\n\n# Body", "model: opus\n---\n\n# Body");
  const result = lintSkill("zoom-out", withExtra);
  assert.match(result.errors.join("\n"), /model/);
});

test("disable-model-invocation: true is allowed (user-only skills)", () => {
  const source = good().replace("---\n\n# Body", "disable-model-invocation: true\n---\n\n# Body");
  assert.deepStrictEqual(lintSkill("zoom-out", source).errors, []);
});

test("disable-model-invocation with any value but true is an error", () => {
  const source = good().replace("---\n\n# Body", "disable-model-invocation: false\n---\n\n# Body");
  assert.match(lintSkill("zoom-out", source).errors.join("\n"), /disable-model-invocation/);
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
  // The closed frontmatter key list is what makes that airtight.
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
  const result = lintCatalog({ skillsDir: SKILLS_DIR });
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

// ---------- plugin-root references ----------

// Only the literal braced `${CLAUDE_PLUGIN_ROOT}` is known to be substituted by the
// harness. The unbraced form reaches the shell as a (usually empty) env var, and the
// `${CLAUDE_PLUGIN_ROOT:-...}` default form is unverified. The supported two-harness
// pattern is the two-step `R="${CLAUDE_PLUGIN_ROOT}"; [ -f ... ] || R="${PLUGIN_ROOT}"`.
const UNBRACED = "$" + "CLAUDE_PLUGIN_ROOT";
const BRACED = "${" + "CLAUDE_PLUGIN_ROOT}";
const DEFAULTED = "${" + "CLAUDE_PLUGIN_ROOT:-$PLUGIN_ROOT}";

test("unbraced plugin root is found, even inside fenced code, with its line", () => {
  const src = `# T\n\n\`\`\`bash\nnode "${UNBRACED}/hooks/x.js"\n\`\`\`\n`;
  assert.deepStrictEqual(findPluginRootMisuse(src), [{ line: 4, form: "unbraced" }]);
});

test("the ${CLAUDE_PLUGIN_ROOT:-...} default form is flagged", () =>
  assert.deepStrictEqual(findPluginRootMisuse(`seed from \`${DEFAULTED}/templates/a.md\``), [
    { line: 1, form: "default" },
  ]));

test("the literal braced form and the two-step fallback pattern are clean", () => {
  assert.deepStrictEqual(findPluginRootMisuse(`node "${BRACED}/hooks/x.js"`), []);
  const twoStep =
    `R="${BRACED}"; [ -f "$R/hooks/x.js" ] || R="\${PLUGIN_ROOT}"; node "$R/hooks/x.js"`;
  assert.deepStrictEqual(findPluginRootMisuse(twoStep), []);
});

test("a longer variable name sharing the prefix is not flagged", () =>
  assert.deepStrictEqual(findPluginRootMisuse(`${UNBRACED}_EXTRA`), []));

test("lintCatalog fails on plugin-root misuse in any shipped .md, not only skills/commands", () => {
  const root = catalogFixture({
    "skills/zoom-out/SKILL.md": good(),
    "agents/helper.md": `run node "${UNBRACED}/hooks/x.js"\n`,
    "templates/t.md": `see ${DEFAULTED}/a.md\n`,
  });
  const text = lintCatalog({ skillsDir: path.join(root, "skills") }).errors.join("\n");
  assert.match(text, /agents\/helper\.md:1: unbraced/);
  assert.match(text, /templates\/t\.md:1: .*:-/);
});

test("an exempted file is not reported for its exempted form, but is for others", () => {
  const file = "skills/legacy/SKILL.md";
  const pluginRootExemptions = [{ file, form: "default", reason: "fixture exemption for the test" }];
  const root = catalogFixture({
    "skills/zoom-out/SKILL.md": good(),
    [file]: `${DEFAULTED}/a.md\nnode "${UNBRACED}/x.js"\n`,
  });
  const errors = lintCatalog({ skillsDir: path.join(root, "skills"), pluginRootExemptions })
    .errors.filter((e) => e.startsWith(file));
  assert.strictEqual(errors.length, 1, errors.join("\n"));
  assert.match(errors[0], /unbraced/);
});

test("every plugin-root exemption names a file and form and carries a written reason", () => {
  // The list may be empty; any entry added later must still be fully specified.
  assert.ok(Array.isArray(PLUGIN_ROOT_EXEMPTIONS));
  for (const entry of PLUGIN_ROOT_EXEMPTIONS) {
    assert.ok(typeof entry.file === "string" && entry.file.endsWith(".md"), JSON.stringify(entry));
    assert.ok(["unbraced", "default"].includes(entry.form), JSON.stringify(entry));
    assert.ok(typeof entry.reason === "string" && entry.reason.length > 20, JSON.stringify(entry));
  }
});

// ---------- user-only parity across harnesses ----------

const USER_ONLY = frontmatter({
  name: "zoom-out",
  description: "Step back. Use when the user runs /zoom-out.",
  "disable-model-invocation": "true",
});
const CODEX_POLICY = "interface:\n  display_name: \"Zoom Out\"\npolicy:\n  allow_implicit_invocation: false\n";

test("a user-only skill with a matching Codex policy passes", () => {
  const root = catalogFixture({
    "skills/zoom-out/SKILL.md": USER_ONLY,
    "skills/zoom-out/agents/openai.yaml": CODEX_POLICY,
  });
  assert.deepStrictEqual(lintCatalog({ skillsDir: path.join(root, "skills") }).errors, []);
});

test("a user-only skill without agents/openai.yaml is an error", () => {
  const root = catalogFixture({ "skills/zoom-out/SKILL.md": USER_ONLY });
  const text = lintCatalog({ skillsDir: path.join(root, "skills") }).errors.join("\n");
  assert.match(text, /zoom-out/);
  assert.match(text, /allow_implicit_invocation/);
});

test("a Codex no-implicit policy on a model-invocable skill is an error", () => {
  const root = catalogFixture({
    "skills/zoom-out/SKILL.md": good(),
    "skills/zoom-out/agents/openai.yaml": CODEX_POLICY,
  });
  const text = lintCatalog({ skillsDir: path.join(root, "skills") }).errors.join("\n");
  assert.match(text, /disable-model-invocation/);
});

test("an openai.yaml with only an interface block is fine on a model-invocable skill", () => {
  const root = catalogFixture({
    "skills/zoom-out/SKILL.md": good(),
    "skills/zoom-out/agents/openai.yaml": "interface:\n  display_name: \"Zoom Out\"\n",
  });
  assert.deepStrictEqual(lintCatalog({ skillsDir: path.join(root, "skills") }).errors, []);
});

// ---------- the real catalog ----------

test("the real keystone catalog passes every rule", () => {
  const result = lintCatalog({ skillsDir: SKILLS_DIR });
  assert.deepStrictEqual(result.errors, []);
  // Sanity floor (the lint found the real tree, not an empty dir), not a catalog census.
  assert.ok(result.skills.length >= 15, `only ${result.skills.length} skills found`);
});

test("a SKILL.md over the line budget warns but does not error", () => {
  const long = good() + "\nline".repeat(SKILL_LINES_WARN);
  const result = lintSkill("zoom-out", long);
  assert.deepStrictEqual(result.errors, []);
  assert.match(result.warnings.join("\n"), /line budget/);
});

test("a SKILL.md within the line budget does not warn", () => {
  assert.deepStrictEqual(lintSkill("zoom-out", good()).warnings, []);
});

// ---------- allowed-tools on model-invocable skills ----------

const withTools = (tools, extra = {}) =>
  frontmatter({
    name: "zoom-out",
    description: "Step back. Use when the user says are we off track.",
    ...extra,
    "allowed-tools": tools,
  });

for (const tools of [
  "Bash",
  "Write",
  "Edit",
  "MultiEdit",
  "NotebookEdit",
  "Read, Bash",
  "Bash(*)",
  "Bash(rm *)",
  "Bash(git status; rm -rf x)",
  "Bash(git log * | sh)",
  "Bash(git branch *)",
  "Edit(src/**)",
  "mcp__claude-in-chrome__navigate",
  "WebFetch",
  "\n  - Read\n  - Write",
])
  test(`model-invocable skill may not pre-approve ${JSON.stringify(tools)}`, () => {
    const result = lintSkill("zoom-out", withTools(tools));
    assert.match(result.errors.join("\n"), /allowed-tools/, JSON.stringify(result.errors));
  });

for (const tools of [
  "Read",
  "Read, Grep, Glob",
  "Read Grep Glob",
  "\n  - Read\n  - Glob",
  "Bash(git status *)",
  "Bash(git log:*)",
  "Read Bash(git log *) Bash(git diff *) Bash(ls *)",
])
  test(`model-invocable skill may pre-approve ${JSON.stringify(tools)}`, () => {
    assert.deepStrictEqual(lintSkill("zoom-out", withTools(tools)).errors, []);
  });

test("a user-only skill may keep broad allowed-tools grants", () => {
  const result = lintSkill(
    "zoom-out",
    withTools("\n  - Bash\n  - Write\n  - Edit\n  - mcp__claude-in-chrome__navigate", {
      "disable-model-invocation": "true",
    }),
  );
  assert.deepStrictEqual(result.errors, []);
});

test("parseAllowedTools keeps scoped Bash patterns with spaces as one tool", () => {
  assert.deepStrictEqual(parseAllowedTools("- Read - Bash(git log *) - Glob"), [
    "Read",
    "Bash(git log *)",
    "Glob",
  ]);
  assert.deepStrictEqual(parseAllowedTools("Read, Bash(git status *), Grep"), [
    "Read",
    "Bash(git status *)",
    "Grep",
  ]);
});
