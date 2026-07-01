---
name: qa
description: Systematically QA a running web app in a real browser — execute test scenarios, find bugs, and (optionally) fix them. Drives the Chrome MCP tools.
argument-hint: "[URL to test + what to exercise]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - mcp__chrome-devtools__navigate_page
  - mcp__chrome-devtools__take_snapshot
  - mcp__chrome-devtools__take_screenshot
  - mcp__chrome-devtools__click
  - mcp__chrome-devtools__fill
  - mcp__chrome-devtools__fill_form
  - mcp__chrome-devtools__list_console_messages
  - mcp__chrome-devtools__list_network_requests
  - mcp__chrome-devtools__wait_for
  - mcp__claude-in-chrome__navigate
  - mcp__claude-in-chrome__get_page_text
  - mcp__claude-in-chrome__read_console_messages
---

# QA — exercise it like a user, find what breaks

QA the app at **$ARGUMENTS** using a real browser via the Chrome MCP tools
(`chrome-devtools` preferred for headless automation; `claude-in-chrome` when driving the
user's live Chrome). **No external browse daemon** — use the MCP tools directly.

## Process

1. **Plan scenarios.** From the target, derive the key user flows to exercise: happy
   path, the obvious error paths, empty/loading states, and boundary inputs. List them
   before you start clicking.
2. **Drive the browser.** Navigate, snapshot the page to get element refs, then
   interact (click/fill/submit). After each meaningful step, check:
   - **Console** (`list_console_messages` / `read_console_messages`) for errors/warnings.
   - **Network** (`list_network_requests`) for failed or surprising requests.
   - **Visual** — screenshot when something looks off.
3. **Log bugs** as you find them: what you did → what happened → what should happen →
   evidence (console line / screenshot / failing request). **Severity each one** (table
   below) — a bug report without a severity isn't triaged, it's just noise.
4. **Fix (only if asked to).** This command defaults to **report-only**. If the user
   asked you to fix, default to fixing **critical + high** only (mark medium/low
   "deferred") unless the user asks for **exhaustive** (fix everything) or **quick**
   (critical only). Apply minimal targeted fixes, then re-run the failing scenario to
   confirm. Follow the no-auto-commit rule — stage at most, never commit.
5. **Reconcile against acceptance criteria.** If the user supplied (or the repo holds) a plan
   with ACs, emit one row per AC — `exercised via scenario N` or `[UNCOVERED] — gap`. An
   uncovered AC is a reportable gap even when nothing crashed. If no ACs are available, say so
   plainly — don't fabricate a checklist.

## Severity

| Severity     | Definition                                                |
| ------------ | --------------------------------------------------------- |
| **critical** | Blocks a core workflow, loses data, or crashes the app    |
| **high**     | A major feature is broken or unusable, with no workaround |
| **medium**   | Works, but with a noticeable problem; a workaround exists |
| **low**      | Cosmetic/polish only                                      |

## Gate

End every run with a graded verdict, not just a bug list — this is what you (or the
orchestrator) act on next, e.g. whether to hand off to `/ship`:

- **PASS** — no critical/high findings, and every AC is covered.
- **CONCERNS** — only medium/low findings, or an AC that's covered but fragile;
  shippable with the list acknowledged.
- **FAIL** — any critical/high finding, or an `[UNCOVERED]` high-risk AC from step 5.
- **WAIVED** — critical/high findings exist but are explicitly accepted (say by whom).

Report the counts by severity (`N critical, N high, N medium, N low`) alongside the
verdict — a number is checkable, "seems fine" isn't.

## Notes

- Do **not** trigger native JS `alert`/`confirm`/`prompt` dialogs — they freeze the
  automation channel. Prefer reading `console.log` output instead.
- Keep runs bounded: test the planned scenarios, report, and stop — don't wander the app.
