---
name: context-budget
description: Audit the always-on context footprint — MCP tool schemas, agent descriptions, CLAUDE.md/settings, and oversized skills — and flag what to trim or lazy-load. Use when context feels bloated or before adding new MCP servers, agents, or skills.
argument-hint: "[scope: a .claude dir or project path; defaults to the current project + ~/.claude]"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Context Budget — what you pay before any work starts

Audit the **always-loaded** context footprint of **$ARGUMENTS** (defaults to the current
project + `~/.claude`). "Always-loaded" is the static cost paid on _every_ turn, before a
single tool runs: the system prompt + CLAUDE.md (global `~/.claude/CLAUDE.md` plus the
project's) + every connected MCP server's tool schemas + every registered agent's
`description` + every eagerly-loaded skill/command `description` and hook text. That is the
budget this command measures — and where it points you to trim.

> These are **estimates, not exact token counts.** There's no live tokenizer in prose, so use
> the rough rule **chars ÷ 4 ≈ tokens** — directional, good enough to find bloat and to
> compare before/after a change. Don't quote these as accounting.

## Measure each bucket

Run each block from the scope you're auditing (the project root, or a `.claude` dir). Each
prints an estimate in tokens.

**CLAUDE.md / settings** — the instruction files injected every turn:

```bash
for f in ~/.claude/CLAUDE.md ./CLAUDE.md ./.claude/CLAUDE.md ~/.claude/settings.json ./.claude/settings.json; do
  [ -f "$f" ] && echo "$f: $(($(wc -c < "$f")/4)) est tokens"
done
```

**MCP tool schemas (usually the biggest lever)** — every tool of every _connected_ server
loads its full JSON schema always. Count servers and tools across the config files, then
estimate **~400–600 tokens per tool schema**:

```bash
for cfg in ~/.claude.json ./.mcp.json ./.claude/settings.json; do
  [ -f "$cfg" ] || continue
  servers=$(grep -o '"mcpServers"' "$cfg" | wc -l | tr -d ' ')
  echo "$cfg: mcpServers block present? $servers"
done
# Enumerate configured server names (one server can add dozens of tools):
for cfg in ~/.claude.json ./.mcp.json; do
  [ -f "$cfg" ] && echo "--- $cfg ---" && \
    grep -A60 '"mcpServers"' "$cfg" | grep -oE '"[a-zA-Z0-9_-]+":\s*\{' | sed 's/[:{].*//'
done
```

A configured server doesn't reveal its tool count until connected — count tools from the live
session's tool list and multiply. A single server can add **dozens** of tools; the highest-yield
trim by far is disconnecting a server you aren't using this session, because its _entire_
toolset comes along.

**Agent descriptions** — each agent's `description:` frontmatter sits in the dispatch menu and
loads always. Count agents and flag long descriptions:

```bash
for d in ./.claude/agents ~/.claude/agents ./plugins/*/agents; do
  [ -d "$d" ] || continue
  find "$d" -name '*.md' 2>/dev/null | while read -r a; do
    desc=$(grep -m1 '^description:' "$a" | cut -d: -f2-)
    echo "$(printf '%s' "$desc" | wc -c | tr -d ' ') chars  $a"
  done
done | sort -rn
```

Anything over ~300 chars (~75 tokens) is a candidate to tighten — the description only has to
help the orchestrator _pick_ the agent, not explain it.

**Skill / command descriptions** — every skill and command `description:` is always in the
menu too. Flag the oversized ones:

```bash
for d in ./plugins/*/skills ~/.claude/skills ./plugins/*/commands ~/.claude/commands; do
  [ -d "$d" ] || continue
  find "$d" \( -name 'SKILL.md' -o -name '*.md' \) 2>/dev/null | while read -r s; do
    desc=$(grep -m1 '^description:' "$s" | cut -d: -f2-)
    [ -n "$desc" ] && echo "$(printf '%s' "$desc" | wc -c | tr -d ' ') chars  $s"
  done
done | sort -rn | head -20
```

**Oversized skills** — a skill body costs more when eagerly loaded. Keystone's own rule is a
~500-line `SKILL.md` budget; flag any over it:

```bash
find . -name SKILL.md 2>/dev/null | while read -r s; do
  lines=$(wc -l < "$s")
  [ "$lines" -gt 500 ] && echo "OVER BUDGET ($lines lines): $s"
done
```

## Report

Produce a footprint table, sorted by estimated cost (biggest first):

| Bucket                       | Est tokens | ~% of 200k window | Flagged offenders     |
| ---------------------------- | ---------: | ----------------: | --------------------- |
| MCP tool schemas             |          … |                 … | servers/tools to drop |
| CLAUDE.md (global + project) |          … |                 … | —                     |
| Agent descriptions           |          … |                 … | the long ones         |
| Skill / command descriptions |          … |                 … | the long ones         |
| Oversized skill bodies       |          … |                 … | files over 500 lines  |
| settings / hooks             |          … |                 … | —                     |

`% of window = est tokens ÷ 200000`. Under each row, name the specific offenders the bash
blocks surfaced. The point is the ranking, not the decimals.

## Recommendations

Highest-yield first:

1. **Disconnect unused MCP servers.** Each connected server loads its _whole_ toolset every
   turn — this is almost always the largest single lever. If you're not using a server this
   session, drop it; reconnect on demand.
2. **Tighten long agent / skill / command descriptions.** A description exists to let the
   orchestrator _choose_ — one lean sentence with a clear trigger. Trim anything padded.
   (Keystone keeps descriptions lean as a convention; treat that as the instance, not a law.)
3. **Split or trim oversized skills.** Bring any `SKILL.md` back under the ~500-line budget;
   push reference detail into linked files the skill loads only when needed.
4. **Move rarely-used skills behind on-demand triggers** instead of eager load, so their body
   isn't paid for on turns that don't use them.

## Honest limits

These are estimates. The real footprint depends on the harness and on what's actually
connected _this session_ — configured-but-disconnected MCP servers cost nothing, and the
exact per-tool schema size varies. Use this command to find bloat and to compare before/after
a change, not for exact token accounting.
