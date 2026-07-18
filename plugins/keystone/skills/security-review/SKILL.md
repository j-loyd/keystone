---
name: security-review
description: Review code for security vulnerabilities and enforce secure patterns. Use when adding auth, handling user input or file uploads, creating API endpoints, working with secrets, payments, or any sensitive/irreversible operation. Anchored to OWASP Top 10 (2025) + API Security Top 10 (2023). For LLM/agent code, ALSO use the llm-security skill.
---

# Security Review

A real review, not a checklist recital. The goal is to **find** vulnerabilities, then
prevent them. Pair this with the focused skills when they apply: **`api-security`** for any
endpoint/resolver/webhook (full OWASP API Top 10:2023 — object/property/function authz,
resource consumption, business-flow abuse, inventory, unsafe upstream consumption), and
**`llm-security`** for anything touching an LLM/agent (OWASP LLM Top 10).

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
4. **Verify exploitability** before calling it confirmed. Note severity (critical/high/
   medium/low), the concrete attack, and the fix.

**Model refusals on security work.** Top-tier models ship safety classifiers that can
false-positive on benign security work — exactly the exploit-shaped reasoning this skill asks
for. When dispatching this review to a subagent, state the authorization context in the packet
(defensive audit of code the user owns/operates); if a pass is declined anyway, re-frame or
re-run it one model tier down — and never let a declined pass masquerade as "no findings":
report it as NOT RUN.

## OWASP Top 10 : 2025 — what to check

> Examples below are illustrative (TypeScript, sometimes Supabase) — the **principle** is
> stack-neutral. It applies equally to a Cloudflare Worker (Hono + Zod + D1/Databricks), a
> Next.js/Supabase app, or a Python service. Translate the example to the stack in front of
> you; see "Stack footguns" for per-stack specifics.

### A01 Broken Access Control ← most common, check first

- **Object-level (IDOR / API1:2023 BOLA):** every fetch/update/delete of a record must
  verify the caller **owns or may access that specific id** — not just "is logged in" or
  "is some role." `WHERE id = $1 AND owner_id = auth.uid()`, or enforce via RLS.
- **Function-level (API5):** admin/privileged routes gate on role server-side, not by
  hiding the UI.
- **Property-level (API3 / mass assignment):** never spread `req.body` into a DB write —
  whitelist updatable fields with a Zod schema so a caller can't set `role`, `isAdmin`, etc.
- Enforce ownership at the **data layer**: Supabase RLS on every table, or an explicit
  owner/tenant filter in the handler/query (Hono, raw SQL, D1/Databricks). A privileged DB
  key / service token must never reach the client or an unauthenticated path.

```typescript
// IDOR-safe: scope by owner, not just id
const { data } = await supabase
  .from("documents")
  .select("*")
  .eq("id", id)
  .eq("owner_id", session.user.id)
  .single();

// Mass-assignment-safe: whitelist, don't spread req.body
const Patch = z.object({ name: z.string().min(1).max(100) }); // role/owner NOT allowed
await db.user.update({ where: { id }, data: Patch.parse(body) });
```

### A02 Security Misconfiguration

- Security headers: a strict **CSP** (no `'unsafe-inline'`/`'unsafe-eval'` — treat as
  temporary debt), `X-Frame-Options: DENY`/`frame-ancestors 'none'`, HSTS, `X-Content-Type-Options: nosniff`.
- **CORS** explicit allowlist — never reflect `Origin` or use `*` with credentials.
- HTTPS enforced; no debug/verbose modes in prod; default creds removed.
- For cloud/IAM/CI-CD/IaC deployments, work through the deeper checklist in
  [`cloud-infrastructure-security.md`](./cloud-infrastructure-security.md) (least-privilege IAM,
  secrets management, edge/CDN, logging/monitoring, pipeline hardening).

```typescript
// next.config.js CSP — start strict, loosen only with a documented removal plan
const csp = `default-src 'self'; base-uri 'self'; object-src 'none';
  frame-ancestors 'none'; script-src 'self'; style-src 'self';
  img-src 'self' data: https:; connect-src 'self' https://api.example.com;`
  .replace(/\s{2,}/g, " ")
  .trim();
```

### A03 Software Supply Chain Failures

- `npm audit` clean; lock file committed; `npm ci` in CI (not `install`).
- Pin/verify dependencies; review postinstall scripts; watch typo-squats.
- **Supply-chain risk is also a plan-time concern** — see the `writing-plans` skill's
  Anti-Reinvention & Package Legitimacy gate, which catches hallucinated/typosquatted
  dependencies and forbidden hand-rolling at plan-write time, before code review.
- **Untrusted MCP servers and skills are supply chain too** — vet tool descriptions.
- For a full dependency/provenance pass, use the Trail of Bits **`supply-chain-risk-auditor`**
  skill (install separately — see the keystone README).

### A04 Cryptographic Failures

- **Password hashing:** `argon2id` (preferred) or `bcrypt` — **never** MD5/SHA-1/plain.
  (Best: delegate auth to Supabase/an IdP and don't store passwords at all.)
- TLS in transit; encrypt sensitive data at rest; use a vetted library — don't roll crypto.
- Strong randomness (`crypto.randomUUID`, `crypto.getRandomValues`), never `Math.random()`
  for tokens/ids/secrets.

### A05 Injection

- **SQL:** parameterized queries / query builder / ORM only — never string-concatenate.
- **Command:** `execFile`/`spawn` with an arg array, never `exec` with interpolation.
- **Path traversal:** resolve and confirm the path stays inside an allowed root before
  read/write; never join user input into a path unchecked.
- **XSS:** rely on React's escaping; sanitize any `dangerouslySetInnerHTML` with DOMPurify
  (allowlist tags); never build HTML from raw user input.
- **XXE:** when parsing XML/SVG/SOAP/`.docx`-style input, **disable external entities and
  DTDs** in the parser (Node `libxmljs`: `noent:false, nonet:true`; Python: `defusedxml`).
  An XXE can read local files or drive SSRF. Don't parse untrusted XML with default settings.

```typescript
import { execFile } from "node:child_process";
execFile("git", ["show", ref], cb); // safe: no shell
// path traversal guard
const abs = path.resolve(ROOT, userPath);
if (!abs.startsWith(ROOT + path.sep)) throw new Error("path escape");
```

### A06 Insecure Design

- Threat-model sensitive flows up front. Enforce business rules server-side (a client can
  send anything). Guard against **race conditions / TOCTOU** — e.g. check-then-spend on a
  balance must be atomic (transaction + row lock or a conditional update), or it's
  double-spendable.
- **SSRF (API7:2023):** when fetching a user-supplied URL, allowlist host/scheme, block
  private/link-local ranges (169.254/169.254.169.254, 10/8, 127/8, ::1), and disable
  redirects to them. Critical for webhooks and any "fetch this URL" feature.
- **Open redirect:** never redirect to a raw user-supplied `next`/`returnUrl`. Allowlist
  internal paths or known hosts; reject anything that isn't. Block the common bypasses —
  `//evil.com` and `https:/evil.com` (protocol-relative), backslashes `\/\/evil.com`,
  whitespace/control chars, double-encoding, and `@`-userinfo tricks
  (`https://yoursite.com@evil.com`). Also guard **IDN homograph** lookalikes (`аpple.com`
  with a Cyrillic а) — normalize to punycode and compare against the allowlist.

### A07 Authentication Failures

- **JWT/session:** verify signature with the expected **algorithm** (reject `alg:none` and
  alg-confusion), check `exp`/`aud`/`iss`; rotate refresh tokens; bind sessions; protect
  against fixation. Prefer the platform's session (Supabase Auth) over hand-rolled JWT.
- Tokens in **httpOnly + Secure + SameSite** cookies, never `localStorage`.
- Rate-limit auth endpoints (see A04-adjacent); generic "invalid credentials" messages.
- **Account/session lifecycle:** when a user is removed from an org, or an account is
  deleted/deactivated/password-reset, **immediately revoke all active sessions, refresh
  tokens, and API keys** — don't let an access token outlive the access. Verify
  authorization against current state, not a stale token claim.

### A08 Software or Data Integrity Failures

- Verify integrity of what you execute/deploy (signed artifacts, CI provenance); no
  auto-update from untrusted sources; guard deserialization of untrusted data.

### A09 Security Logging & Alerting Failures

- Log authn/authz failures, high-value actions, and anomalies — **without** logging
  secrets, tokens, passwords, full PANs, or PII. Alert on the security-relevant ones.

```typescript
console.log("login", { userId, ok }); // not { email, password }
console.log("charge", { userId, last4: c.last4 }); // not full card / cvv
```

### A10 Mishandling of Exceptional Conditions

- Fail **closed**, not open (an error in an authz check must deny, not allow).
- Generic error to the user; full detail server-side only — never leak stack traces,
  internal paths, or SQL to the client. Handle every external-call failure explicitly.

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

## Input validation (baseline)

Validate every untrusted input at the boundary with a Zod schema (allowlist, not blocklist);
reject on failure; don't let error messages leak internals.

```typescript
const Body = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});
const parsed = Body.safeParse(await req.json());
if (!parsed.success)
  return Response.json({ error: "invalid input" }, { status: 400 });
```

## Pre-deployment security checklist

- [ ] **Access control**: object-level ownership checks (not just role); RLS / data-layer scoping
- [ ] **Mass assignment**: writes whitelist fields (no `...req.body` into DB)
- [ ] **Injection**: parameterized SQL; `execFile` not `exec`; path-traversal guarded
- [ ] **XSS**: framework escaping (React etc.); any raw HTML sanitized; strict CSP
- [ ] **SSRF**: user-supplied URLs allowlisted; private ranges blocked
- [ ] **Auth**: JWT alg/exp/aud verified; httpOnly+Secure+SameSite cookies; auth rate-limited
- [ ] **Crypto**: argon2/bcrypt for passwords; TLS; CSPRNG for tokens
- [ ] **Secrets**: none hardcoded/in history; none shipped to client (`NEXT_PUBLIC_` / bundle / bindings); privileged keys server-only
- [ ] **Misconfig**: security headers + CORS allowlist; no debug in prod
- [ ] **Supply chain**: `npm audit` clean; lockfile + `npm ci`; deps reviewed
- [ ] **Errors/logging**: fail closed; generic client errors; no secrets/PII in logs
- [ ] **Resource limits**: rate limiting via a durable store (serverless/edge-appropriate); upload size/type limits
- [ ] **LLM/agent code present?** → run the `llm-security` skill too

## Resources

- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP LLM Top 10:2025](https://genai.owasp.org/llm-top-10/) — via the `llm-security` skill
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [`cloud-infrastructure-security.md`](./cloud-infrastructure-security.md) — cloud/IAM/CI-CD/IaC deep-dive checklist

---

**Security is not optional.** When a source→sink path is unclear, assume it's exploitable
until you've traced it and proven otherwise.
