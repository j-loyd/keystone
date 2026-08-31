"use strict";
/**
 * version-check.js — keystone carries its release version in three files that must
 * always move together.
 *
 * Why this is worth a script: the harness's plugin-update check reads the
 * *manifests*, not VERSION. Bumping only VERSION makes the update check report
 * "already at latest" against a stale number — which is exactly how VERSION once
 * reached 0.27 while the manifests sat at 0.18. CLAUDE.md documents the three
 * paths and asks for a manual grep; this replaces the manual step.
 *
 * Node stdlib only.
 */

const fs = require("node:fs");
const path = require("node:path");

// Semver core plus an optional prerelease/build suffix. Deliberately strict about
// the three numeric components: "v1.2" and "1.2" are the shapes that drift.
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * The three release-critical locations, in the order CLAUDE.md lists them.
 * `read` receives the parsed file and returns { value } or { error }.
 */
const VERSION_SOURCES = [
  {
    label: "VERSION",
    path: "VERSION",
    kind: "text",
    read: (text) => ({ value: text.trim() }),
  },
  {
    label: "plugin.json version",
    path: "plugins/keystone/.claude-plugin/plugin.json",
    kind: "json",
    read: (json) =>
      typeof json.version === "string"
        ? { value: json.version }
        : { error: 'no string "version" field' },
  },
  {
    label: "marketplace.json metadata.version",
    path: ".claude-plugin/marketplace.json",
    kind: "json",
    read: (json) =>
      json.metadata && typeof json.metadata.version === "string"
        ? { value: json.metadata.version }
        : { error: 'no string "metadata.version" field' },
  },
];

function readSource(root, source) {
  const full = path.join(root, source.path);
  const entry = { label: source.label, path: source.path, full, value: null, error: null };
  let raw;
  try {
    raw = fs.readFileSync(full, "utf8");
  } catch {
    entry.error = "file not found";
    return entry;
  }
  if (source.kind === "text") {
    Object.assign(entry, source.read(raw));
    return entry;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    entry.error = `invalid JSON — ${e.message}`;
    return entry;
  }
  Object.assign(entry, source.read(parsed));
  return entry;
}

/**
 * A per-plugin `version` is not part of the marketplace schema keystone uses today.
 * If one is ever added it becomes a fourth place that can drift, so it is picked up
 * opportunistically rather than being ignored until it bites.
 */
function readOptionalPluginEntryVersions(root) {
  const rel = ".claude-plugin/marketplace.json";
  const entries = [];
  let json;
  try {
    json = JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
  } catch {
    return entries; // the required check above already reports this file's problems
  }
  if (!Array.isArray(json.plugins)) return entries;
  json.plugins.forEach((plugin, i) => {
    if (typeof plugin.version !== "string") return;
    entries.push({
      label: `marketplace.json plugins[${i}].version`,
      path: rel,
      full: path.join(root, rel),
      value: plugin.version,
      error: null,
    });
  });
  return entries;
}

/** Every version-bearing location found under `root`, readable or not. */
function readVersionSources(root) {
  return [
    ...VERSION_SOURCES.map((source) => readSource(root, source)),
    ...readOptionalPluginEntryVersions(root),
  ];
}

/**
 * Compare every location against VERSION (or, if VERSION is unreadable, against the
 * first readable location). Returns { ok, version, entries, problems } — problems
 * is a list of human-readable strings, each naming a path and its value.
 */
function checkVersions(root) {
  const entries = readVersionSources(root);
  const problems = [];

  for (const entry of entries) {
    if (entry.error) problems.push(`${entry.path} (${entry.label}): ${entry.error}`);
    else if (!SEMVER.test(entry.value)) {
      problems.push(
        `${entry.path} (${entry.label}): "${entry.value}" is not semver x.y.z`,
      );
    }
  }

  const usable = entries.filter((e) => !e.error && SEMVER.test(e.value));
  const reference = usable[0] || null;
  const version = reference ? reference.value : null;

  for (const entry of usable) {
    if (entry.value !== version) {
      problems.push(
        `${entry.path} (${entry.label}): "${entry.value}" ` +
          `does not match ${reference.path} "${version}"`,
      );
    }
  }

  return { ok: problems.length === 0, version, entries, problems };
}

module.exports = { SEMVER, VERSION_SOURCES, checkVersions, readVersionSources };
