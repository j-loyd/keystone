# Changelog

All notable changes to keystone are recorded here.

## [Unreleased]

### Changed

- **Per-repo lessons no longer disappear after the newest 8.** The SessionStart `learnings.js`
  hook now injects the newest 5 live lessons in full, plus a title-only index of every other
  lesson and the lessons file path, so the agent can open any older entry that bears on the
  task. Before, repos with 30+ lessons surfaced only the newest 8 and the rest were never seen.
  `KEYSTONE_LEARNINGS_MAX` now sets the full-entry count (default 5, was 8). The index is capped
  at 150 titles of 200 characters each.
- **Per-repo lessons now live in the repo, uncommitted.** `/wrap` saves to
  `.keystone/lessons.md` in the repo's main checkout, and adds `/.keystone/` to the repo's
  private `.git/info/exclude` (never its shared `.gitignore`), so the file is never committed.
  Every worktree reads and writes that one file. Existing lessons in
  `~/.claude/keystone/learnings/<slug>.md` are still read until the first new save, which copies
  them into the repo file (the old file is kept). The hook ignores a `.keystone/` that git tracks
  or that is a symlink, so a cloned repo can't plant "lessons" into your sessions. A `git clean`
  with `-x` deletes ignored files, including this one. Set `KEYSTONE_LEARNINGS_DIR` to keep the
  old out-of-repo layout.
- **Superseded lessons.** A lesson whose heading carries `SUPERSEDED` never takes a full slot;
  it stays in the index by title. `/wrap` now proposes superseding (instead of deleting) a lesson
  that was replaced but still partly holds.
### Security: the guard now covers Codex `apply_patch`

Codex CLI runs keystone's PreToolUse guard for its `apply_patch` tool, because Codex treats
`Write`/`Edit` as matcher aliases. But the hook payload carries `tool_name: "apply_patch"`,
with the whole patch as a string in `tool_input.command`, and `guard.js` let any tool name it
didn't know through. So on Codex a patch could write outside an active `/guard freeze`, write
secret files (`.env`, keys) and edit the guard state file, all of which a `Write`/`Edit` to the
same path is blocked from doing.

- **Fixed (`guard.js`)**: every path in a patch (Add, Update, Delete, and both the source and
  the destination of a `*** Move to:` rename) now gets the same secret-file, guard-state-file
  and freeze checks a `Write`/`Edit` gets. Relative paths resolve against the hook's `cwd`. The
  path Codex normalizes (`.env/.` writes `.env`) is checked as well as the raw one.
- **Fixed (Codex only)**: Codex can also apply a patch from its shell tool, and that call
  reaches the hook as `Bash`: the heredoc form Codex intercepts (`apply_patch <<'EOF' …`, or
  `cd <dir> && apply_patch <<'EOF' …`), or the real `apply_patch` binary Codex puts on `PATH`.
  On Codex, the file headers in a Bash command that names `apply_patch` now get the same
  checks. A patch fed from a file, a variable or stdin is still invisible to the hook, the same
  gap as any other Bash write (freeze has never fenced Bash). Claude Code has no such shell
  command, so its Bash decisions are unchanged.
- **Codex can't ask, so these deny there**: Codex 0.166 treats `permissionDecision: "ask"` as
  unsupported and runs the call. guard.js recognizes a Codex payload by the `turn_id` and
  `model` fields Codex always sends, which Claude Code's PreToolUse input does not carry.
  An `apply_patch` call counts as Codex on its own (only Codex has that tool), so patch asks
  deny even if a future Codex payload drops those fields.
  On Codex these asks become a **deny**:
  - every ask from a patch check: input guard can't parse, a patch with no files, a corrupt
    state file, the guard state file itself, and a relative path under a freeze when the
    patch names a different `*** Environment ID:`;
  - the guard-integrity asks on Bash: a command that touches the guard state file, and a
    `guard-state.js` call that could lift or widen the guardrails. (Codex has no Write/Edit
    tools; its file edits arrive as `apply_patch`, so a patch to the state file is covered
    by the patch checks above.)

  Careful-mode and SQL-guard asks stay asks, which Codex ignores. On Claude Code every ask is
  unchanged. Set `KEYSTONE_GUARD_OFF=1` to bypass, as before. This also means that on Codex
  `/guard off`, `/guard careful off` and moving an active freeze are denied rather than
  confirmed. Lift or widen the guard from your own terminal, outside Codex, by running the
  plugin's `hooks/guard-state.js` yourself.
- **Not changed: Codex patches are not formatted.** The PostToolUse formatter still reads a
  Claude Code-shaped payload, so on Codex it formats nothing, as before. That is deliberate.
  Formatting a patch would run the repo's `node_modules/.bin/prettier`, which loads prettier
  config the same patch can add (`prettier.config.cjs` is code), and the formatter runs
  outside Codex's sandbox.
- New shared parser `hooks/patch-paths.js` reads the header grammar exactly as Codex's
  `apply-patch` parser does, including its whitespace rules, which differ from JavaScript's
  `trim()`. Parsing a patch takes linear time.
- **Fixed: padding could time the guard out.** Codex treats a hook timeout as a failed hook
  and runs the call. 33 Bash rules and 2 secret-file patterns used regexes that backtracked
  quadratically or cubically on long input; a ~12 KB command made `guard.js` exceed its 5 s
  timeout, which let padding push any Bash deny through on Codex (for example
  `guard-state.js off`). Every one of those rules is now a linear-time matcher that makes
  the same decision as the old regex (checked against the original regexes by fuzzing). A
  200 KB command now takes well under a second.

### Removed: the Databricks guard layer

The opt-in Databricks confirm layer (`KEYSTONE_DATABRICKS_GUARD=1`) is gone, keeping keystone
stack-agnostic. The SQL guard is unchanged. If you want those confirmations back, add a
PreToolUse hook of your own to your personal settings.

### Known gaps

- If `guard.js` can't be found (a plugin updated mid-session), the guard hook falls back to an
  `ask`. Codex ignores that `ask`, so on Codex the fallback runs the call unguarded.
- Checking a command still takes time proportional to its length, about 0.3 s per MB. A
  single Bash command of roughly 15 MB or more would exceed the hook's 5 s timeout, and Codex
  would then run it unchecked. That is far beyond what a model emits in one tool call, but
  nothing enforces it.
- The Claude Code formatter runs the repo's own prettier (`node_modules/.bin/prettier`), which
  can execute repo-supplied config. This predates this release and is out of scope here.

### Upgrade steps

- **Claude Code**: update the plugin (`claude plugin update keystone@keystone`), then restart
  open sessions.
- **Codex CLI**: Codex fingerprints the whole plugin bundle when it trusts a plugin hook, so
  any changed file marks **every** keystone hook as modified, even though `hooks.json` itself
  is unchanged. Codex **silently skips** modified hooks, guard included, until you approve them
  again. Update with `codex plugin marketplace upgrade keystone`, then start `codex`
  interactively. At the "Hooks need review" prompt, pick **Trust all and continue** (or
  **Review hooks**), or run `/hooks` later. "Continue without trusting" leaves the hooks off,
  and `codex exec` has no review prompt, so until you approve them it runs with no keystone
  guard.

## [1.0.0] — 2026-11-07

keystone lean. Claude Code now ships much of what this kit used to carry: built-in `/review`,
`/simplify`, and `/security-review`, native worktree isolation, and `/goal` and `/loop`. Every
model-invocable skill or command also costs always-loaded context for its description, whether
or not it ever fires. In a local 36-run A/B across three model tiers (synthetic tasks; results not shipped), the test-driven-development and systematic-debugging
skills scored about the same as the no-skill baseline. So 1.0 keeps what is uniquely keystone,
hands the rest to the harness, and makes the heavy workflows user-only, so they cost nothing
until you type them.

**Breaking.** Many commands and skills are gone or renamed (see the table below). There is no
`commands/` directory any more: every workflow is a skill.

| Measured on the shipped plugin | 0.9.0 | 1.0.0 |
| --- | --- | --- |
| Model-invocable descriptions (always loaded) | 56 (30 skills + 26 commands) | 20 skills |
| Characters in those descriptions | 15,365 | 6,396 |
| Lines of shipped `.md` under `plugins/keystone/` | 12,447 (100 files) | 5,660 (53 files) |

### What changed

| Change | 0.9 | 1.0 |
| --- | --- | --- |
| Moved to built-in | `/review`, `/simplify` (and the `simplifying-code` skill) | Claude Code's built-in `/review` and `/simplify`. keystone's own reviewer is the `code-reviewer` agent, which `/ship` and `/implement` dispatch. |
| Replaced | `brainstorming`, `writing-plans`, `subagent-driven-development`, `/office-hours`, the old `/spec` command, `/to-prd`, `/to-issues`, `/pause` | One pipeline, adapted from Matt Pocock's skills: **`/spec`** (idea → spec) → **`/to-tickets`** → **`/implement`**, plus **`/setup`** once per repo |
| Replaced | `/learn`, `/retro` | **`/wrap`** |
| Replaced | `/freeze`, `/careful`, `/unfreeze`, `/guard` | **`/guard on\|freeze\|careful\|off\|status`** (`/unfreeze` is now `/guard off`) |
| Removed | `test-driven-development`, `systematic-debugging` | The keystone-only rules moved into the `implementer` agent (failing test first) and **`/investigate`** (state what you expect to see before each check; question the architecture after three failed fixes) |
| Renamed | `adversarial-review` skill + `/challenge` command | **`challenge`** (`/challenge`) |
| Renamed | `auditing-for-overengineering` skill + `/audit` command | **`audit`** (`/audit`) |
| Renamed | `CONTEXT.md` / `CONTEXT-MAP.md` glossary | **`GLOSSARY.md`** / **`GLOSSARY-MAP.md`** |
| Removed | `/context-budget` | — |
| Removed | `planner` and `qa` agents | The crew is now `implementer`, `code-reviewer`, and `security-reviewer`. |
| Removed | `coding-standards`, `performance-optimization`, `observability`, `deprecation-and-migration`, `zoom-out`, `git-workflow`, `dispatching-parallel-agents`, `/plan-ceo-review`, `/plan-eng-review`, `/research-notes` | Generic advice current models already follow. The few keystone-specific rules moved to the `implementer` agent, `/ship`, `/debt`, and `challenge`. |
| Moved out of the plugin | `writing-skills` | The repo's own `.claude/skills/` (it is for maintaining keystone, not for using it) |
| Now user-only | `/ship`, `/qa`, `/cso`, `/investigate`, `/debt`, `/handoff`, `/guard`, `onboard-codebase` | Same workflows. Only you can start them, on Claude Code and Codex alike. |

### Added

- **`/spec`**, the one entry point for a feature: a grilling interview when the idea is fuzzy,
  a spec with an **"Integrate and be creative where possible; build where necessary"** section
  (per capability: the package or service to integrate, how existing pieces combine, or why it
  has to be built), security questions, and an **over-engineering gut check** before tickets.
- **`/to-tickets`** (tracer-bullet tickets with blocking edges, local `.scratch/<feature>/issues/`
  files by default) and **`/implement`** (an integration branch, one implementer per unblocked
  ticket, one final review; never pushes or merges to main unasked). **`/setup`** picks the
  tracker (local, GitHub, GitLab, or Linear) and the domain docs.
- **`grilling`**, **`domain-modeling`**, and **`codebase-design`**, copied from Matt Pocock's
  skills (MIT). `grill-with-docs` and `improve-codebase-architecture` now build on them.
- **`/wrap`**: at the end of a session it asks one question, lists candidates, and saves only
  what you pick (repo lessons, decisions, corrections, drops, open items).
- **Optional Cloudflare `security-audit` companion** in keystone's marketplace, pinned to a fixed
  commit and never installed with keystone: `/plugin install security-audit@keystone`. `/cso`
  offers to hand off to it when it is installed.

### Security
- The guard's "can this reach the state file" check also fails closed on command substitution (`` `…` ``, `$(…)`, `<(…)`, `>(…)`), any flagged `env`/`sudo` wrapper (they can change directory), `xargs -a`, and every rsync delete flag (`--del`, `--remove-sent-files`). It remains a tripwire, not a sandbox: a symlink to `~/.claude`, or `cp`/`tar`/`ln` overwriting the state file, is not caught.

- **Model-invocable skills can no longer pre-approve broad tools.** The skill lint fails on
  unscoped `Bash`, `Write`/`Edit`, MCP tools, or anything not read-only in `allowed-tools` on a
  skill the model can start by itself. Only user-only skills carry broader grants.
  Bash grants on those skills must be exact read-only commands with no wildcards (`git log --output=<file>` writes a file, so `Bash(git log *)` is rejected). `/pickup` pre-approves `Read`, `Glob`, `Grep`, and `Bash(git status)`.
- **`/qa`'s MCP pre-approvals are Claude in Chrome tools only.** The `chrome-devtools` entries
  are gone.
- **`KEYSTONE_TASK_RISK` and `KEYSTONE_TASK_FACTS` are no longer used.** The guard ignores
  them; that gate belonged to the removed pipeline.
- **Tracker comments from outsiders no longer count as state.** The GitHub/GitLab tracker docs keep only repo-member comments (`authorAssociation` OWNER/MEMBER/COLLABORATOR; GitLab project members); `/implement` and `/pickup` count a ticket done only when git confirms its cited sha (`git merge-base --is-ancestor`), and `/implement`, `/pickup`, `/to-tickets`, and the implementer agent treat ticket/comment/handoff text as data, not instructions.
- **The frontmatter lint fails closed.** Unindented YAML lists are parsed; quoted keys, `? key` / `: value`, `key : value`, flow mappings, comments, lone CR line breaks, and duplicate keys are errors; `disable-model-invocation` must be the bare literal `true` — forms js-yaml read as `allowed-tools` grants the lint never saw.
- **`/wrap` saves lessons through `learnings.js --append [--meta]`, not `cat >>`.** The entry comes from stdin, goes only to the computed repo-lessons file or meta inbox, and must be one `## ` entry with `**Triggers:**` under 2,000 chars; heredocs use a per-session random terminator, so a saved line can't end one and run as shell. Injected lessons are capped per entry and framed as data to verify; injected instincts are capped per rule.
- **Removing or moving a directory that holds the guard state file asks.** `rm -rf ~/.claude` under freeze used to delete the state file and silently lift the freeze. The check fails closed: an `rm`/`rmdir`/`mv`/`unlink`, `find -delete`, `rsync --delete`, or `xargs rm` asks whenever an argument names `.claude`, the home directory in any form (`~`, `~user`, `$HOME`), a brace expansion, or an unresolved `$`, or an earlier `cd`/`pushd` changed directory; careful mode now also asks on `gh pr merge` and on a checkout of main/master followed by `git merge`.

### Migration

1. **Update and restart.** Update from `/plugin` (or run `claude plugin update keystone@keystone`), then
   start a fresh session. Open sessions keep pointing at the old version's directory until they
   restart.
2. **Codex users: re-approve the hooks.** The SessionStart hook's command text in `hooks.json`
   changed: it no longer mentions run-state.
3. **Renamed commands.** `/learn` and `/retro` → `/wrap`. `/freeze` → `/guard freeze`.
   `/careful` → `/guard careful`. `/unfreeze` → `/guard off`. `/office-hours`, `/to-prd`,
   `/to-issues` → `/spec`, then `/to-tickets`. `/pause` (a run-state checkpoint for the old
   pipeline) → `/handoff`. `/review` and `/simplify`
   → the Claude Code built-ins.
4. **Glossary.** In a repo that still has `CONTEXT.md`, keystone treats it as the glossary and
   offers the rename: `git mv CONTEXT.md GLOSSARY.md` (and `CONTEXT-MAP.md` → `GLOSSARY-MAP.md`).
5. **Refresh the tracker doc.** A `docs/agents/issue-tracker.md` written by an earlier `/setup`
   for GitHub or GitLab reads every comment unfiltered: re-run `/setup`, or replace its **Read an
   issue** / **List issues** lines with the new ones (they keep only repo members' comments).
6. **Uninstall the duplicates.** If you have `mattpocock-skills` or `superpowers` installed,
   uninstall them, since keystone carries the parts it uses and both copies would load. Anthropic's
   `security-guidance` plugin is not a duplicate: it adds edit-time warnings and a review when the
   session stops, alongside keystone's on-demand security skills. Keep it if you want both.
6. **Plans and run-state.** keystone no longer reads `docs/plans/` or run-state files. Work in
   flight under the old pipeline is plain markdown: hand it to `/to-tickets`, or finish it by hand.

## [0.9.1] — 2026-11-07

A security patch for the guard hook. Upgrade recommended; no breaking changes. `hooks.json` is
unchanged, so harnesses that trust hooks per command (Codex) need no re-approval.

### Security
- The guard hook now **fails closed** on an unexpected internal error (it asks instead of silently allowing).

- **Closed an allowlist bypass in `guard.js` (high).** The template allowlist (`.env.example`,
  `.env.sample`, …) was tested against the _whole_ Bash command and returned allow before any
  deny layer ran. Appending an allowlisted name anywhere, such as a trailing `# .env.example`
  comment, let a catastrophic `rm` or a `.env` read through. The allowlist is now applied per
  shell word: each word that is itself an allowlisted template path is swapped for a neutral
  placeholder, and every deny/ask layer runs on what remains. A word is never swapped if it
  carries shell expansion, escape, or glob characters (`.env$IFS.env.example` still reads `.env`)
  or a `:` (a remote destination like `host:x.env.example` must stay visible to the scp/rsync
  exfil rules). A template read inside a pipeline (`cat .env.example | head`), which the old
  check denied, is now correctly allowed. Read/Edit/Write path checks are unchanged.
- **Guard toggles are user-only, and removing protection asks first (high).** `/careful`,
  `/freeze`, `/unfreeze`, and `/guard` now carry `disable-model-invocation: true`, so only a
  user can invoke them; you can still type them. `guard.js` returns **ask** for any Bash, Write,
  or Edit that touches the guard state file directly, including names split with quotes or
  backslashes that bash rejoins (`keystone-gu''ard.json`). It also asks for any `guard-state.js`
  call that could lift or widen protection: `unfreeze`, `careful off`, re-freezing while a
  boundary is active, a split or escaped script name, or anything other than an exact
  protection-adding form. The hook cannot tell a
  user-typed `/unfreeze` from the model running the same command, so a human confirms. This is
  string matching, a tripwire rather than a sandbox: obfuscated access (globs, names assembled at
  runtime, interpreter one-liners) is not caught, freeze still does not fence Bash, and an
  unfrozen session can still edit the installed hook scripts themselves.
- **A corrupt guard state file now fails closed.** `readState()` returned `{}` for any read or
  parse failure, so appending one stray character to the file silently lifted an active freeze
  and careful mode. Now only a missing file means "no extra restrictions". An unreadable file,
  invalid JSON, or the wrong shape (for example a non-absolute `freeze`) turns careful mode on and
  makes every Write/Edit ask, because the real boundary can't be known, until the file is
  rewritten by `/freeze`, `/guard`, or `/unfreeze`. While the file is corrupt, `guard-state.js`
  writes ask too, and only `status` runs unprompted.
- **Malformed tool input no longer turns into an allow.** A non-string `command`, `file_path`, or
  `cwd` used to throw inside the guard, which then returned `{}` (allow). Array input is now
  joined and checked; any other type asks.
- **JSON-safe guard state writes.** The four commands built the state file with `printf`, so a
  directory containing `"` or `\` produced invalid JSON. `readState()` then failed open and the
  freeze silently stopped applying. The new `hooks/guard-state.js` CLI
  (`freeze [dir]`, `guard [dir]`, `careful on|off`, `unfreeze`, `status`) writes with
  `JSON.stringify` and an atomic rename, takes strictly fixed arguments, and keeps the shell's
  logical working directory as the freeze boundary. `careful off` is new.

### Fixed

- **Plugin root that resolves on both harnesses.** `/learn`, `/retro`, and
  `subagent-driven-development` used the unbraced `$CLAUDE_PLUGIN_ROOT`, which the harness does not
  substitute, so the shell resolved `/hooks/learnings.js`. `/handoff` used
  `${CLAUDE_PLUGIN_ROOT:-$PLUGIN_ROOT}`, a form whose substitution is unverified. The commands now
  use the same two-step fallback as `hooks.json`, which works on both Claude Code and Codex:
  `R="${CLAUDE_PLUGIN_ROOT}"; [ -f "$R/<file>" ] || R="${PLUGIN_ROOT}"`. The guard commands use it
  too. (`subagent-driven-development`, removed in 1.0, is only braced, with no Codex fallback.
  That is no regression, since the unbraced form was empty on both harnesses.)
  `validate-skills.js` fails on the unbraced form and the `:-` form in any shipped `.md`.
  The only exemptions are two skill files slated for removal, each recorded in the validator with
  its reason.

## [0.9.0] — 2026-09-29

A refresh for current frontier-model prompting, on Claude Code and Codex alike. A prompt audit
(Anthropic's `prompt-audit` guide) ran across every skill, command, agent, and hook-injected
string. Current frontier models follow instructions closely and literally, so the audit targeted
specific text written for older models rather than length. Three upstream skill sets were reviewed alongside it for ideas.

### Changed

- **Plain rules instead of pressure language.** All-caps `MUST`/`NEVER` lead-ins and
  banned-phrase lists became plain statements with their reasons (`receiving-code-review`,
  `systematic-debugging`, `test-driven-development`, the spec-reviewer and implementer prompts,
  the compaction notice, the instincts banner). The instincts banner now asks for each rule to be
  weighed by its confidence rather than calling every rule absolute.
- **Delegation follows the inline-first rule everywhere.** `plan-levels.md` and
  `dispatching-parallel-agents` no longer default to subagents for small work; current
  models already delegate readily.
- **Plans split by shippable subsystem, not task count.** The 2–3-task cap assumed one execution
  context per plan, which stopped holding once execution dispatched each slice fresh.
- **Cross-skill hand-offs are explicit:** "load the `<name>` skill", with the Claude Code form
  (the Skill tool with `keystone:<name>`) alongside, so each harness gets an instruction it can
  act on.
- **One review verdict vocabulary:** `/review`, `/ship`, and the code-reviewer agent all use
  PASS / CONCERNS / FAIL.
- **Security reviews gained a finding test and a third verdict.** A finding names the principal,
  the boundary crossed, and the result; best-practice gaps go in a separate hardening list;
  severity is anchored and capped at demonstrated impact; items that hinge on facts outside the
  source are marked _needs validation_ with the check that settles them; every report states its
  coverage. `security-review` also covers classes that sit between OWASP categories (proxy and
  cache trust, SAML/WebAuthn/account linking, data-lifecycle leaks, resource amplification,
  chained findings, privileged CI running untrusted code). `llm-security`: injection alone is not
  a finding, and a prompt guardrail is not a boundary.
- **`verification-before-completion`** now spells out what counts as a real check (not a
  syntax-only run or a command that failed to start), for models that report done too early at
  low effort.
- **`/handoff` doubles as the end-of-day wrap-up:** it triggers on "wrapping up" and checks for
  leftover debug probes, running processes, worktrees, and machine-only work.
- **`/retro`** routes mechanical lessons to a lint rule, hook, or test instead of prose; **`/learn`**
  prefers an earlier control and gives promoted instincts a retirement condition;
  **`writing-skills`** adds a labeled routing-test set with a held-out split and warns against
  single gold examples; **`designing-agent-systems`** compares changes task by task against
  pre-declared thresholds.
- `/review` drops its separate "cost-tiered depth" step; the fan-out step above it already
  carries the tier routing.
- `coding-standards` drops sections that restated defaults the model already follows;
  `context-budget` assumes current models' 1M window.

### Fixed

- **`/research-notes` referenced a template that doesn't ship with the plugin**; the structure is
  inline in the command.
- **Stale citations and paths:** `plan-levels.md` cited a moved line; template paths now use
  `${CLAUDE_PLUGIN_ROOT:-$PLUGIN_ROOT}`, which resolves on both harnesses; the unreferenced repo-root `templates/plans` copy is removed.
- **`using-git-worktrees` and `resolving-merge-conflicts` committed on their own**, contradicting
  the no-auto-commit rule. Concluding a merge the user asked for is still covered.
- **`scan.js` flagged its own pattern source.** Reading the scanner or its test fixtures is no
  longer scanned — an exact two-file list, so a checked-out working tree is still scanned. Quoting
  an attack still does not hide it; three tests pin both (266 total).
- **Mermaid in the architecture HTML report** now uses `securityLevel: "strict"`.

## [0.8.1] — 2026-09-04

Bug fixes in the safety layer, all three found by investigating why keystone's hooks were
reporting themselves INACTIVE in a live session. None is a Codex issue; all three predate 0.8.0.

### Fixed

- **`guard.js`'s degrade path now fails CLOSED.** Root cause: `${CLAUDE_PLUGIN_ROOT}` is
  inline-substituted by Claude Code **at parse time**, so the version-pinned plugin path is frozen
  into each hook command for the life of a session. A mid-session plugin update prunes that
  directory, stranding every running session — and the `${PLUGIN_ROOT}` fallback cannot rescue it,
  because that variable belongs to a different harness and is unset on Claude Code. The old
  degrade emitted only `systemMessage`, and a `PreToolUse` hook without a `permissionDecision`
  **allows** the call: the freeze boundary and destructive-command gate switched silently off while
  the message described the state as merely "inactive". The degrade now returns
  `permissionDecision: "ask"` with a reason that says the guard is inactive and why, so an
  unguarded session prompts instead of proceeding. Staleness itself is not fixable from inside a
  running session — a session cannot discover where the new version landed — so the fix corrects
  the failure mode rather than pretending the failure is avoidable.
- **The `scan.js` degrade notice is deduplicated per session.** Its `PostToolUse` matcher covers
  most tool traffic, so an un-deduped notice re-announced a session-fatal condition on nearly
  every call. It now writes a `${CLAUDE_SESSION_ID}`-keyed sentinel and reports once. Failing open
  stays correct for a detector that can only warn; the noise was the bug.
- **`/guard` and `/freeze` silently ignored their directory argument.** Both used
  `DIR="${ARGUMENTS:-$PWD}"`, but the braced form is **not** a Claude Code substitution — only bare
  `$ARGUMENTS` is — so the literal string reached bash, `ARGUMENTS` was an unset *shell* variable,
  and the fallback always won. `/guard ~/elsewhere` fenced the current directory instead, while
  `argument-hint` advertised otherwise; `freeze.md` was worse, its prose promising the argument its
  script discarded. Verified empirically (`ARGUMENTS` is absent from the hook shell environment),
  not just from documentation. Both now use bare `$ARGUMENTS` with a shell emptiness check.

### Changed

- **Two tests pin the corrected behavior** (263 total): a degrade on a permission-honoring event
  must carry `permissionDecision: "ask"` or `"deny"`, and a fail-open degrade notice on a
  repeat-firing event must be session-deduplicated. Both were confirmed to fail against the old
  configuration before the fix landed. The pre-existing graceful-degrade assertion was widened to
  accept a permission-decision degrade alongside `systemMessage` / `|| true`.

### Known tradeoff

Restoring bare `$ARGUMENTS` means `/guard` no longer converts to a Codex skill — Codex skips
migrating any command whose body contains that literal substring, so the generated set drops from
four to three (`careful`, `pause`, `unfreeze`). This is deliberate: the argument never worked on
either platform, and Codex does not pass command arguments to a migrated skill anyway, so the
choice was between a safety command that works where it is actually used and one that is present
but silently wrong on a secondary harness. Chasing wider Codex command coverage by adopting the
braced spelling was evaluated and **rejected** — it is undocumented on Claude Code and would trade
the primary platform for a degraded secondary one.

## [0.8.0] — 2026-09-04

**Right-sizing pass.** keystone's execution loop was built when context rot bit early and models
under-verified; both have moved. This applies keystone's own doctrine — *a gate that has never
failed anything is theater*, *scaffolding has a sunset* — to keystone itself, cutting ceremony
where it was paying for constraints that have relaxed while leaving every safety ceiling intact.
Plus four principle folds that close real gaps rather than restating neighbours.

### Changed — the ceremony cut

- **Dispatch a slice, not necessarily a task** (`subagent-driven-development`). A **slice** is
  consecutive plan tasks sharing files or an interface, sized to fit one worker window; a plan of
  ≤3 tasks is one slice, genuinely disjoint tasks may still go one-per-dispatch (which is what
  makes them wave-able), and a slice's Risk is the max of its tasks'. **Tasks remain the tracking
  unit** — run-state checkboxes, the resume heuristic, and AC tracing are untouched, and the
  slice's worker returns per-task evidence. Rationale stated in the skill: every dispatch re-pays
  its cold start, and a coherent multi-file change is the work that suffers most from being cut
  into fragments that each rediscover the same context. Split on signal (a `NEEDS_CONTEXT` for
  want of window, or a report thinning across later tasks).
- **One review seat at MED.** The gate table is now LOW → you verify · MED → **Mason → Riley, one
  pass** (spec + quality + test quality + the one-row-per-AC trace) · HIGH → Mason → Quinn → Riley
  spec → Riley quality → Sage if a safety surface. Riley's single pass takes over Quinn's
  mechanical work (runs the suite, checks RED→GREEN against the code as it stands, audits test
  *quality*, emits the AC trace, and inherits her severity mapping and evidence-provenance
  tagging), and **carries two of her triggers**: escalate to HIGH when a diff removes or weakens
  a test/validation/authz check — the trigger that catches an over-applied `defend:` — and route
  a serious security finding to Sage by escalating, since the MED tier doesn't include him.
  **The justification is explicitly unmeasured**: we have no evidence about a second reviewer's
  marginal findings, which is why the `Gates:` tally ships in the same release. The two changes
  are ordered deliberately — cut where blast radius doesn't justify the seat, and start
  collecting the evidence that would confirm or reverse it.
  **What MED genuinely gives up is stated in the skill rather than papered over**: an independent
  risk profile (probability × impact with a scrutiny budget), the NFR pass, and a second reader
  with different blind spots. Those are what HIGH buys. `spec-reviewer-prompt.md` and
  `code-quality-reviewer-prompt.md` are now marked HIGH-only.
- **An untagged task is scored, not defaulted to HIGH.** Previously *absent `Risk` tag ⇒ HIGH*,
  which made the un-tagged case the main ceremony driver. Now: score it against `writing-plans`'
  rubric **from the plan and a read of the files the task names** — the rubric makes signals
  checkable from the diff/codebase, and an untagged task usually has no `Verified-behavior` block
  to read, so the plan's prose alone rarely settles the safety-surface signals. **Absence of an
  alarming word in a plan is not absence of a signal**: never MED on silence; no files named, or
  files not read ⇒ HIGH. Any HIGH signal ⇒ HIGH; unanswerable ⇒ HIGH; otherwise MED; **never LOW
  by default**. Write the scored tag in and record it as a Locked decision. The rule being
  enforced is that nothing runs un-scored. `writing-plans` now calls an untagged task a plan
  defect.
- **The front door proposes the level from signals** (`/spec`, `writing-plans`, `plan-levels.md`).
  Was a fixed default of Medium; now propose the **lowest band the observed rubric allows**, name
  the signal that set it, and let the user confirm or override in a word — Medium only as the
  fallback when nothing is known yet. The delta-callback policy and its single blocking trigger
  (a safety surface under a declared Light/Medium) are unchanged.
- **Gate verdicts are recorded, so the next cut is measured.** The run-state summary block gains a
  `Gates:` line (one verdict per gate, `—` for gates the tier didn't run), and
  `finishing-a-development-branch` Step 7 **tallies the run before retiring the file** — a gate
  that ran 3+ times and returned PASS every time gets a one-tap `/learn` entry recording that, so
  evidence accumulates across runs. This is deliberately the cheap version: no new telemetry file,
  no new format. One run is a data point, not a verdict.

Two safety properties held explicitly through all of the above. **No ceiling moved for a scored
task** — the six safety-surface signals still force HIGH, the plan-level blocking trigger still
fires, waves still require proven isolation. The one default that changed is the **untagged**
case, which is now scored against the codebase rather than assumed maximal (see above, and note
the non-inference rule that came with it). And **`DONE_WITH_CONCERNS` stays first-class**, with
the orchestrator still owning the ship decision at every tier.

An audit for redundant re-check instructions (the sixth planned task) found **nothing left to
cut** — the v0.7.0 pass had already removed them. Recorded rather than padded.

### Fixed

- **Three dead references to a non-existent `executing-plans` skill** in shipped templates
  (`plugins/keystone/templates/plans/plan.md`, `templates/plans/plan.md`,
  `templates/plans/README.md`) — pre-existing, and invisible to the validators, which check
  relative `.md` links but not prose skill-name references. Found while sweeping those same
  headers for the slice/level wording.
- **`templates/INSTINCTS.md`** — the subagent-dispatch instinct still triggered on "a bounded,
  well-specified task … one plan-task", which contradicted both the widened inline rung (0.7.0)
  and slices. Retriggered on the thing that actually justifies a dispatch: the task's own **read
  volume** swamping your context.

### Added — four principle folds

- **The judgment/determinism duality** (`designing-agent-systems`). The skill carried only
  *deterministic-first*; it now carries the dual — **do not replace model judgment with keyword
  rules, scoring heuristics, hard-coded decision trees, or fixed loops merely because they are
  easier to implement.** A keyword list standing in for "is this relevant?" is the same mistake as
  an agent that should have been a regex: the wrong tool, picked for the author's convenience, and
  it fails silently on everything its author didn't enumerate. Stated as a division of labor —
  **the agent owns judgment; the host owns constraints and guarantees** (schema validation, authz
  boundaries, exact identifiers and populations, lineage, idempotency, budgets, retry limits,
  persistence, structural invariants) — and carried into the harness-layers framing plus two red
  flags.
- **Say the better idea; don't ship it uninvited** (`coding-standards`). Scope discipline bounds
  what you *change*, not what you *say*, and collapsing the two channels fails in both directions.
  This closes a tension v0.7.0 introduced by hardening "the scope is the deliverable": name the
  materially better approach with its tradeoff, keep it out of the implementation, and let the
  user take or drop it — unless the work cannot be correct without it, in which case it's a
  blocker, not a suggestion.
- **`defend:` — defensive code as a bloat category** (`auditing-for-overengineering`, `/review`,
  `code-reviewer`). A sixth tag for error handling, validation, or fallbacks for states that
  cannot occur: a null check on a value the caller just constructed, a `try` around code that
  doesn't throw, re-validating a value a private helper got from its only in-process caller, a
  default branch on an exhaustive enum. Three guardrails shipped with it, because it is the
  easiest tag to misuse: **trust boundaries are never bloat**; **a separate service, process, or
  agent is a trust boundary, not an "internal caller"** (`api-security`: an internal caller is an
  unauthenticated caller with a friendlier name); and **"cannot occur" must be a guarantee you can
  name** — a type, an invariant, a caller you have read — or the check stays. The guardrails
  travel with the tag to `/review` and `code-reviewer`, not just the owning skill.
- **Scope traceability as a reviewer check** (`/review`, `code-reviewer`). Every changed line
  should trace to a requirement; a hunk tracing to nothing is either a boy-scout cleanup inside
  the footprint or unrequested scope. keystone had only the negative boundary (what cleanup is
  *allowed*); this adds the positive check, which catches what a correctness pass misses — good
  code nobody asked for.

## [0.7.0] — 2026-09-03

Multi-task pass: keystone's dispatch, orchestration, and worker-prompt guidance re-aligned with
the current frontier-model prompting guides ([Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5),
[Claude Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1)).
Per their own guides the two pull in opposite directions on several axes — one over-delegates and
over-narrates, the other under-batches and goes quiet — so every rule here is written as the
**wanted behavior**, model-agnostic, not as a correction of either model's habit. No model names
in shipped prose.

### Changed

- **`dispatching-parallel-agents`** — the inline rung widened: anything you can finish in a
  handful of tool calls is inline, not a dispatch; one subagent is for work whose _read volume_
  would swamp your window, and one agent, not several, whenever one can do it. **Spawn
  discipline**: never a seat to settle what a *command* settles — the line is fact vs judgment, so
  a fresh reviewer on an artifact you authored (`adversarial-review`, `/review`) still earns its
  seat; keep counts low, cap deterministically where the harness allows. Two new sections — **Batch
  what's independent** (privately list what you need, then request every independent item in
  one response; tool calls and dispatches alike) and **Don't idle while workers run** (when
  dispatch returns immediately, build the next packet and run landed gates; wait explicitly, once).
  `patterns.md` gains a standard **packet footer** — the unattended-run contract, the batching
  nudge, the scope fence, and a compressed-return shape — plus three new common mistakes
  (open-bottomed packets, verify-by-proxy, dispatch-and-wait one at a time). `harness-notes.md`
  gives the **test** for which dispatch shape you have — a spawn call that returns an id with a
  separate wait call (both major coding CLIs today) vs one that hands back the finished result,
  where "don't idle" degrades to "launch all at once" — plus deterministic spawn-depth /
  concurrency / spend caps named as instances and dated, and per-dispatch effort with the
  low-effort-may-suppress-search caveat.
- **`designing-agent-systems`** — a rung is a **model _and_ an effort setting**: a frontier model
  at low effort belongs in the sweep against a smaller model at high effort; effort doesn't
  shorten output and at the low end suppresses tool use. A seat to check your own work is not a
  seat. Three new named failure modes — _over-delegation_, _under-batching_, _lead idling_ — with
  counters; spawn caps join the guardrails layer. **Prompt lines are scaffolding too**: behavioral
  corrections rot in both directions across model generations, so write the wanted behavior,
  never last generation's correction. Two red flags to match.
- **`subagent-driven-development`** — the orchestrator's end-of-turn check (a last paragraph
  that is a plan or a "Next, I'll dispatch…" is work to do, not a message to send); every packet
  carries the standard footer; **Model Selection** reframed as the cheapest model-and-effort
  pairing, with scouting seats a rung up. `parallel-waves.md`: gates run per task as each result
  lands and the next wave's packets get built in the gaps — the barrier gates only the _next
  wave's dispatch_. `implementer-prompt.md`: questions return as `NEEDS_CONTEXT` before work
  begins, then the worker runs unattended (proceed on reversible steps the packet covers; stop
  only for destructive actions or a real scope question, by returning a status); batch
  independent calls and edit surgically; test additions sized to the task, scratch checks not
  promoted to permanent files; the **self-review checklist trimmed to a packet check** —
  complete, in scope, evidenced — with no re-running of verification the report already holds
  (the report fields are the check); end the turn on the report.
- **`code-reviewer`** (agent + `code-reviewer-prompt.md`) — report every substantiated finding,
  graded; severity is the filter, not the threshold for mentioning; the orchestrator triages.
  Stall detection now counts open **must-fix** items so nit churn doesn't read as a stall.
- **Reviewer dispatch templates** (`code-reviewer-prompt.md`, `spec-reviewer-prompt.md`) — carry
  the unattended / batching / result-not-transcript footer, like the implementer template.
- **Destructive-action stops have a handler** — a worker's `NEEDS_CONTEXT` asking to confirm an
  irreversible action routes to the **user**, not the orchestrator (a relayed approval is not
  approval), and the answer is recorded as a Locked decision before re-dispatch.
- **`implementer`** agent — read in one batch, edit surgically, end on the status.
- **`long-running-agents`** — **tell the loop it's unattended**: the stall-on-permission failure
  mode (a turn ended on "shall I apply this?" that nobody answers until the next wake), the
  proceed / must-stop split, and the end-of-turn check, with must-stop actions named explicitly.
- **`ATTRIBUTION.md`** — the two prompting guides recorded under methodology inspiration, naming
  the two sentences kept close to their wording and why.

## [0.6.0] — 2026-08-30

Second borrow pass over [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
(MIT — see `ATTRIBUTION.md`), plus the removal of one skill and a new structural-validator tier.
Ideas are upstream's where noted; all prose written for keystone. **31 → 30 skills.**

### Removed

- **`cost-aware-llm-pipeline`** — its `description` claimed routing territory belonging to three
  other skills. Measured against the live corpus, the prompt *"should I fan out subagents for this
  or do it inline"* ranked it **#1 at 0.272** over `dispatching-parallel-agents` at 0.160 — a near
  restatement of that skill's own stated purpose — and *"batch process these N records"* matched
  nothing else at all. The routing evals had missed it because the suite held only positives
  written for the skill, never adversarial prompts from a neighbour's territory.
  Content was rehomed, not dropped: the **tier ladder, cache economics, and the
  no-hardcoded-model-IDs/prices rule** into `designing-agent-systems`; **budget ceilings, velocity
  circuit breakers, and denial-of-wallet** into `long-running-agents`. Thirteen prose references
  and two eval-case `owner` fields were retargeted or cleared.

### Added

- **Structural validators (`scripts/`)** — a deterministic tier below the routing evals, with 111
  new tests. `validate-versions` holds `VERSION` and both manifests to one value (the drift this
  repo hit at 0.27-vs-0.18); `validate-reference-links` proves every relative `.md` link in a skill
  resolves from its own directory, in-repo and in the plugin-install layout;
  `validate-skills` enforces keystone's frontmatter contract — `name` + `description` only,
  name matching a kebab-case directory, a description that binds use to a **situation** rather than
  a purpose (bare "Use to…"/"Use for…" is rejected), a description-length ratchet set above the
  observed ceiling, and dead cross-skill-reference detection. Exemptions live in the validator,
  never in a skill's own frontmatter, so a skill cannot exempt itself.
- **`## Rationalizations` + `## Red flags`** authored for eight discipline skills —
  `security-review`, `api-security`, `coding-standards`, `verification-before-completion`,
  `test-driven-development`, `simplifying-code`, `auditing-for-overengineering`,
  `receiving-code-review`. Scoped deliberately to skills where rationalization is a *live* failure
  mode rather than applied catalog-wide: a generic block teaches readers the heading is skippable.

### Changed

- **`api-security`** — idempotency keys that actually deduplicate: key derived from the intent
  rather than the attempt, **uniqueness on `(principal, key)`** so one caller cannot claim
  another's key or be handed their stored response, atomic claim (look-up-then-write is a race),
  a payload hash over a *canonical* form, an explicit in-flight-duplicate policy, **unknown as a
  third outcome**, and retention that outlives the longest replay window. Plus OAuth **PKCE +
  `state`**, and the DNS-rebinding half of SSRF.
- **`security-review/data-privacy.md`** (new sibling) — data-lifecycle review, kept out of the
  source→sink file because it is an architecture pass, not a diff pass: classification tiers,
  purpose-bound minimization, and a deletion path that reaches backups, caches, indexes,
  analytics copies, queues/CDC, and versioned object storage — while being honest that
  append-only retention-locked logs cannot do per-subject deletion, so the control there is
  keeping data out of them. Consent gates onward sharing, and an LLM vendor counts. Cited from
  `SKILL.md`'s pre-deployment checklist. Plus **Subresource Integrity** stated usably in
  `SKILL.md` — `crossorigin="anonymous"` is required or the check cannot run, SRI covers exactly
  one hop, and some artifacts (floating refs, UA-varying stylesheets) have no stable hash.
- **SSRF is a TOCTOU bug** (`security-review` A06, `api-security` API7) — validating a hostname and
  then handing that hostname to the client lets the check and the connection see different IPs. The
  fix as stated: resolve once, validate **every** address in the answer, connect to exactly one with
  fallback to alternates disabled (happy-eyeballs-style retry silently reopens the gap), or front it
  with a filtering egress proxy — re-checked on each redirect. `api-security` owns the full
  treatment (SSRF is API7); `security-review` carries the reviewer's question and a pointer. Block lists now cover IPv6 and
  IPv4-mapped forms, so `::ffff:169.254.169.254` cannot walk past a v4-only list.
- **`coding-standards`** — dependency-*upgrade* review (changelog over version number, one
  dependency per change, green suite before and after, the **lockfile** diff not just the manifest)
  and documentation-verification discipline (version from the manifest, anchored deep links, an
  explicit `UNVERIFIED:` marker instead of hedged prose).
- **`llm-security`** — never hardcode an outbound endpoint taken from a fetched doc example without
  surfacing it, even when the docs mark it required.
- **`writing-plans`** — a Phase-0 **capability map** gating multi-capability requests: a module
  table with an explicit build order, stable kebab-case ids, "if two modules each need the other
  they are one module", and interfaces specified in the provider's plan. Reconciled explicitly with
  the folder phase index and `## File Structure` as three nested partition passes.
- **`systematic-debugging`** — Phase 1 no longer dead-ends at "gather more data": four branches for
  a bug that will not reproduce (timing, environment, state, truly intermittent), plus `git bisect`.
- **`deprecation-and-migration`** — the feature-flag lifecycle, ending at *remove the flag and its
  dead code*, with a cleanup trigger recorded as a `keystone:` marker so `/debt` harvests it.
- **`git-workflow`** — version-bump criteria by consumer-observable impact; changelog grouped and
  written with the change. Which files carry the version stays owned by `/ship`.
- **`verification-before-completion`** — acceptance criteria (per task) vs. Definition of Done
  (standing); a task is done only when both hold.
- **`subagent-driven-development`** — `parallel-waves` gains a third category between parallel and
  sequential: tasks coupled only through an interface become parallel once the contract is defined
  first. The independent-AND-isolated gate still binds.
- **`brainstorming`** — divergent *generation* lenses (inversion, constraint removal, audience
  shift, combination, simplification, 10×, expert lens, analogous inspiration with a
  structural-not-surface test), supplying the method `/office-hours` assumed when it asked for three
  genuinely different approaches.
- **`/qa`** — browser-automation guardrails: prefer an isolated profile, since attaching to the
  everyday session exposes every open window; DOM, console, and network content is untrusted data,
  never instructions.
- **`/cso`** — rotate *then* purge; a secret is compromised the moment it reaches a remote.
- **`/to-issues`** — once issues exist in a tracker, the plan's task list is an ordered index of
  ids, not a duplicate checklist.
- **`/ship`** — where a change shipped behind a flag, flag-off is the first rollback lever.

### Changed — second source: [mattpocock/skills](https://github.com/mattpocock/skills) (MIT)

A parallel borrow pass over a library keystone had already taken `to-issues`/`to-prd` from.
Twenty-nine live skills reviewed; four genuine gaps found, all folded, no new skills.

- **`systematic-debugging`** — **minimisation**, which keystone had no equivalent of: shrink the
  reproduction until *every remaining element is load-bearing*, because each element cut is a
  suspect struck off before Phase 3 builds its fault tree. Above it, the **reproduction-rate**
  framing — aim at the rate, not at a clean repro ("a bug that fails half its runs is debuggable,
  one that fails a run in a hundred isn't"), which turns the existing intermittency branches into
  instruments with a target and a measurable stopping condition. Minimising is gated on it:
  against a 1%-reproduction loop you cannot tell "that cut removed the cause" from "that run got
  lucky." Plus a **loop-construction ladder** (ten ways to build a red signal, cheapest and most
  deterministic first), **tagged instrumentation** (`[DEBUG-a4f2]` — untagged logs survive, tagged
  logs die) with a new **Phase 4 cleanup gate** keystone previously lacked, and "if no correct seam
  exists, that itself is the finding" routing to `improve-codebase-architecture`.
- **`writing-skills`** — **leading words**: recruit a pretrained concept as a repeated anchor token,
  since a made-up word recruits no priors and you pay in definition tokens what a pretrained word
  gives free. **Completion criteria have two independently-moving properties** — *clarity* (can the
  agent tell done from not-done; vague bounds cause premature completion) and *demand* (how much
  work the bound compels) — with the fix order stated: sharpen the bound first, and note that
  splitting to push steps past a boundary only works across a *real* context boundary. And
  **the environment is a source of truth; a doc restating it is a cache** — cache the unwritten
  convention, not the one-command lookup.
- **`writing-plans`** — **fog**: a plan is deliberately incomplete, and a `## Not yet specified`
  section holds in-scope questions not yet sharp enough to task. The load-bearing rule is the
  **fog-or-task test — whether you can state the question precisely now, not whether you can answer
  it now** — making fog the complement of SPIDR's Spike (sharp-but-unanswered) rather than a rival.
  Disambiguated against the existing No Placeholders rule by location: fog lives in its own named
  section, never inside a task's steps. **"Out of scope" is a separate section, not fog** — fog
  graduates into tasks, out-of-scope never does.
- **`writing-plans`** — the **wide-refactor exception to vertical slicing**, with a three-part
  qualification test (mechanical, too many call sites for one reviewable task, no subset can change
  alone) so the exception cannot be claimed by anything merely large: *a change where some callers
  can be cut over independently is a vertical slice you haven't found yet*. Sequenced expand →
  migrate in batches sized by blast radius → contract, with green promised only at a final
  integrate-and-verify task where batches cannot stay green alone. **Prefactor first** — a wide
  blast radius is sometimes a symptom, and extracting the seam can dissolve the exception entirely.
- **`test-driven-development`** — **agree the seam before RED**, alongside the existing
  find-the-real-test-command step. An unconfirmed seam is a question, not a default: unnamed, tests
  land at whatever boundary was easiest to reach, producing a suite that is simultaneously
  over-tested (the same behavior asserted at three levels "to be safe") and under-tested (nothing
  at the level that would catch the regression). Where there is nobody to confirm with, record the
  chosen seam and the reason where a reviewer sees it rather than picking by convenience. The
  no-correct-seam case is the same rule `systematic-debugging` applies at bug-fixing time, here at
  feature-writing time — both route to `improve-codebase-architecture`.

### Fixed — pre-release review and audit pass

A `/review` over the folds that had not been independently reviewed, plus an `/audit` over the
whole release, run before shipping. Both returned findings; all were applied.

- **`writing-plans`' wide-refactor section told the executor to land batches on a shared
  integration branch**, which requires per-batch commits — contradicting the no-auto-commit rule
  stated four times in that same file and in `CLAUDE.md`. Green is now promised at the
  integrate-and-verify task; how batches are held until then is the user's call at execution time.
- **The "no correct seam" rule was restated near-verbatim in two skills** rather than owned by one
  — a Duplication violation shipped in the same release that added the Duplication rule, and one
  that wrote past a pointer already present a bullet above. `test-driven-development` now owns it;
  `systematic-debugging` cites it.
- **The new `seam` definition contradicted the kit's own glossary** and was built on "boundary", a
  word `improve-codebase-architecture/LANGUAGE.md` explicitly bans as overloaded — while both new
  folds route readers into that skill. Now defers to the owning definition.
- **The capability-map gate contradicted the Light plan level** and failed this file's own
  lean-process self-review. Scoped to multi-module work; skipped for single-module and Light runs.
- **`[DEBUG-]` tagging was buried inside a multi-component step** that single-component debuggers
  skip, while the Phase 4 checklist greps for the marker they were never given. Lifted to a
  standing rule at the top of Phase 1.
- **Trimmed ~160 lines of restatement and decoration**: the duplicated SSRF treatment, four
  Rationalizations/Red-flags entries that restated their own file, a ten-rung ladder where the
  first item covered nine cases in ten, an ASCII diagram restating the prose above it, and three
  paragraphs of border patrol defending a term rather than using it.

## [0.5.0] — 2026-08-10

Borrow pass over [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT —
see `ATTRIBUTION.md`): three new skills and technique folds across fifteen existing files.
Ideas are upstream's where noted; all prose written for keystone.

### Added

- **`performance-optimization`** — measure → identify → fix → verify → guard, with the
  discipline most perf work skips: **neutral is a revert, not a keep** (a keep/revert decision
  table; the win threshold is chosen *before* looking at the result), beat the noise not the
  mean, one change at a time, correctness gates the metric, and an **attempt ledger** so
  reverted ideas leave a trace git history won't keep. Sudden slowdowns route to
  `systematic-debugging` first.
- **`observability`** — instrumentation starts from the 2–4 literal questions on-call will ask,
  not from signals. Metrics = *that*, traces = *where*, logs = *why*; percentiles never
  averages; **cardinality as the failure mode** (explicit never-a-label list); mandatory
  correlation IDs; two alert severities only, each with a runbook; and a **verify-the-telemetry
  gate** — an induced staging failure must be locatable via telemetry alone.
- **`deprecation-and-migration`** — Hyrum's Law makes deprecation an active migration, not an
  announcement; the Churn Rule (the owner migrates the users); a worked **expand/contract**
  schema change (additive first, destructive last *and alone*, tested down path, throttled
  backfill) generalized to any interface where two versions run live; zombie-code signals with
  a binary verdict, routing remove-vs-keep through `auditing-for-overengineering`'s deletion
  test.

### Changed

- **`systematic-debugging`** — description gains "a working feature is suddenly slower or
  broken", the routing boundary that keeps sudden-slowdown asks here rather than at the new
  `performance-optimization` skill (whose scope note points back the same way).

- **`adversarial-review`** — three moves from upstream's `doubt-driven-development`: **blind
  dispatch** (the reviewer gets the doc + its contract, never your conclusion — handing over
  your verdict turns review into grading), a **first-match-wins reconcile precedence**
  (contract misread → fix the packet / accepted → fix the doc / disagreement → explicit
  tension / noise → discard, and 3+ noise findings indict the packet), and a **review-theater
  tripwire** (repeated substantive findings with zero accepted = a loop that can't fail).
- **`/challenge` + `llm-security`** — handing an artifact to an external model CLI is a
  trust-boundary crossing: run it read-only/sandboxed, feed the artifact on stdin (never a
  shell-quoted argument — backticks and `$()` in a doc are live shell in a terminal), one
  authorization per invocation. Hardens the cross-provider hop before the packet round-trip
  fast-follow gets built.
- **`brainstorming`** (+ thin echoes in `grill-with-docs`, `office-hours`) — four interview
  moves from upstream's `interview-me`: a stated **hypothesis with a confidence number and the
  gaps named** before the first question; a **want-vs-should-want detector** with the unlock
  probe ("if you didn't have to justify this to anyone, what would you actually want?"); a
  checkable stop test (predict the next three answers); and **what doesn't count as approval**
  ("whatever you think is best" is delegation; "sounds good" isn't a yes). `grill-with-docs`
  keeps ownership of one-question-at-a-time-with-a-recommendation — that move predated this
  and was not duplicated.
- **`test-driven-development`** — find the real test command before RED: checked-in wrappers
  over global tools, focused-run vs full-suite, and read CI because it names what actually
  gates merges.
- **`/review` + `code-reviewer`** — a **structural remedies** list (eight named moves) so the
  reviewer proposes the restructuring, not just the complaint; prefer the remedy that removes
  moving pieces. Sits alongside the existing over-engineering tags, same taxonomy.
- **`/ship`** — a rollout-thresholds table (green / yellow / red bands per signal) handed to
  whoever deploys, framed as per-service defaults. `/ship` still stops before committing.
- **`/qa`, `/audit`, `qa` agent — metric honesty** — never present an estimated figure as a
  measurement: tag every number `measured-now` / `read-from-artifact` / `estimated`, write
  `not measured` where nothing measured it. A plausible invented figure is worse than an
  absent one.
- **SDD implementer prompt** — reports now include `Things I didn't touch (intentionally)`,
  as scope-discipline evidence and `/debt` input.

## [0.4.1] — 2026-07-29

### Fixed

- **`finishing-a-development-branch` shipped 0.4.0 with its pre-rewrite description.** While
  fixing a splitter bug in that file, `git checkout HEAD -- <file>` restored it from the last
  *commit* (v0.3.0) rather than the staging area, silently reverting the retrieval rewrite and
  synonym prune along with the bad split. The re-split was redone; the description was not.
  Verified the loss was confined to that one line — the split and announcement removal survived,
  and no other file was affected. Re-audited all 28 descriptions.

## [0.4.0] — 2026-07-28

### Added

- **`resolving-merge-conflicts`** — the kit had zero coverage for the most destructive routine
  git operation. Resolve by **intent traced to each side's primary source**, not by picking the
  tidier hunk; a table for what `--ours`/`--theirs` mean per operation (rebase inverts the
  intuition, and getting it backwards resolves every hunk exactly wrong); the semantic conflicts
  git *cannot* flag (renames, signature changes, duplicate migration versions) and the
  grep-the-tree sweep that catches them; finishing the operation rather than leaving a broken
  tree; and when `--abort` is genuinely right versus an escape from tedium.
- **`writing-skills`** — this kit's own authoring skill, so the conventions live somewhere an
  agent reads rather than only in this changelog. Covers the two distinct failure modes (never
  fires = description; fires and hurts = calibration), the description shape, freedom calibrated
  to fragility, progressive-disclosure structure, the **conflict sweep** that catches two good
  instructions contradicting each other across files never read together, fence-aware structural
  checks, the house rules (harness-neutral, no hardcoded models or prices, no auto-commit, record
  provenance), and gap-first verification. `/retro` now routes accepted skill pitches here rather
  than to the external `skill-creator`, which cannot know these conventions.
- **A prototype branch in `brainstorming`** — `test-driven-development` exempted "throwaway
  prototypes" and `writing-plans` said "spike it", but nothing defined either. Now: when a
  question is about behavior rather than preference, build the throwaway (runnable script for
  state/logic, radically different variations for interaction), timeboxed and explicitly
  disposable — prototype code that quietly becomes production code is the expensive outcome.

### Changed

- **Retrieval pass over every skill `description:`.** Descriptions now quote the literal phrases
  a user actually types rather than describing a precondition Claude has to infer it is in
  ("Use when implementing any feature" → `"write a test"`, `"TDD this"`, `"add coverage"`).
  Sixteen skills rewritten. Six that compete with a built-in or another plugin
  (`security-review`, `simplifying-code`, `auditing-for-overengineering`,
  `designing-agent-systems`, `onboard-codebase`, `dispatching-parallel-agents`) now state their
  scope boundary explicitly, so the overlap resolves instead of splitting the vote.
- **De-escalated the three "Iron Law" skills** (`test-driven-development`,
  `systematic-debugging`, `verification-before-completion`) from anti-loophole prose to
  judgment-first guidance. The rules are unchanged and still stated firmly; what's gone is the
  scaffolding built to stop an older model generation from lawyering its way out — "violating
  the letter is violating the spirit", the rationalization-rebuttal tables, `MANDATORY`,
  "that's rationalization", and a fabricated-metrics section. 993 → 748 lines, substance intact.
- **Progressive disclosure applied to the five largest skills.** `cost-aware-llm-pipeline`,
  `receiving-code-review`, `finishing-a-development-branch`, `dispatching-parallel-agents`, and
  `subagent-driven-development` each pushed depth into sibling files behind a "Going deeper"
  index. Every `SKILL.md` is now back inside the repo's own ~500-line budget.
- **`writing-plans` — reference in the highest-fidelity form available.** New section: attach the
  mockup, schema, fixture, failing test, or `path:line` exemplar rather than prose describing it.
- **Conformance pass against the official Agent Skills authoring checklist.** Tables of contents
  added to the ten multi-section reference files over 100 lines (skipped on single-template files,
  where a TOC is noise and risks being copied into a dispatched prompt). `improve-codebase-architecture`
  gained a Reference files index and its sibling-to-sibling links were demoted to plain mentions,
  so every reference is now one level from its `SKILL.md` — previously `INTERFACE-DESIGN.md` and
  `HTML-REPORT.md` pointed at `LANGUAGE.md`/`DEEPENING.md`, the nesting that makes Claude preview
  files with `head` instead of reading them.
- **Trigger synonyms pruned to one per branch.** The retrieval rewrite above traded tokens for
  recall; this trims the phrasings that routed to the *same* branch while keeping those that route
  to different ones (e.g. `finishing-a-development-branch` keeps merge / PR / cleanup as three real
  endings; `receiving-code-review` keeps "is this feedback right" as the pushback branch, distinct
  from "address the review"). Recovers ~173 tokens of the ~430 the rewrite cost.
- **`verification-before-completion` re-tightened.** The de-escalation pass above went half a step
  too far here. Per the degrees-of-freedom principle — match specificity to the task's fragility —
  a completion claim is a narrow bridge, not an open field: the gate is now an explicit fixed
  sequence, names the two steps that actually get skipped (fresh run, whole output), and states
  that it covers every phrasing of completion rather than the literal word "done". The
  anti-rationalization scaffolding stays gone; the rigidity comes back as specificity.

### Fixed

- **Normalized the inherited "your human partner" phrasing to "the user"** across 6 files — a
  superpowers-era address that no longer matched the rest of the kit after the de-escalation pass.
- **`.gitignore` now covers `.ruff_cache/` and `__pycache__/`.** The formatter hook shells out to
  ruff, which drops a cache directory in whatever it runs from; one landed inside `skills/` and
  `plugin-config.test.js` correctly failed it as a skill with no `SKILL.md`. Ignoring it stops a
  tool artifact from ever being committed as a fake skill.
- **Four genuine instruction conflicts** where a skill told an agent to commit while twelve other
  files told it not to: `brainstorming` step 5 ("save the design doc **and commit**"), the
  `writing-plans` task template ("Step 5: Commit" with a `git commit -m` block, handed straight
  to an implementer whose own agent definition forbids committing), and `writing-plans`' overview
  and self-review checklist, both of which listed "frequent commits" as a plan-quality criterion.
  All four now stage and stop.
- **Dropped the `**Announce at start:**` preamble** from five skills and the handoff line in
  `no-subagent-fallback.md`. The harness already shows which skill fired; a scripted sentence
  restating it is ceremony the model pays for on every load.
- Removed a byte-identical "why subagents" paragraph duplicated between
  `dispatching-parallel-agents` and `subagent-driven-development`; dispatch mechanics now have
  one owner and SDD points at it.

### Removed

- **`requesting-code-review`** — superseded by `/review`, the `code-reviewer` agent, and SDD's
  own review loop. Its one load-bearing asset, the reviewer prompt template, moved to
  `subagent-driven-development/code-reviewer-prompt.md`.
- **`executing-plans`** — folded into `subagent-driven-development` as
  `no-subagent-fallback.md` (the harness-without-dispatch path). Its two unique contributions,
  the deviation triage (auto-fix / ask / defer) and the don't-offload-what-you-can-do-yourself
  rule, were hoisted into the main skill where both execution paths get them.
- Net across the release: started at 28 skills, merged 2 away (→ 26), added 2 net-new
  (→ 28). Same count, different composition — two skills that duplicated existing surface
  traded for two that cover ground the kit had none of.

## [0.3.1] — 2026-07-18

### Added

- **Learning Loop — meta-inbox (the self-healing channel).** Lessons about keystone
  _itself_ — a skill that didn't fire, wrong guidance, a noisy gate — now route from any
  repo to a single global inbox (`<learnings-dir>/_keystone-meta.md`, repo-agnostic by
  construction; the leading underscore can't collide with a generated repo slug). Entries
  are written **generalized at capture** (the inbox feeds this public repo, so anonymization
  happens at the source). `/retro` gains a standing "did keystone help or hinder?" question
  everywhere, and — inside the keystone repo — drains the inbox by clustering recurring
  themes into proposed skill/command diffs. Promotion machinery stays deliberately manual
  until the inbox proves volume (lean-process rule applied to ourselves).

## [0.3.0] — 2026-07-17

### Added

- **`designing-agent-systems` skill** — the front door for anything agent-shaped: two prior
  questions (agent at all? one or many?), topology vocabulary (orchestrator-worker,
  adversarial verify, tournament, peer team), the five harness layers, named model failure
  modes (victory declaration, one-shot overreach, self-preferential bias, goal drift), a
  scaffolding-sunset rule (every workaround gets a ceiling + upgrade trigger), and a design-note
  template. Over-engineering check runs first and throughout — a seat/gate that doesn't earn
  its cost doesn't ship.
- **`long-running-agents` skill (loop engineering)** — loop modes (fixed-interval, self-paced,
  scheduled-wake, queue-consumer), the iteration contract (orient from state → one task →
  verify end-to-end → write state), memory-outside-the-window (progress file + failure log +
  initializer session), three independent loop exits (verifiable done, stuck/gutter detection,
  budget enforcement), and when NOT to loop.
- **Boy Scout rule** in `coding-standards` — leave touched code better than found, bounded by a
  three-part test (already-touched lines, seconds of work, zero blast radius) so it never
  becomes scope creep; `executing-plans` deviation triage carves it out explicitly, and
  reviewers are told not to flag genuine boy-scout cleanups as noise.
- **Multi-agent trust boundaries** in `llm-security` — tool poisoning as a first-class supply-
  chain threat (poisoned tool metadata), permission laundering (relayed approval is never
  consent), orchestrator accountability diffusion (independent safety checkpoints per agent),
  and compliance-as-vulnerability for workers consuming untrusted upstream output.
- **Learning Loop — Phase 1: the loop closes** (internal spec; survived a `/challenge`
  adversarial pass; claims re-verified against live `learnings.js` before shipping). SDD task completion is now the loop's automatic capture point — **fatigue-gated**:
  a one-tap `/learn` draft is offered only when a gate actually caught something, never on a
  clean pass. SDD handoff packets (and the implementer template) gain a **matching repo
  lessons** slot, closing the structural gap where session-start-surfaced lessons never reached
  dispatched crew members. `/investigate` banks confirmed root causes; `/handoff` offers capture
  for gotchas that outlive the note. `/learn` entries gain a `**Triggers:**` line from a small
  controlled vocabulary — born-tagged inside the current format, so the Phase 2 typed-schema
  migration is mechanical. Human-gated end to end; no silent writes.
- **Lean-process rubric row** in `/plan-eng-review` — every gate/artifact a plan adds must earn
  its pain; ceremony scores against the plan — with a matching self-review check in
  `writing-plans` (cut any gate that can't say what breaks without it) and boy-scout
  carve-outs in the spec-reviewer prompt and `code-reviewer` agent so zero-blast-radius
  cleanups are recognized as maintenance, not bounced as scope creep.

### Changed

- **No hardcoded model names anywhere.** `cost-aware-llm-pipeline` now carries zero model IDs
  and zero dollar figures — tier language only (cheap/mid/high/top) plus instructions to
  snapshot live pricing into project config (ratios over dollars, as-of dates, sunset dates).
  `/review`, `/plan-eng-review`, `planner`, `/context-budget`, and
  `subagent-driven-development` de-hardcoded to tier language to match. Skills stay current
  by construction instead of by maintenance.
- **`cost-aware-llm-pipeline` gains the agentic-loop cost layer** — cost per completed task as
  the headline metric (a pricier model can be cheaper per task; measure, don't assume), cache
  hit rate as the dominant loop lever (byte-stable prefixes, the cache-read diagnostic),
  super-linear subagent fan-out (~4x for a two-way split), budgets as loop control (ceiling +
  velocity circuit breaker), and platform-native context reduction (context editing,
  compaction, deferred tools, programmatic tool calling, structured outputs) over hand-rolled
  truncation.
- **`dispatching-parallel-agents` modernized** — read-heavy-fans-out / write-heavy-isolates
  asymmetry, compressed schema-constrained returns, the orchestration pattern vocabulary
  (classify-and-act, fan-out-and-synthesize, adversarial verification, tournament,
  loop-until-dry, completeness critic), judge-reliability cautions (diverse lenses over
  identical refuters, binary rubrics, votes are signal not proof), returns treated as claims
  not facts, peer/team primitives as a deliberate last rung; dated session-log tail removed.
- **`subagent-driven-development`** — fresh-context-per-task grounded in its three independent
  justifications; re-reviews framed adversarially (never "is it fixed now?"), with a
  different tier/family reviewer on HIGH-risk tasks; the DONE evidence gate names the victory-
  declaration failure mode it defends against.
- **`adversarial-review`** — different model *family* decorrelates more than a different tier
  (correlated seats re-vote shared biases; votes are signal, not proof); tournament escalation
  for one-way-door choices.
- **`/context-budget`** — deferred tool loading changes the math (check before assuming eager
  schemas); "defer, then disconnect" is the new first recommendation; names the shared
  invariant: advertise cheap, load on demand.

## [0.2.1] — 2026-07-01

### Fixed

- **Hooks survive a mid-session plugin update instead of exit-1 spam.** Harnesses resolve the
  plugin root at session start; updating the plugin swaps the installed version directory out from
  under already-open sessions, so every `node <plugin-root>/hooks/*.js` hook died with
  MODULE_NOT_FOUND (exit 1) until restart. The bundled node hooks now resolve the root via
  `${CLAUDE_PLUGIN_ROOT}` with a `${PLUGIN_ROOT}` fallback (the native var on Codex-style
  harnesses) and, when the script is genuinely gone, degrade to exit 0 — guard/scan/instincts/
  learnings emit a one-line `systemMessage` telling you to restart; notify skips silently.
- **Formatter hook no longer reaches the npm registry.** The Write/Edit formatter ran
  `npx prettier --write`, which fetches and executes an unpinned prettier from the registry when
  none is installed locally (blocking up to the 30s timeout offline, and a small supply-chain
  hole). It now formats only with a repo-local `node_modules/.bin/prettier` or one already on
  PATH, and skips otherwise; `ruff` is gated the same way with `command -v`.

### Changed

- **Fable-era model refresh.** The cost-tier ladder gains a fourth rung: Haiku → Sonnet → Opus →
  **Fable** (top tier, ~2x Opus per token), reserved for **adjudication and adversarial seats**,
  never as a routing default. `cost-aware-llm-pipeline` adds `MODEL_FABLE`, the verified 2026-07
  pricing row ($10/$50 per MTok), the effort-level enum (`low..max`, `xhigh` as the agentic sweet
  spot on Fable/Opus 4.7+), and a newer-tokenizer cost caveat. `/review`, `planner`,
  `/plan-eng-review`, and the README name the fourth tier; `adversarial-review`, `/challenge`, and
  the plan-convergence loop make "heavier model tier" concrete (per-dispatch model override, one
  tier above the session model, where the harness supports it).
- **Per-dispatch declarations.** `subagent-driven-development` Model Selection now says to declare
  the Risk-table tier/effort on the dispatch call where the harness supports overrides — and
  records the deliberate choice NOT to pin models in agent definitions (tier is per-task, not
  per-agent). `using-git-worktrees` + `parallel-waves` name dispatch-time worktree isolation as
  the preferred instance for parallel task isolation.
- **Refusal-aware security dispatch.** `security-review` + `/cso`: security-work packets carry
  explicit authorization context; a safety-classifier decline is re-framed or re-run a tier down
  and reported as NOT RUN — never silently counted as "no findings."
- **Cross-harness gating closed out.** The two remaining un-gated dispatch sites
  (`improve-codebase-architecture` hard-coding the Agent tool, `/cso` naming the Task tool bare)
  now carry the standard "or the equivalent elsewhere" degradation. `/context-budget` percentages
  are window-aware (200k vs 1M-context sessions) instead of hardcoding 200k. README no longer
  claims `/qa`/`/cso` scale cost tiers (only `/review` does).

### Docs

- README "Updating": restart open sessions after a plugin update; harnesses with per-hook trust
  (e.g. Codex) also require re-approving hooks when a release changes hook commands.

## [0.2.0] — 2026-07-01

### Added

- **`/challenge` + the `adversarial-review` skill** — an independent, fresh-context adversarial pass
  over any finished doc (spec / plan / PRD / ADR). A reviewer with zero authorship memory builds a
  typed **Assumption Ledger** (implicit assumptions included, ranked by blast radius), red-teams it
  against the real codebase (composing `grill-with-docs`), and challenges the **approach** itself —
  simplest? already-built? most-scalable? better alternative? — before ending with a
  **survivability score** and folding accepted findings back into the doc (disagreements kept as
  explicit tensions). Thin command → rich skill, mirroring `/investigate` → `systematic-debugging`.

### Changed

- **One owner for the independent adversarial pass.** `/plan-eng-review`, `/plan-ceo-review`, and
  `writing-plans` no longer hand-roll their own high-stakes second-pass dispatch — they escalate
  into `adversarial-review` (`/challenge`) carrying their own lens's question, with self-critique as
  the always-available fallback.
- **Template seed** — `templates/INSTINCTS.md` gains an example instinct that dispatches bounded,
  well-specified, no-mid-task-input work to a fresh subagent (gated so interactive work stays inline).

### Next

- **The Learning Loop** (internal spec, kept local)
  — adversarially reviewed 2026-07-01 and re-sequenced (capture-first). Targeted for v0.3.

## [0.1.0] — 2026-06-30 — Initial public release

The first public release of keystone — a repo-agnostic Claude Code kit that travels to every
project. It consolidates process-discipline skills, a domain-language layer, security review
(web / API / LLM-agent), heavy explicit workflows, and harness hooks. MIT-licensed; provenance
for adapted upstream work is recorded in [`ATTRIBUTION.md`](ATTRIBUTION.md).

### What's included

- **Skills (auto-invoked)** — TDD, systematic debugging, writing/executing plans, git worktrees,
  requesting/receiving code review, brainstorming, domain modeling (grill-with-docs, zoom-out,
  improve-codebase-architecture), `security-review` / `api-security` / `llm-security`,
  cost-aware-llm-pipeline, coding-standards, onboard-codebase, git-workflow, simplifying-code,
  auditing-for-overengineering, subagent-driven-development, dispatching-parallel-agents,
  verification-before-completion, finishing-a-development-branch, variant-analysis.
- **Commands** — `/spec`; planning (`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`);
  review & QA (`/review`, `/qa`, `/cso`, `/investigate`, `/simplify`, `/audit`, `/debt`);
  continuity (`/handoff` → `/clear` → `/pickup`, `/pause`); ship (`/ship`, `/retro`);
  backlog (`/to-issues`, `/to-prd`); memory (`/learn`, `/research-notes`);
  safety (`/freeze`, `/careful`, `/guard`, `/unfreeze`).
- **Crew agents** — planner, implementer, QA, code-reviewer, security-reviewer.
- **Harness hooks** — `instincts` (SessionStart rules), `guard` (secret-file / dangerous-command /
  exfil blocks, an always-on SQL guard, opt-in freeze/careful, opt-in Databricks), `scan`
  (prompt-injection tripwire), `notify`, `learnings` (per-repo lessons surfaced at SessionStart).
- **Templates** — INSTINCTS / MEMORY / CONTEXT seeds, ADRs, plans, handoffs, research notes.

### Design

- **Cross-harness** — works on Claude Code and Codex CLI; hooks are Claude-Code enforcement teeth
  with graceful degradation, over a file-based baseline.
- **Security-first** — anchored to OWASP Top 10 (2025), API Security Top 10 (2023), and the
  LLM Top 10 (2025).
- **Workflow defaults** — `/ship` never auto-commits; `/to-issues` files to Linear Backlog;
  `/review` / `/qa` / `/cso` scale Haiku → Sonnet → Opus.
- **Companion tools (not bundled)** — Trail of Bits security skills (CC-BY-SA); pair with a
  design plugin (e.g. impeccable) for UI work.

### Next

- **The Learning Loop** (internal spec, kept local)
  — a compounding spec→plan→execute→learn cycle with relevance-based lesson retrieval. Targeted for v0.2.
