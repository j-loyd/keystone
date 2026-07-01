# Research: <topic>

Researched: YYYY-MM-DD · confidence: <high | medium | low>

## Summary

<2–4 sentences: what was researched and the bottom line.>

## Recommendation

<The actual recommendation, with the one-line "why". If a stack/library was chosen, name it
and the version, and list the credible alternatives you rejected and why.>

## Don't hand-roll

Things that look tempting to build but shouldn't be — use the existing solution.

| Problem              | Use instead   | Why                                    |
| -------------------- | ------------- | -------------------------------------- |
| <e.g. retry/backoff> | <lib/feature> | <battle-tested; edge cases you'd miss> |

## Pitfalls

What bites people doing this. Keep it concrete.

- **<gotcha>** — <what goes wrong + how to avoid it>.
- **<perf trap>** — <the slow path and the fast one>.
- **<looks-done-but-isn't>** — <the case that passes a demo but fails in prod>.

## Sources

- <title> — <url> (accessed YYYY-MM-DD)

> Regenerate/extend with the `/research-notes` command. Treat as point-in-time — re-verify
> versions and security advisories before relying on this much later.
