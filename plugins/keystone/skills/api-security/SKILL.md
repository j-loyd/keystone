---
name: api-security
description: Security review for APIs — the full OWASP API Security Top 10 (2023), with patterns for REST (Next.js route handlers, Hono on Cloudflare Workers), GraphQL, and webhooks / third-party consumption. Use when building or reviewing any endpoint, resolver, webhook receiver, or outbound API call. Stack-neutral principles; examples are illustrative. Pairs with security-review (web) and llm-security (agent).
---

# API Security

APIs fail differently from web pages — the top risks are **authorization** (per-object,
per-property, per-function) and **abuse of legitimate endpoints**, not classic injection.
This skill is the full OWASP API Security Top 10 (2023) applied to the REST / GraphQL /
webhook stack. Trace every endpoint: **who is calling, which object, which fields, how
often, and do they consume an untrusted upstream?**

## OWASP API Top 10 : 2023

### API1 Broken Object Level Authorization (BOLA / IDOR) — #1 cause of breaches

Every object access must verify the caller may access **that specific id** — not just
"authenticated" or "has a role."

```typescript
// FAIL: trusts the id from the request
const doc = await db.document.findUnique({ where: { id: params.id } });

// PASS: scope to the caller (or enforce via RLS)
const doc = await db.document.findFirst({
  where: { id: params.id, ownerId: session.user.id },
});
if (!doc) return Response.json({ error: "not found" }, { status: 404 }); // 404, not 403
```

Test every endpoint with another user's id. Use random/UUID ids (not sequential) as
defense-in-depth, never as the control itself. Enforce at the data layer (Supabase RLS, or an
explicit owner/tenant filter in the handler/query for Hono/D1/Databricks).

### API2 Broken Authentication

Verify JWT **signature + algorithm** (reject `alg:none`/confusion), `exp`/`aud`/`iss`;
rotate refresh tokens; rate-limit + lock out auth endpoints; no credentials/keys in URLs.
Prefer Supabase Auth / an IdP over hand-rolled JWT. Treat **API keys** as passwords:
hashed at rest, scoped, rotatable, revocable.

### API3 Broken Object Property-Level Authorization

Two halves — guard both:

- **Excessive data exposure (output):** return only fields the caller may see. Never
  `select('*')` an object to the client; serialize through an explicit allowlist DTO.
- **Mass assignment (input):** never spread `req.body` into a write — whitelist updatable
  fields with a Zod schema so `role`, `ownerId`, `isAdmin`, `balance` can't be set.

```typescript
const Patch = z
  .object({ name: z.string().max(100), bio: z.string().max(500) })
  .strict();
const data = Patch.parse(await req.json()); // strict() rejects unknown keys
const Public = (u) => ({ id: u.id, name: u.name }); // never leak email/role/hash
```

### API4 Unrestricted Resource Consumption

Bound everything an attacker can inflate:

- **Rate limits** per user + per IP via a **durable store** (Upstash, Cloudflare Workers KV /
  Durable Objects, a gateway) — on serverless/edge there's no long-lived process, so an
  in-memory limiter (`express-rate-limit`) is meaningless.
- **Pagination caps** — enforce a max `limit` (e.g. ≤100); reject/normalize bigger.
- **Payload size** limits; request **timeouts**; cap expensive operations (search, export,
  file processing) and fan-out to third parties.
- File uploads: size + type allowlist; stream, don't buffer unbounded.

### API5 Broken Function Level Authorization

Admin/privileged operations gate on role **server-side**, per route — never by hiding the
UI or assuming method (don't let `POST`-only logic be reachable via another verb). Default
deny; the route asserts the required capability.

### API6 Unrestricted Access to Sensitive Business Flows

Protect _legitimate_ flows from automated abuse (bulk signup, scalping, scraping, coupon
farming, comment spam). Identify business-sensitive endpoints and add friction sized to the
risk: per-business-action rate limits, bot detection / proof-of-work / CAPTCHA on the
risky ones, device/identity heuristics, and idempotency so retries don't multiply effect.
This is logic-layer, not a WAF checkbox.

### API7 Server-Side Request Forgery

When an endpoint fetches a **user-supplied URL** (image-from-URL, webhook target, link
preview, importer): allowlist scheme (`https` only) and host; resolve DNS and **block
private/link-local ranges** (`127/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`,
`::1`, cloud metadata `169.254.169.254`); disable redirects or re-validate each hop; set
a timeout. Never pass raw user URLs to `fetch` server-side.

### API8 Security Misconfiguration

Security headers (CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors 'none'`); **CORS**
explicit allowlist (never reflect `Origin`, never `*` + credentials); disable verbose
errors/stack traces in prod; restrict HTTP methods (no stray `TRACE`/`OPTIONS` leakage);
consistent error shape so 401 vs 403 vs 404 doesn't leak object existence.

### API9 Improper Inventory Management

You can't secure what you don't know exists. Maintain an inventory of endpoints and
**versions**; retire deprecated/`/v1` endpoints (zombie APIs keep old vulns); keep
**non-prod endpoints out of prod** (debug routes, `/test`, swagger in prod); document every
public route and its auth requirement; audit what data each environment exposes.

### API10 Unsafe Consumption of APIs

Treat **third-party API responses as untrusted input**, not as safe because they're "your"
vendor: validate/parse their responses (Zod) before use; don't blindly follow their
redirects; set timeouts and handle their failures (fail closed); don't forward their data
to a sink (DB/HTML/shell) unescaped. A compromised upstream shouldn't become your breach.

## Style-specific patterns

### REST (Next.js route handlers / Hono on Workers)

- Auth/authz at the **top of every handler** (`GET/POST/PATCH/DELETE`), before any work;
  don't rely on middleware alone for object-level checks. (Hono: ensure the auth middleware
  actually wraps the route — a route registered outside the protected group is open.)
- Validate `params` + body + query with Zod (`zValidator` on Hono); cap `limit`/`offset`; one
  consistent error envelope; correct status codes (404 over 403 for BOLA to avoid id enumeration).
- Never expose a privileged DB key / service token (Supabase service-role, Databricks token,
  a Worker secret binding) in a route reachable without auth.

### GraphQL

- **Query depth + complexity limits** (e.g. `graphql-depth-limit` / cost analysis) — a
  single deep/recursive query is a DoS (API4).
- **Disable introspection in production** (or restrict it); it's an inventory leak (API9).
- **Field-/resolver-level authorization** — authz at each resolver, not just the top
  query; BOLA/API3 apply per field.
- Guard **batching / aliasing abuse** (one request running thousands of operations);
  prefer persisted queries; rate-limit by cost, not request count.
- Mask internal errors; don't return resolver stack traces.

### Webhooks & third-party

- **Inbound:** verify the **HMAC signature** on the raw body (constant-time compare),
  enforce a **timestamp window + nonce** to stop replay, and make handlers **idempotent**
  (dedupe on event id). Never trust the payload's claims without the signature.
- **Outbound target URLs** are SSRF surface (API7) — allowlist + private-range block.
- **Consuming** third-party APIs → API10 above (validate, timeout, fail closed).

## Review checklist

- [ ] Every object read/write is scoped to the caller (BOLA) — tested with another user's id
- [ ] Outputs serialized through an allowlist DTO (no `select('*')` to client); writes whitelist fields
- [ ] Auth: JWT alg/exp/aud verified; API keys hashed/scoped; auth endpoints rate-limited
- [ ] Resource caps: rate limits via a durable store (serverless/edge-appropriate), max pagination, payload size, timeouts
- [ ] Function-level authz server-side per route; default deny
- [ ] Sensitive business flows have anti-automation friction + idempotency
- [ ] User-supplied URLs allowlisted + private ranges blocked (SSRF)
- [ ] Headers + CORS allowlist; no verbose errors; consistent 401/403/404
- [ ] Endpoint + version inventory; no debug/non-prod routes or introspection in prod
- [ ] Third-party responses validated, timed out, failed-closed, escaped before any sink
- [ ] GraphQL: depth/complexity limits, introspection off in prod, per-resolver authz

## Resources

- [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- Pairs with `security-review` (web/OWASP 2025) and `llm-security` (LLM Top 10).
