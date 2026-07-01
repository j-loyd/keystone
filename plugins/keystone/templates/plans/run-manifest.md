# Run-manifest — <plan name>

A Heavy-tier **index** of one run's artifacts. It is **additive** — `/pickup` never requires it.
A resume reads only the run-state task log; this manifest just points at what a deep run left
behind so a human (or a resumed run) can find it fast.

- **Plan:** docs/plans/<...>.md
- **Level:** Heavy
- **Updated:** <YYYY-MM-DD HH:MM>

## Links

- **Run-state:** docs/plans/<plan-folder>/RUN-STATE.md (or `<plan>.run-state.md` beside a single-file plan)
- **Research:** docs/research/<topic>.md
- **Codebase map:** docs/codebase/<area>.md
- **ADRs:** docs/adr/<id>-<title>.md
- **Handoffs:** docs/handoffs/<date>.md

Any of these may be absent — the manifest indexes what exists, nothing more.
