"use strict";
/**
 * patch-paths.js — find the file paths a Codex `apply_patch` patch touches.
 *
 * Used by guard.js (PreToolUse: check every path). Mirrors the header grammar of Codex's
 * own parser (codex-rs/apply-patch: parser.rs + streaming_parser.rs, checked against
 * codex-cli 0.166):
 *
 *   *** Begin Patch
 *   *** Environment ID: <id>        (optional, only directly after Begin Patch)
 *   *** Add File: <path>            then "+" lines
 *   *** Delete File: <path>
 *   *** Update File: <path>         then optional "*** Move to: <path>", then chunks
 *   *** End Patch
 *
 * Fidelity rule: header recognition is identical to Codex's; body-line acceptance is a
 * SUPERSET of Codex's. So whenever Codex accepts a patch, this returns exactly the paths
 * Codex will touch; a patch Codex would reject may parse here (harmless: extra checks).
 * keystone: re-check against codex-rs/apply-patch when Codex changes its patch grammar
 * (upgrade trigger: a Codex release touching parser.rs or streaming_parser.rs).
 */

const BEGIN = "*** Begin Patch";
const END = "*** End Patch";
const ENV_ID = "*** Environment ID:";
const EOF_MARK = "*** End of File";
const HEADERS = [
  ["add", "*** Add File: "],
  ["delete", "*** Delete File: "],
  ["update", "*** Update File: "],
];
const MOVE_TO = "*** Move to: ";

// Rust's char::is_whitespace (Unicode White_Space). JS trim() differs: it misses U+0085
// (which Rust trims, so `.env\u0085` would hide a secret path) and strips U+FEFF (which
// Rust keeps, so a BOM-prefixed header would be seen here but rejected by Codex).
// A char-code scan, not a regex: `[ws]+$` is quadratic on a long whitespace run followed by
// anything else, and a hook timeout lets Codex apply the patch unchecked. All of these are
// single UTF-16 code units, so scanning code units is exact.
const WS = new Set([
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680,
  ...Array.from({ length: 0x200a - 0x2000 + 1 }, (_, i) => 0x2000 + i),
  0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
]);
function trimEnd(s) {
  let end = s.length;
  while (end > 0 && WS.has(s.charCodeAt(end - 1))) end--;
  return end === s.length ? s : s.slice(0, end);
}
function trim(s) {
  let start = 0;
  const t = trimEnd(s);
  while (start < t.length && WS.has(t.charCodeAt(start))) start++;
  return start === 0 ? t : t.slice(start);
}

/** Rust str::lines(): split on \n, drop one trailing \r per line, no final empty line. */
function rustLines(s) {
  if (s === "") return [];
  const lines = s.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
}

/** Codex's boundary check, including the lenient `<<'EOF' … EOF` unwrap for freeform input. */
function patchLines(text) {
  const lines = rustLines(trim(text));
  const strict = (ls) => ls.length > 0 && trim(ls[0]) === BEGIN && trim(ls[ls.length - 1]) === END;
  if (strict(lines)) return lines;
  const first = lines[0];
  if (
    lines.length >= 4 &&
    (first === "<<EOF" || first === "<<'EOF'" || first === '<<"EOF"') &&
    lines[lines.length - 1].endsWith("EOF")
  ) {
    const inner = lines.slice(1, -1);
    if (strict(inner)) return inner;
  }
  return null;
}

function header(s) {
  for (const [kind, marker] of HEADERS) if (s.startsWith(marker)) return { kind, path: s.slice(marker.length) };
  return null;
}

/**
 * Parse a patch. Returns { ok: true, hunks: [{ kind, path, movePath }], environmentId }
 * or { ok: false, error }. Never throws.
 */
function parsePatch(text) {
  if (typeof text !== "string") return { ok: false, error: "patch is not a string" };
  const outer = patchLines(text);
  if (!outer) return { ok: false, error: "no *** Begin Patch / *** End Patch envelope" };
  // Codex re-joins with \n and streams it, stripping one more trailing \r per line.
  const lines = outer.map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
  const hunks = [];
  let environmentId = null;
  let mode = "start"; // start | started | add | delete | update | ended
  let chunks = 0; // chunks seen in the current update hunk (Move to is only valid at 0)
  const fail = (i, why) => ({ ok: false, error: `line ${i + 1}: ${why}` });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const last = i === lines.length - 1;
    // Codex's finish(): the final line is matched with a full trim in every mode.
    if (last && mode !== "start" && trim(line) === END) {
      mode = "ended";
      continue;
    }
    if (mode === "start") {
      if (trim(line) !== BEGIN) return fail(i, "expected *** Begin Patch");
      mode = "started";
      continue;
    }
    if (mode === "ended") {
      if (trim(line) !== "") return fail(i, "text after *** End Patch");
      continue;
    }
    // Inside an update hunk Codex matches headers on trim_end only (an indented header is
    // a context line); everywhere else on a full trim.
    const key = mode === "update" ? trimEnd(line) : trim(line);
    if (mode === "started" && key.startsWith(ENV_ID)) {
      const id = trim(key.slice(ENV_ID.length));
      if (environmentId !== null || id === "") return fail(i, "invalid *** Environment ID");
      environmentId = id;
      continue;
    }
    if (key === END) {
      mode = "ended";
      continue;
    }
    const h = header(key);
    if (h) {
      hunks.push({ kind: h.kind, path: h.path, movePath: null });
      mode = h.kind;
      chunks = 0;
      continue;
    }
    if (mode === "add" && line.startsWith("+")) continue;
    if (mode === "update") {
      const hunk = hunks[hunks.length - 1];
      if (chunks === 0 && hunk.movePath === null && key.startsWith(MOVE_TO)) {
        hunk.movePath = key.slice(MOVE_TO.length);
        continue;
      }
      // Codex accepts a bare End of File marker before any chunk without opening one.
      if (key === EOF_MARK) continue;
      if (key === "" || key.startsWith("@@") || /^[ +-]/.test(line)) {
        chunks++;
        continue;
      }
    }
    return fail(i, `unexpected line in ${mode === "started" ? "patch" : `${mode} hunk`}`);
  }
  if (mode !== "ended") return { ok: false, error: "missing *** End Patch" };
  return { ok: true, hunks, environmentId };
}

/**
 * Every header-looking line anywhere in `text`, without the state machine. Used for the
 * shell heredoc form (`apply_patch <<'EOF' …` run through exec_command), where the patch
 * is embedded in a larger command. A superset of what Codex parses out of the heredoc.
 */
function headerLines(text) {
  const out = [];
  for (const line of rustLines(String(text))) {
    const t = trim(line);
    const h = header(t);
    if (h) out.push({ kind: h.kind, path: h.path });
    else if (t.startsWith(MOVE_TO)) out.push({ kind: "move", path: t.slice(MOVE_TO.length) });
  }
  return out;
}

module.exports = { parsePatch, headerLines, trim, trimEnd };
