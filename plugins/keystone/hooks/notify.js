#!/usr/bin/env node
/**
 * notify.js — Notification hook → native macOS banner (click to focus the terminal)
 * Fires when Claude needs your attention (permission prompt, idle, MCP elicitation).
 *
 * Local-only. Runs alongside your existing Tink sound — does not replace it.
 *
 * Click-to-focus: if `terminal-notifier` is installed (`brew install terminal-notifier`),
 * clicking the banner activates the terminal app that owns THIS session — auto-detected
 * per session (Warp when in Warp, VS Code when in VS Code, etc.). If terminal-notifier
 * isn't installed, it falls back to a plain osascript banner (no click action).
 *
 * Wiring (settings.json):
 *   "Notification": [{
 *     "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/notify.js", "timeout": 5 }]
 *   }]
 */

"use strict";

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

// Transparent 1x1 PNG → blank the notification icon (macOS reserves the slot).
const BLANK_ICON = path.join(__dirname, "transparent.png");

// TERM_PROGRAM → app bundle id (fallback when __CFBundleIdentifier is absent).
const TERM_BUNDLE = {
  WarpTerminal: "dev.warp.Warp-Stable",
  vscode: "com.microsoft.VSCode",
  "iTerm.app": "com.googlecode.iterm2",
  Apple_Terminal: "com.apple.Terminal",
  ghostty: "com.mitchellh.ghostty",
  WezTerm: "com.github.wez.wezterm",
  Hyper: "co.zeit.hyper",
  kitty: "net.kovidgoyal.kitty",
};

/** Bundle id of the terminal app hosting this session. Exported for tests. */
function bundleId(env) {
  // __CFBundleIdentifier is the real owning app — covers VS Code Stable/Insiders/OSS, etc.
  if (env.__CFBundleIdentifier) return env.__CFBundleIdentifier;
  return TERM_BUNDLE[env.TERM_PROGRAM] || null;
}

function titleFor(data) {
  const t = (data.notification_type || "").toLowerCase();
  const msg = (data.message || "").toLowerCase();
  if (t.includes("idle") || msg.includes("waiting"))
    return "Claude is waiting for you";
  if (t.includes("elicit") || msg.includes("select") || msg.includes("choose"))
    return "Claude needs your input";
  return "Claude needs your attention";
}

/**
 * Args for terminal-notifier (supports click-to-activate). Exported for tests.
 * `iconPath`, when given, blanks the icon via -appIcon.
 */
function tnArgs(data, env, iconPath) {
  const project = data.cwd ? path.basename(data.cwd) : "Claude Code";
  const body = (data.message || "Action needed").slice(0, 200);
  const args = [
    "-title",
    titleFor(data),
    "-subtitle",
    project,
    "-message",
    body,
    "-group",
    "claude-code",
  ];
  const bid = bundleId(env);
  if (bid) args.push("-activate", bid);
  if (iconPath) args.push("-appIcon", iconPath);
  return args;
}

/** Escape a string for an AppleScript double-quoted literal. */
function asString(s) {
  return (
    '"' +
    String(s == null ? "" : s)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"') +
    '"'
  );
}

/** Fallback osascript (no click action). Exported for tests. */
function osaScript(data) {
  const project = data.cwd ? path.basename(data.cwd) : "Claude Code";
  const body = (data.message || "Action needed").slice(0, 200);
  return (
    "display notification " +
    asString(body) +
    " with title " +
    asString(titleFor(data)) +
    " subtitle " +
    asString(project)
  );
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  try {
    const data = JSON.parse(input || "{}");
    // Prefer terminal-notifier (click → focus app); fall back to osascript banner.
    const icon = fs.existsSync(BLANK_ICON) ? BLANK_ICON : null;
    execFile("terminal-notifier", tnArgs(data, process.env, icon), (err) => {
      if (err) execFile("osascript", ["-e", osaScript(data)], () => {});
    });
  } catch (_) {
    // fail open
  }
  process.stdout.write("{}");
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    bundleId,
    titleFor,
    tnArgs,
    asString,
    osaScript,
    TERM_BUNDLE,
  };
}
