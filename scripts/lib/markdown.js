"use strict";
/**
 * markdown.js — the small parsing primitives the keystone catalog validators share.
 *
 * Two deliberate properties, both learned from real incidents:
 *
 * 1. walkMarkdown() recurses the filesystem with fs.readdirSync and NEVER consults
 *    .gitignore. A reference census run through this shell's `grep` once reported
 *    clean because `evals/` is gitignored; the dead references it missed only
 *    surfaced when the eval harness failed. A validator that inherits that
 *    blindness is worse than no validator, because it certifies the gap.
 *
 * 2. The strippers preserve byte offsets and line counts, so a finding can always
 *    be reported at its real line number in the original file.
 *
 * Node stdlib only — no runtime dependencies, matching evals/lib/ranker.js.
 */

const fs = require("node:fs");
const path = require("node:path");

/** Replace every character of `text` except newlines, so offsets and lines survive. */
function blank(text) {
  return text.replace(/[^\n]/g, " ");
}

/**
 * Remove fenced code blocks (``` and ~~~), replacing them with equivalent
 * whitespace. An unterminated fence swallows the rest of the file, which is the
 * conservative choice: better to miss a link than to report one that a reader
 * would see as sample code.
 */
function stripFencedCode(text) {
  const source = String(text);
  const lines = source.split("\n");
  const out = [];
  let fence = null;
  for (const line of lines) {
    const open = line.match(/^[ \t]*(`{3,}|~{3,})/);
    if (fence === null && open) {
      fence = open[1][0].repeat(3);
      out.push(blank(line));
      continue;
    }
    if (fence !== null) {
      out.push(blank(line));
      if (open && open[1][0] === fence[0]) fence = null;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Blank out inline code spans. Link syntax inside backticks is a literal, not a link. */
function stripInlineCode(text) {
  return String(text).replace(/`[^`\n]*`/g, blank);
}

/** 1-based line number of a byte offset. */
function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

/**
 * Every markdown inline link in `text`, as { target, index, line }.
 * Fenced blocks and inline code are stripped first, so example paths written for
 * the reader are not mistaken for real references. Reference-style definitions
 * and autolinks are out of scope.
 */
function findMarkdownLinks(text) {
  const source = String(text);
  const scannable = stripInlineCode(stripFencedCode(source));
  const links = [];
  const pattern = /\]\(\s*<?([^)>\s]+)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  let match;
  while ((match = pattern.exec(scannable)) !== null) {
    links.push({ target: match[1], index: match.index, line: lineOf(source, match.index) });
  }
  return links;
}

function unquote(value) {
  const match = value.match(/^(["'])([\s\S]*)\1$/);
  return match ? match[2] : value;
}

/**
 * Parse the leading YAML frontmatter block into { keys, values }.
 *
 * `keys` is every top-level key in source order — including keys whose value is a
 * list or is empty — because the rule "frontmatter carries name and description
 * only" is about the keys present, not about the ones we could read a string from.
 * `values` holds the flattened string value for each scalar key.
 *
 * Returns null when the file has no frontmatter block at position 0.
 */
function parseFrontmatter(source) {
  const match = String(source).match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  const keys = [];
  const values = {};
  for (let i = 0; i < lines.length; i++) {
    const keyMatch = lines[i].match(/^([A-Za-z_][\w-]*):[ \t]*(.*)$/);
    if (!keyMatch) continue;
    const key = keyMatch[1];
    const inline = keyMatch[2].trim();
    const isBlockScalar = /^[|>][-+]?\d*$/.test(inline);
    const parts = inline === "" || isBlockScalar ? [] : [inline];
    // Fold indented continuation lines (and list items) into one value.
    while (i + 1 < lines.length && /^[ \t]+\S/.test(lines[i + 1])) {
      parts.push(lines[++i].trim());
    }
    if (!keys.includes(key)) keys.push(key);
    values[key] = unquote(parts.join(" ").replace(/\s+/g, " ").trim());
  }
  return { keys, values };
}

/**
 * Every *.md file under `dir`, recursively, sorted. Direct filesystem recursion —
 * see the header note on .gitignore. Symlinked directories are skipped, since
 * Dirent.isDirectory() is false for them, which also makes cycles impossible.
 */
function walkMarkdown(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, out);
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

module.exports = {
  blank,
  findMarkdownLinks,
  lineOf,
  parseFrontmatter,
  stripFencedCode,
  stripInlineCode,
  walkMarkdown,
};
