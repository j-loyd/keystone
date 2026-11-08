---
name: security-review
description: Review code you wrote for exploitable vulnerabilities by tracing untrusted input to dangerous sinks. Use when adding auth, handling user input or file uploads, creating endpoints, working with secrets or payments, and when the user asks "is this secure" or "security review this". Anchored to OWASP Top 10 (2025). Scope boundary — this reviews source code; use the Aikido tools for dependency and CVE scanning, api-security for endpoint authz depth, and llm-security for anything agent- or model-facing.
---

# Security Review

A real review, not a checklist recital. The goal is to **find** vulnerabilities, then
prevent them. Pair this with the focused skills when they apply: **`api-security`** for any
endpoint/resolver/webhook (full OWASP API Top 10:2023), and **`llm-security`** for anything
touching an LLM/agent (OWASP LLM Top 10). The category lists below are a map, not a tutorial:
you know what XSS is. What this skill adds is the method, the verdict discipline, and the
places reviews keep missing.

For a **full, source-first audit** of a whole codebase (coverage ledger, independent
verification of every finding, schema-validated report), the user can run `/cso`, which can
hand the methodology to Cloudflare's optional `security-audit` skill. Use this skill for code
you are writing or reviewing now.

## How to review (find, don't just recite)

Security bugs live where **untrusted input reaches a dangerous sink**. Trace it:

1. **Enumerate untrusted sources** — request params/body/headers/cookies, uploaded files,
   URL params, webhook payloads, third-party API responses, DB rows written by other users,
   and **model/tool output** (treat as untrusted).
2. **Enumerate dangerous sinks** — SQL/query builders, shell/`exec`, file paths, HTTP
   clients (SSRF), HTML rendering (XSS), redirects, deserialization, auth/authz decisions,
   anything irreversible (payments, deletes, transfers).
3. **For each source→sink path, ask:** is the input validated, the identity authorized for
   _this specific object_, the value escaped/parameterized for that sink, and the failure
   handled safely? An unbroken untrusted→sink path with no control = a finding.
4. **Verify exploitability** before calling it confirmed. Note severity, the concrete attack,
   and the fix.

**What counts as a finding.** Each one names the lower-trust principal, the boundary it
crosses, and the concrete result. A missing best practice with no such path is **hardening** —
report it in its own section, not as a finding. Keep severity at or below the impact you
actually demonstrated: don't inflate a crash into RCE, or an action a user could already take
into privilege gain. Anchor the levels: **critical/high** when a control is fully defeated for
data or actions that matter, **medium** when it's weakened or needs an unlikely precondition,
**low** for limited reach.

**Three verdicts, not two.** _Confirmed_ (the path is reachable and unguarded), _rejected_,
or _needs validation_ — when the deciding fact isn't in the source (a proxy, the identity
provider, deploy config). A needs-validation item carries no severity; it names the exact
missing fact and a check the owner can run to settle it.

**State coverage.** Say what you reviewed, what you deferred, and what was out of scope. A
scoped or time-boxed pass says it's partial — never let silence imply the rest is clean.

**Model refusals on security work.** Top-tier models ship safety classifiers that can
false-positive on benign security work — exactly the exploit-shaped reasoning this skill asks
for. When dispatching this review to a subagent, state the authorization context in the packet
(defensive audit of code the user owns/operates); if a pass is declined anyway, re-frame or
re-run it one model tier down — and never let a declined pass masquerade as "no findings":
report it as NOT RUN.

## OWASP Top 10 : 2025 — the map

Label every confirmed finding with its category. The bullets are where reviews miss things,
not the whole category.

- **A01 Broken Access Control** ← most common, check first. Object-level (IDOR / API1 BOLA):
  every fetch/update/delete verifies the caller may access **that specific id**, enforced at
  the data layer (RLS, or an owner/tenant predicate in the query). Function-level (API5):
  privileged routes gate on role server-side. Property-level (API3 / mass assignment): writes
  go through an allowlist schema, never a spread request body.
- **A02 Security Misconfiguration.** Strict CSP (`unsafe-inline`/`unsafe-eval` are debt with a
  removal trigger), `frame-ancestors 'none'`, HSTS, `nosniff`; CORS as an explicit allowlist,
  never a reflected `Origin` or `*` with credentials. **Third-party scripts carry SRI plus a
  pinned version where the artifact is hashable**, with three gotchas:
  - Pair `integrity` with `crossorigin="anonymous"`, or the check can't run and the browser
    blocks the resource. That's why people add the attribute, see the script break, and delete it.
  - SRI covers one hop. A verified loader (tag manager, analytics bootstrap) that injects
    more scripts pulls unverified code behind a hash that looks like assurance.
  - Floating references (`@latest`) and UA-varying stylesheets (web-font CSS) can't be hashed.
    Pin, self-host, or name them as exceptions; don't record a failed check on correct code.

  Cloud/IAM/CI-CD/IaC: work through
  [`cloud-infrastructure-security.md`](./cloud-infrastructure-security.md).
- **A03 Software Supply Chain Failures.** Lockfile committed and `npm ci` in CI; postinstall
  scripts reviewed; typosquats. `/spec`'s integrate-first and package-legitimacy checks catch
  invented or typosquatted dependencies before code exists. **Untrusted MCP servers, skills,
  and plugins are supply chain too.** Watch CI that runs untrusted code with privileges, like
  `pull_request_target` checking out PR code while holding secrets. Full pass: the Trail of
  Bits **`supply-chain-risk-auditor`** skill (install separately).
- **A04 Cryptographic Failures.** `argon2id`/`bcrypt` for passwords (better: delegate auth to
  an IdP), a CSPRNG for tokens and ids (never `Math.random()`), vetted libraries only.
- **A05 Injection.** Parameterized SQL; `execFile`/`spawn` with an arg array, never `exec`
  with interpolation; resolve paths and confirm they stay inside an allowed root; sanitize any
  raw HTML (DOMPurify, allowlisted tags); disable external entities and DTDs when parsing
  XML/SVG/SOAP/`.docx`.
- **A06 Insecure Design.** Business rules enforced server-side. **Race conditions / TOCTOU**:
  check-then-spend must be atomic (a transaction with a row lock, or a conditional update).
  **SSRF is a TOCTOU bug too:** validate the address the socket connects to, not the hostname
  you checked (full treatment in `api-security` under API7). **Open redirects:** allowlist
  internal paths or hosts, and block `//evil.com`, `https:/evil.com`, backslashes,
  control characters, double encoding, `@`-userinfo, and IDN homographs (compare in punycode).
- **A07 Authentication Failures.** Verify JWT signature with the expected algorithm (reject
  `alg:none` and alg confusion) plus `exp`/`aud`/`iss`; tokens in httpOnly + Secure + SameSite
  cookies, not `localStorage`; rate-limit auth. **Session lifecycle:** removing a user from an
  org, deleting or deactivating an account, or resetting a password revokes every active
  session, refresh token, and API key. Authorize against current state, not a stale claim.
- **A08 Software or Data Integrity Failures.** Signed artifacts and CI provenance; no
  auto-update from untrusted sources; no deserialization of untrusted data.
- **A09 Security Logging & Alerting Failures.** Log authn/authz failures and high-value
  actions without secrets, tokens, full PANs, or PII; alert on the security-relevant ones.
- **A10 Mishandling of Exceptional Conditions.** Fail closed (an error in an authz check
  denies). Generic errors to the client; detail server-side only.

## Classes that sit between the categories

Easy to miss because no single OWASP heading owns them:

- **Proxy and cache trust** — request smuggling between a proxy and the app, cache poisoning
  or deception, and trusting `Host` / `X-Forwarded-*` headers the client can set.
- **Federated and passwordless auth** — SAML signature and assertion handling, WebAuthn
  origin/RP-ID checks, and account linking that merges identities on an unverified email.
- **Data lifecycle** — search or filter endpoints that leak records through match counts or
  timing, soft-deleted rows still reachable, a restore that reintroduces a state since made
  invalid, and stored values that are safe when written but used unsafely later.
- **Resource amplification** — regexes with catastrophic backtracking on user input, and
  decompression or parsing that expands a small request into a large one.
- **Chained findings** — two low-severity issues that combine into a real one; check pairs.

## Data privacy

Personal data carries obligations a source→sink trace won't surface: what you may collect,
how long you may keep it, whether a deletion actually deletes, and who else received a copy.
That is data-lifecycle review rather than diff review, so it lives in its own file — work
through [`data-privacy.md`](./data-privacy.md) whenever a change touches personal data,
adds a field, opens an export, or sends data to a third party (**an LLM vendor counts**).

## Stack footguns (check the ones for the stack you're in)

**Any serverless/edge runtime**

- **No long-lived process → in-memory rate limiting doesn't work.** Use a durable store:
  Upstash Ratelimit, Cloudflare Workers KV / Durable Objects, or a gateway. (`express-rate-limit`
  is meaningless here.)
- Client never receives a secret — audit for keys/tokens that leak into the browser bundle
  or public assets.

**Next.js / Supabase / Vercel**

- **`NEXT_PUBLIC_` leakage** — anything with that prefix ships to the browser; never put a
  secret behind it.
- **Supabase service-role key** is god-mode — server-only, never in client code or a public route.

**Cloudflare Workers / Hono**

- Secrets live in `wrangler` `vars`/`secrets` bindings (`env.X`) — never hardcode, log `env`,
  or expose a binding to client-reachable code.
- **Middleware order matters** — auth/authz middleware must run _before_ the handler; a route
  registered outside the protected group is unauthenticated. Validate `c.req` input with Zod
  (`zValidator`) — it's untrusted.
- Edge runtime has no Node APIs — use Web Crypto (`crypto.subtle`), and a CSPRNG, not
  `Math.random()`. Parameterize D1 / Databricks SQL; keep service tokens server-side.
- **File uploads** — validate size + MIME + extension (allowlist), store outside the web
  root / in object storage, and never trust the client-provided content-type alone.

**LLM/agent code present?** Also load the `llm-security` skill (Claude Code: the Skill tool
with `keystone:llm-security`).

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "This endpoint is internal-only" | Internal is a network claim, not an authorization control. It holds only until a proxy, a partner integration, or an SSRF bug produces an internal caller. |
| "The framework handles that" | Frameworks cover their default path. Findings cluster where someone stepped off it — a raw query, raw HTML, a route registered outside the protected group. Confirm this code is on it. |
| "It's behind auth, so the input is trusted" | Authentication says who is calling, not what they may reach or what they sent. |
| "The scan came back clean" | A missing per-object ownership check and a business rule enforced only client-side look identical to correct code from the outside. |
| "The diff is small, so the blast radius is small" | Blast radius is set by what the code reaches. A deleted ownership predicate is a one-line diff. |
| "It's not exploitable in practice" | Then name the control that stops it. If you can't, "in practice" means you couldn't think of the attack. |

## Red flags

- A review that concludes "no findings" without naming one source→sink path it traced
- Validation enforced in the UI and nowhere on the server
- A record fetched by id with no owner or tenant predicate anywhere on the path
- "Internal", "trusted", or "already sanitized" asserted in a comment, with no code enforcing it
- An authz check whose error path returns, logs, or falls through instead of denying
- A security control weakened to unblock something (CSP `unsafe-inline`, a widened CORS entry) with no removal trigger recorded
- A secret committed alongside a note to rotate it later
- A fix whose only evidence is that the code changed

## Resources

- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP LLM Top 10:2025](https://genai.owasp.org/llm-top-10/) — via the `llm-security` skill
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Cloudflare security-audit](https://github.com/cloudflare/security-audit-skill) — optional
  companion for full-audit methodology (keystone marketplace entry `security-audit`)
