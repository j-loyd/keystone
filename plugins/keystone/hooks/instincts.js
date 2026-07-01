#!/usr/bin/env node
/**
 * instincts.js — SessionStart "auto-apply" hook for Claude Code
 * Matcher: startup|resume|clear|compact
 *
 * Reads ~/.claude/INSTINCTS.md (atomic trigger->action rules with a confidence
 * score), keeps the high-confidence ones, ranks them, and injects the top N into
 * the session as hookSpecificOutput.additionalContext so they ACTIVELY apply —
 * unlike MEMORY.md, which only loads as passive reference.
 *
 * INSTINCTS.md block format:
 *   ## [85%] when <trigger>
 *   <one imperative action line or two>
 *
 * Tuning via env:
 *   INSTINCTS_MIN_CONFIDENCE  threshold 0-100 (default 70)
 *   INSTINCTS_MAX             max rules injected (default 8)
 *   INSTINCTS_FILE            override path to the instincts file
 *
 * Fails open and silent: missing file, parse error, or zero matches -> "{}".
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const FILE =
  process.env.INSTINCTS_FILE ||
  path.join(os.homedir(), ".claude", "INSTINCTS.md");
const MIN_CONFIDENCE = clampInt(
  process.env.INSTINCTS_MIN_CONFIDENCE,
  70,
  0,
  100,
);
const MAX_RULES = clampInt(process.env.INSTINCTS_MAX, 8, 1, 50);

function clampInt(raw, fallback, lo, hi) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Parse instinct blocks. A block starts at a heading line:
 *   ## [<num>%] <trigger>
 * and its action is the following non-empty, non-heading lines (joined).
 * Returns [{confidence, trigger, action}]. Exported for tests.
 */
function parse(text) {
  const lines = String(text || "").split(/\r?\n/);
  const heading = /^##\s*\[(\d{1,3})%\]\s*(.+?)\s*$/;
  const out = [];
  let current = null;
  const flush = () => {
    if (current) {
      current.action = current.actionLines
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (current.action) out.push(current);
    }
    current = null;
  };
  for (const line of lines) {
    const m = line.match(heading);
    if (m) {
      flush();
      current = {
        confidence: Math.min(100, Math.max(0, parseInt(m[1], 10))),
        trigger: m[2].trim(),
        actionLines: [],
      };
    } else if (current) {
      // Stop the action at the next heading of any level or a horizontal rule.
      if (/^#{1,6}\s/.test(line) || /^-{3,}\s*$/.test(line)) {
        flush();
      } else if (line.trim()) {
        current.actionLines.push(line.trim());
      }
    }
  }
  flush();
  return out;
}

/** Select, rank, and cap the instincts to inject. Exported for tests. */
function select(instincts) {
  return instincts
    .filter((i) => i.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_RULES);
}

function buildContext(ranked) {
  const bullets = ranked
    .map((i) => `- [${i.confidence}%] ${i.trigger} → ${i.action}`)
    .join("\n");
  return (
    `⚡ Active rules this session (from INSTINCTS.md — apply these proactively, ` +
    `they are confirmed preferences, not suggestions):\n${bullets}`
  );
}

function main() {
  try {
    const text = fs.readFileSync(FILE, "utf8");
    const ranked = select(parse(text));
    if (ranked.length) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: buildContext(ranked),
          },
        }),
      );
      return;
    }
  } catch (_) {
    // fail open
  }
  process.stdout.write("{}");
}

if (require.main === module) {
  main();
} else {
  module.exports = { parse, select, buildContext };
}
