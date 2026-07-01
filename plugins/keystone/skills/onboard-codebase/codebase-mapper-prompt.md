# Codebase Mapper Prompt Template

Use this template when dispatching codebase mapper subagents (one per map doc) from the
`onboard-codebase` brownfield track. Dispatch them in parallel per the
`dispatching-parallel-agents` skill — they share no state and each writes its own file.

**Purpose:** Produce one focused, fact-based map doc in `docs/codebase/`, citing real paths.

Fill in `[DOC_NAME]`, `[WHAT_THIS_DOC_CAPTURES]` (from `codebase-map-format.md`), and
`[PATH_SCOPE]` (the whole repo, or a subdirectory if the user scoped it).

Dispatch each mapper with whatever subagent-dispatch primitive your harness provides (e.g.
Claude Code's Task tool with a `general-purpose` agent, or the equivalent runner on another
harness). If the harness has no subagent dispatch, run the mappers sequentially in clean passes.

```
Mapper subagent:
  description: "Map [DOC_NAME]"
  prompt: |
    You are mapping one aspect of an existing codebase into a durable reference doc. Write
    facts about the code AS IT IS — not opinions, not a plan, not domain vocabulary.

    ## Your doc

    Write `docs/codebase/[DOC_NAME]` covering: [WHAT_THIS_DOC_CAPTURES]

    Scope to: [PATH_SCOPE]

    ## How to explore

    - If a `graphify-out/` index exists (from a code-graph tool, if you use one), query it
      first for the structure relevant to your doc (entry points, callers, module dependencies).
    - Otherwise explore directly with Read / Grep / Glob. Read enough real code to be
      accurate — do not infer from filenames alone.

    ## Rules (non-negotiable)

    - Every claim cites a real, backticked path: `src/...`. A claim with no path is a guess —
      cut it or go verify it.
    - Observed, not aspirational. Describe what the code does, including inconsistencies and
      ugly parts. If two patterns coexist, say so.
    - Verify behavioral claims before stating them — especially anything with a severity
      (CONCERNS) or a "this is broad/broken/triggers X" assertion. Run the regex, run the
      command, read the test, trace the call. A claim you reasoned about from reading but
      didn't check is a guess: either verify it or label it "unverified — needs checking." Do
      not assign a high severity to something you have not reproduced.
    - Tight and skimmable: bullets and short tables over prose. Link the deepest 2–3 files
      rather than transcribing them.
    - NEVER copy a secret (key, token, connection string, .env value) into the doc. Name the
      variable, not its value.
    - Use the headings prescribed for your doc in `codebase-map-format.md` so refreshes diff
      cleanly.

    ## Return

    Write the file directly. Reply with ONLY: the file path and its line count. Do not paste
    the contents back.
```

The orchestrator collects the confirmations, then writes `INDEX.md` and runs the secret-scan
gate (see `SKILL.md`).
