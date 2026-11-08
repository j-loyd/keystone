#!/usr/bin/env node
/**
 * guard-state.js — read/write keystone's opt-in guard state file, JSON-safely.
 *
 * Backs the user-only /guard skill (freeze, careful, on, off, status). The state file is the one
 * guard.js reads (GUARD_STATE_FILE: $KEYSTONE_GUARD_FILE, else ~/.claude/keystone-guard.json),
 * shape { freeze: <abs dir> | null, careful: <bool> }. Writes go through JSON.stringify and
 * an atomic temp-file rename. (The commands used to build JSON with printf, so a directory
 * containing `"` or `\` produced invalid JSON, guard.js's readState() failed open, and the
 * freeze silently stopped applying.)
 *
 * /guard maps its modes onto these verbs: on → guard, off → unfreeze, the rest 1:1.
 *
 *   guard-state.js freeze [dir]     fence edits to dir (default: cwd); keeps careful as-is
 *   guard-state.js guard [dir]      freeze + careful on
 *   guard-state.js careful on|off   toggle careful mode; keeps any freeze boundary
 *   guard-state.js unfreeze         remove the state file (lifts freeze AND careful)
 *   guard-state.js status           print the current state
 *
 * Arity is strict on purpose: guard.js lets only the exact protection-ADDING forms run
 * without a confirmation prompt, so the CLI must never reinterpret extra arguments.
 * There is deliberately no option to point at a different state file; tests use the env var.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { GUARD_STATE_FILE, stateShapeError } = require("./guard.js");

const USAGE = `Usage: guard-state.js <command>

  freeze [dir]     fence Edit/Write to dir (default: current directory)
  guard [dir]      freeze + careful mode on
  careful on|off   turn careful mode on or off (keeps any freeze boundary)
  unfreeze         lift all guardrails (removes the state file)
  status           show the current guard state`;

class UsageError extends Error {}

/** Returns { state, error } — error is set when the file exists but is not valid state. */
function load(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return { state: null, error: null };
    return { state: null, error: e.message };
  }
  let s;
  try {
    s = JSON.parse(text);
  } catch (e) {
    return { state: null, error: `invalid JSON (${e.message})` };
  }
  // Same validity rule guard.js uses — a file guard.js treats as corrupt is corrupt here too.
  const shape = stateShapeError(s);
  if (shape) return { state: null, error: shape };
  return { state: { freeze: s.freeze || null, careful: s.careful === true }, error: null };
}

function save(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {
      // nothing to clean up
    }
    throw e;
  }
}

/**
 * The working directory as the shell sees it. Prefer $PWD (the logical path — matches the
 * old `cd && pwd` and the paths the harness passes to Edit/Write, e.g. /tmp vs /private/tmp
 * on macOS) but only when it really is the current directory; otherwise process.cwd().
 */
function shellCwd() {
  const real = process.cwd();
  const pwd = process.env.PWD;
  try {
    if (pwd && path.isAbsolute(pwd) && fs.realpathSync(pwd) === fs.realpathSync(real)) {
      return path.resolve(pwd);
    }
  } catch (_) {
    // stale PWD — fall through
  }
  return real;
}

function resolveDir(arg) {
  const abs = path.resolve(shellCwd(), arg || ".");
  let st;
  try {
    st = fs.statSync(abs);
  } catch (_) {
    st = null;
  }
  if (!st || !st.isDirectory()) {
    const err = new Error(`No such directory: ${arg || abs}`);
    err.exitCode = 1;
    throw err;
  }
  return abs;
}

function warnIfCorrupt(error, file) {
  if (error) process.stderr.write(`warning: replacing unreadable guard state at ${file}: ${error}\n`);
}

function main(argv, file = GUARD_STATE_FILE) {
  const [cmd, ...rest] = argv;
  const arity = (min, max) => {
    if (rest.length < min || rest.length > max) throw new UsageError();
  };

  switch (cmd) {
    case "freeze":
    case "guard": {
      arity(0, 1);
      const dir = resolveDir(rest[0]);
      const { state, error } = load(file);
      warnIfCorrupt(error, file);
      const careful = cmd === "guard" ? true : !!(state && state.careful);
      save(file, { freeze: dir, careful });
      if (cmd === "guard") {
        console.log(`🛡️  Guard mode ON — edits fenced to ${dir}, careful mode on. Run /guard off to lift.`);
      } else {
        console.log(`🧊 Frozen. Edits restricted to: ${dir}`);
        console.log(`   (careful mode: ${careful ? "on" : "off"}). Run /guard off to lift.`);
      }
      return 0;
    }
    case "careful": {
      arity(1, 1);
      const mode = rest[0];
      if (mode !== "on" && mode !== "off") throw new UsageError();
      const { state, error } = load(file);
      warnIfCorrupt(error, file);
      const freeze = state ? state.freeze : null;
      save(file, { freeze, careful: mode === "on" });
      console.log(
        `${mode === "on" ? "⚠️  Careful mode ON" : "Careful mode OFF"} (freeze boundary: ${freeze || "none"}).`,
      );
      return 0;
    }
    case "unfreeze": {
      arity(0, 0);
      if (!fs.existsSync(file)) {
        console.log("Nothing to lift — no active freeze/careful state.");
        return 0;
      }
      fs.unlinkSync(file);
      console.log("🔓 Unfrozen — keystone guardrails lifted (baseline guard still active).");
      return 0;
    }
    case "status": {
      arity(0, 0);
      const { state, error } = load(file);
      if (error) {
        console.log(`Guard state file is unreadable (${error}) — guard.js fails closed (careful on, every edit asks) until you run /guard freeze, /guard on, or /guard off to rewrite it.`);
      } else if (!state) {
        console.log("No active freeze/careful state (baseline guard only).");
      } else {
        console.log(`freeze: ${state.freeze || "none"}`);
        console.log(`careful: ${state.careful ? "on" : "off"}`);
      }
      return 0;
    }
    default:
      throw new UsageError();
  }
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    if (e instanceof UsageError) {
      process.stderr.write(`${USAGE}\n`);
      process.exitCode = 2;
    } else {
      process.stderr.write(`${e.message}\n`);
      process.exitCode = e.exitCode || 1;
    }
  }
} else {
  module.exports = { main, load, save, shellCwd, USAGE };
}
