# Interface Design

When the user wants to explore alternative interfaces for a chosen deepening candidate, use this parallel sub-agent pattern. Based on "Design It Twice" (Ousterhout) — your first idea is unlikely to be the best.

Uses the vocabulary in [LANGUAGE.md](LANGUAGE.md) — **module**, **interface**, **seam**, **adapter**, **leverage**.

## Process

### 1. Frame the problem space

Before spawning sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would rely on, and which category they fall into (see [DEEPENING.md](DEEPENING.md))
- A rough illustrative code sketch to ground the constraints — not a proposal, just a way to make the constraints concrete

Show this to the user, then immediately proceed to Step 2. The user reads and thinks while the sub-agents work in parallel.

### 2. Spawn sub-agents

Spawn 3+ sub-agents in parallel using the Agent tool. Each must produce a **radically different** interface for the deepened module.

Prompt each sub-agent with a separate technical brief (file paths, coupling details, dependency category from [DEEPENING.md](DEEPENING.md), what sits behind the seam). The brief is independent of the user-facing problem-space explanation in Step 1. Give each agent a different design constraint:

- Agent 1: "Minimize the interface — aim for 1–3 entry points max. Maximise leverage per entry point."
- Agent 2: "Maximise flexibility — support many use cases and extension."
- Agent 3: "Optimise for the most common caller — make the default case trivial."
- Agent 4 (if applicable): "Design around ports & adapters for cross-seam dependencies."

Include both [LANGUAGE.md](LANGUAGE.md) vocabulary and CONTEXT.md vocabulary in the brief so each sub-agent names things consistently with the architecture language and the project's domain language.

Each sub-agent outputs:

1. Interface (types, methods, params — plus invariants, ordering, error modes)
2. Usage example showing how callers use it
3. What the implementation hides behind the seam
4. Dependency strategy and adapters (see [DEEPENING.md](DEEPENING.md))
5. Trade-offs — where leverage is high, where it's thin

### 3. Present and compare

Present designs sequentially so the user can absorb each one, then score them before you
recommend — three concrete questions per design, not a vibe:

- **Leverage** — how many of today's call sites collapse into the design's 1–3 entry points?
  Count them; a design that still needs a different entry point per caller hasn't gained depth.
- **Locality** — pick one plausible near-term requirement change and name it. Does satisfying
  it touch one place in this design, or does it ripple across callers?
- **Seam cost** — how many adapters does the design actually need in production, per
  [DEEPENING.md](DEEPENING.md)'s dependency categories? Apply "one adapter = hypothetical seam,
  two = real" ([LANGUAGE.md](LANGUAGE.md)) — a design that invents a port with only one adapter
  is paying for flexibility nobody uses yet.

Score each design against the three questions, then recommend the one that wins on **at least
two of three** — say which, and by how much. If two designs tie, prefer the one that reuses a
seam/pattern already established elsewhere in the codebase over a novel one. If elements from
different designs would combine well, propose a hybrid and say which question each borrowed
element wins on. Be opinionated — the user wants a strong read, not a menu.
