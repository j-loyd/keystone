#!/usr/bin/env node
/**
 * learnings.js — per-repo "lessons learned" memory for Claude Code (keystone)
 *
 * Two modes:
 *   1. SessionStart hook (default): detect the current git repo, load its accumulated
 *      learnings, and inject the most recent N into the session as
 *      hookSpecificOutput.additionalContext — so past lessons for THIS repo auto-apply.
 *      Matcher: startup|resume|clear|compact
 *   2. `--path` CLI: print the learnings file path for the current repo (creating nothing).
 *      Used by the /learn and /retro commands to know where to append.
 *
 * Storage is OUTSIDE the repo (so client/work repos stay clean), keyed by the repo's
 * git remote (fallback: toplevel path):
 *   ~/.claude/keystone/learnings/<repo-slug>.md
 *
 * Tuning via env:
 *   KEYSTONE_LEARNINGS_DIR   override the storage dir
 *   KEYSTONE_LEARNINGS_MAX   max entries injected at SessionStart (default 8)
 *
 * Fail-open, but NOT silent-on-empty: a git repo with no banked lessons emits a one-line
 * visible nudge (📓 … /learn) so "working but empty" is distinguishable from "broken." Outside
 * a git repo, or on any error, it still fails silently -> "{}" (or empty path for --path).
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT =
  process.env.KEYSTONE_LEARNINGS_DIR ||
  path.join(os.homedir(), ".claude", "keystone", "learnings");
const MAX = clampInt(process.env.KEYSTONE_LEARNINGS_MAX, 8, 1, 50);

function clampInt(raw, fallback, lo, hi) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

// Fixed git args only — no shell, no interpolation, so no command-injection surface.
function git(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd: cwd || process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch (_) {
    return "";
  }
}

/** Filesystem-safe slug for a remote URL or path. Exported for tests. */
function slugify(s) {
  return String(s || "")
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/\.git$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Resolve the repo identity + learnings file for a directory, or null if not a repo. */
function repoFile(cwd) {
  const top = git(["rev-parse", "--show-toplevel"], cwd);
  if (!top) return null;
  const remote = git(["remote", "get-url", "origin"], cwd);
  const slug = slugify(remote || top) || path.basename(top);
  return {
    slug,
    top,
    remote,
    name: path.basename(top),
    file: path.join(ROOT, slug + ".md"),
  };
}

/** Pull the most recent `max` `## `-headed entries from a learnings file. Exported for tests. */
function recentEntries(text, max) {
  const entries = String(text || "")
    .split(/^(?=## )/m)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("## "));
  return entries.slice(-max);
}

// Type tags are categories, not domain terms — exclude them so clustering groups by
// SUBJECT (auth, migration, caching), not by "all Lessons together".
const CLUSTER_STOP = new Set([
  "lesson",
  "decision",
  "pattern",
  "surprise",
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "when",
  "then",
  "from",
  "into",
  "needs",
  "need",
  "uses",
  "using",
  "about",
  "matter",
  "matters",
]);

/** Significant domain tokens from an entry's heading (drops date, type tag, stopwords). */
function clusterTokens(entry) {
  const head = String(entry || "")
    .split("\n")[0]
    .toLowerCase();
  return head
    .replace(/\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !CLUSTER_STOP.has(w));
}

/**
 * Group `## `-headed entries that share ≥1 domain token (single-link). Keeps groups of
 * size ≥2; each cluster carries a `key` = the token shared by the most entries. Exported
 * for /retro's Evolve step and for tests. Pure — no I/O.
 */
function clusterEntries(entries) {
  if (!Array.isArray(entries) || entries.length < 2) return [];
  const items = entries.map((e) => ({
    entry: e,
    tokens: new Set(clusterTokens(e)),
  }));
  const clusters = [];
  for (const item of items) {
    let placed = null;
    for (const c of clusters) {
      for (const t of item.tokens) {
        if (c.tokens.has(t)) {
          placed = c;
          break;
        }
      }
      if (placed) break;
    }
    if (placed) {
      placed.entries.push(item.entry);
      for (const t of item.tokens) placed.tokens.add(t);
    } else {
      clusters.push({ entries: [item.entry], tokens: new Set(item.tokens) });
    }
  }
  return clusters
    .filter((c) => c.entries.length >= 2)
    .map((c) => {
      const freq = new Map();
      for (const e of c.entries) {
        for (const t of new Set(clusterTokens(e)))
          freq.set(t, (freq.get(t) || 0) + 1);
      }
      let key = null,
        best = 0;
      for (const [t, n] of freq)
        if (n > best) {
          key = t;
          best = n;
        }
      return { key, entries: c.entries };
    });
}

function buildContext(entries, name) {
  const body = entries.join("\n\n");
  return (
    `📓 Lessons learned in this repo (${name}) — keystone surfaced these from past ` +
    `sessions. Apply what's relevant; capture new ones with /learn:\n\n${body}`
  );
}

/**
 * The MISS nudge: we ARE in a git repo but no lessons are banked for it yet. Emitting this
 * (instead of a bare "{}") makes an empty-but-working memory distinguishable from a broken hook.
 * Exported for tests.
 */
function missContext(name) {
  return (
    `📓 No lessons banked yet for this repo (${name}) — capture one with /learn when you hit ` +
    `a reusable gotcha, decision, or pattern (or run /retro to sweep the session).`
  );
}

function emit(additionalContext) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    }),
  );
}

function runHook() {
  let input = "";
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    try {
      const data = JSON.parse(input || "{}");
      const info = repoFile(data.cwd || process.cwd());
      if (info) {
        // In a git repo: surface banked lessons if any, else a visible /learn nudge.
        const entries = fs.existsSync(info.file)
          ? recentEntries(fs.readFileSync(info.file, "utf8"), MAX)
          : [];
        emit(
          entries.length
            ? buildContext(entries, info.name)
            : missContext(info.name),
        );
        return;
      }
    } catch (_) {
      // fail open (not a repo / unreadable file / bad input) -> silent {}
    }
    process.stdout.write("{}");
  });
}

function main() {
  if (process.argv.includes("--path")) {
    const info = repoFile(process.cwd());
    process.stdout.write(info ? info.file : "");
    return;
  }
  if (process.argv.includes("--cluster")) {
    // JSON-ARRAY mode — fail-open value is "[]" (distinct from runHook's "{}").
    try {
      const info = repoFile(process.cwd());
      if (info && fs.existsSync(info.file)) {
        const entries = recentEntries(fs.readFileSync(info.file, "utf8"), MAX);
        process.stdout.write(JSON.stringify(clusterEntries(entries)));
        return;
      }
    } catch (_) {
      // fail open
    }
    process.stdout.write("[]");
    return;
  }
  runHook();
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    slugify,
    repoFile,
    recentEntries,
    buildContext,
    missContext,
    clusterEntries,
  };
}
