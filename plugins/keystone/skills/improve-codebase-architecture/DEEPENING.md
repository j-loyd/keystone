# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Assumes the vocabulary in `LANGUAGE.md` — **module**, **interface**, **seam**, **adapter**.

## Detecting shallow, concretely

"Interface nearly as complex as the implementation" (`LANGUAGE.md`) is a judgment
call — these signals make it checkable instead of a vibe:

- **Caller duplication.** Two or more call sites repeat the same multi-step dance around the
  module (build args → call → unwrap/interpret the result the same way). Count the call sites;
  each one is a copy of logic the module should own instead.
- **Parameter-to-behaviour ratio.** The number of parameters/config flags a caller must supply
  approaches the number of distinct behaviours the module has. A module with 6 params and 2
  behaviours is shallow — most of its interface exists to route around itself.
- **Pass-through tests.** The module's own tests mostly assert "it called X with the args I
  passed in" rather than an independently-derived outcome — a symptom the interface isn't
  hiding anything. Same weakness `verification-before-completion`'s circular-test check flags
  in a single test, applied here to a whole module's suite.

Any one signal is a lead, not a verdict. Confirm with the **deletion test**
(`LANGUAGE.md`) before proposing the deepening — see also
[SKILL.md](SKILL.md#reconciling-with-audit-the-call-thats-easy-to-get-wrong) for the case where
the deletion test points the other way, toward `/audit` instead.

## Dependency categories

When assessing a candidate for deepening, classify its dependencies. The category determines how the deepened module is tested across its seam.

Quick classification: no I/O → **in-process**. I/O with a local test double available (PGLite,
an in-memory filesystem, a fake queue) → **local-substitutable**. I/O across the network to a
service your own team owns → **remote but owned**. I/O to a vendor you don't control →
**true external**.

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable — merge the modules and test through the new interface directly. No adapter needed.

### 2. Local-substitutable

Dependencies that have local test stand-ins (PGLite for Postgres, in-memory filesystem). Deepenable if the stand-in exists. The deepened module is tested with the stand-in running in the test suite. The seam is internal; no port at the module's external interface.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary (microservices, internal APIs). Define a **port** (interface) at the seam. The deep module owns the logic; the transport is injected as an **adapter**. Tests use an in-memory adapter. Production uses an HTTP/gRPC/queue adapter.

Recommendation shape: _"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it's deployed across a network."_

### 4. True external (Mock)

Third-party services (Stripe, Twilio, etc.) you don't control. The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

## Seam discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a port unless at least two adapters are justified (typically production + test). A single-adapter seam is just indirection.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them.

## Testing strategy: replace, don't layer

- Old unit tests on shallow modules become waste once tests at the deepened module's interface exist — delete them.
- Write new tests at the deepened module's interface. The **interface is the test surface**.
- Tests assert on observable outcomes through the interface, not internal state.
- Tests should survive internal refactors — they describe behaviour, not implementation. If a test has to change when the implementation changes, it's testing past the interface.
