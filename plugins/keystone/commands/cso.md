---
name: cso
description: Chief Security Officer audit — infrastructure-first review covering secrets, supply chain, OWASP Top 10, LLM/agent security, and a STRIDE threat model. Use before shipping anything sensitive.
argument-hint: "[scope: repo, service, feature, or diff]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# CSO Audit — find it before an attacker does

Comprehensive security audit of **$ARGUMENTS**, anchored to OWASP Top 10 (2025), API
Security Top 10 (2023), and the LLM Top 10 (2025). This is the deep, deliberate pass; the
`security-review` skill (web/OWASP) and `llm-security` skill (agent/LLM) carry the full
category lists, and `scan.js` (PostToolUse hook) is the always-on injection tripwire. This
command ties them together into an audit.

> Prefer dispatching the **`security-reviewer`** agent (Task tool) to run the audit in a
> dedicated context — it traces untrusted→sink and adversarially verifies. For a large
> scope, fan out one `security-reviewer` per phase below and merge the findings.

## Audit phases (infrastructure-first)

> Start with an automated sweep — use the **Trail of Bits `static-analysis`** skill if
> installed (see keystone README → Companion plugins), else run Semgrep / `npm audit` /
> a secret scanner directly. Then do the manual phases below for depth. A scanner hit is a
> lead, not a verdict.

1. **Secrets archaeology.** Scan the repo and git history for committed secrets, keys,
   tokens, `.env` leaks. Check that secret files are gitignored and never logged.
2. **Supply chain.** Use the **Trail of Bits `supply-chain-risk-auditor`** skill if
   installed (else `npm audit` + manual review): known CVEs (by reachability), lockfile
   integrity, postinstall scripts, typosquat/dependency-confusion, pinning/provenance, and
   untrusted MCP servers or skills.
3. **CI/CD & config.** Over-broad tokens, secrets in CI logs, deploy steps that run
   untrusted code, mutable infra from local machines.
4. **OWASP Top 10 (2025)** against the application code — apply the full `security-review`
   skill, leading with **Broken Access Control** (IDOR/BOLA, function/property-level, mass
   assignment, RLS), then injection, SSRF, auth failures (JWT alg/exp, cookie flags),
   crypto/password hashing, misconfig/headers/CORS, logging, fail-closed error handling.
   Watch common stack footguns (e.g. framework public-env-var leakage like Next.js
   `NEXT_PUBLIC_`, BaaS service-role/service-key exposure, serverless rate-limiting).
   4b. **API Top 10 (2023)** — if there are any endpoints, resolvers, or webhooks, apply the
   full `api-security` skill: BOLA, object-property authz (excessive data exposure + mass
   assignment), resource-consumption caps, function-level authz, **sensitive business-flow
   abuse**, SSRF, misconfig, **API inventory/versioning** (zombie/non-prod endpoints), and
   **unsafe consumption of third-party APIs**. GraphQL: depth/complexity limits +
   introspection off in prod. Webhooks: signature + replay + idempotency.
5. **LLM / agent security** — if a model is in the loop, apply the full `llm-security`
   skill (OWASP LLM Top 10): indirect prompt injection, model-output-to-sink, excessive
   agency / missing HITL, secrets/cross-user data in context, RAG retrieval authz,
   memory/instinct poisoning, unbounded consumption.
6. **STRIDE threat model.** For each trust boundary: Spoofing, Tampering, Repudiation,
   Information disclosure, Denial of service, Elevation of privilege. Note which are
   mitigated and which are open.
7. **Variant analysis.** For each confirmed finding, apply the `variant-analysis` skill —
   hunt the same pattern everywhere else before closing it out. One bug is rarely alone.

## Output

A findings report grouped by severity (**critical / high / medium / low**), each with:
location (`file:line`), the concrete attack, and a specific fix. End with the top 3
must-fix-before-ship items. Verify exploitability where you can — don't report theoretical
issues as confirmed. Report-only: do not change code unless explicitly asked.
