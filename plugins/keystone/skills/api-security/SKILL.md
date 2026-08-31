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

**OAuth authorization-code flows** need two things beyond "it redirects and works". Use
**PKCE** (the verifier/challenge pair): for public clients — SPA, mobile, CLI, anything that
can't hold a secret — it is what stands between an intercepted authorization code and a
stolen session, and it's cheap enough to leave on for confidential clients too. And generate a
**`state`** value per flow, store it server-side or in a signed cookie, and validate it on the
callback before exchanging the code — that's the CSRF control for the redirect, not a
decoration. A flow missing either is a finding even when it authenticates correctly.

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

#### Idempotency keys that actually deduplicate

"Make it idempotent" is the advice everywhere; these are the parts that get it wrong.

- **Derive the key from the intent, not the attempt.** `charge:v1:{orderId}` is a key — it
  names the thing that should happen exactly once. A fresh random id minted per attempt
  defeats dedupe entirely (every retry looks new), and a key containing a timestamp is a
  random value in disguise. A `{userId}:{amount}` pair fails the other way: it collapses two
  legitimate identical charges into one. The key originates with the client or with the
  initiating event and rides along unchanged — it should not be generated by the layer doing
  the retrying, which is precisely the layer that can't tell a retry from a new request.
- **Scope the key to the caller, not to the service.** The uniqueness constraint is on
  `(principal, key)` — API key, tenant, or user — never on the key alone. A global namespace
  lets one caller claim another's key, suppressing their real request, and on the replay path
  hands them the stored response for work they never did. The payload hash below does not save
  you here: two callers sending the same body produce the same hash. Re-run the authorization
  check on replay too — a stored response is still a response about an object, and the caller
  must still be entitled to it. This matters most with the guessable keys good derivation
  produces: `charge:v1:{orderId}` is exactly the shape an attacker can pre-claim.
- **Claim the key atomically.** Look-up-then-write is a TOCTOU race, not a guard: two
  concurrent retries both read "absent" and both proceed. Let a **uniqueness constraint** on
  `(principal, key)` pick the winner in a single operation, and treat the constraint violation
  as the duplicate path. Stated store-agnostically: a store that can't enforce uniqueness in one
  operation can't back an idempotency layer — reach for one that can rather than papering
  over it with a lock you then have to get right too.
- **Guard the payload.** Same key with a different body is a client bug, not a retry. Store a
  hash of the request payload alongside the claim — hash a **canonical form** (the parsed,
  normalized fields you act on, not the raw bytes), or key reordering and re-serialization by
  an intermediary will reject genuine retries — compare on arrival, and fail loudly (422)
  instead of replaying the first response, since silently handing back a result computed from
  someone else's input is worse than an error. Store the first response alongside the claim
  too; the replay path has nothing to return otherwise.
- **Decide the in-flight-duplicate policy explicitly** — reject with a retry-after, wait a
  bounded time for the first attempt to resolve, or accept and return a status URL. All three
  are defensible; what isn't is letting a second caller through because the first merely
  *looks* stuck. That's the double-charge, and it fires exactly when the system is already
  degraded and retries are thickest.
- **Three outcomes, not two: success, failure, and _unknown_.** Record the intent *before* the
  outbound call, not after it, so a crash mid-flight leaves a claimed key in an unresolved
  state you can reconcile against the downstream system. A key store that only ever sees
  completed work can't distinguish "never happened" from "happened and we lost the ack."
- **Retention is set by the longest retry chain, not by storage cost.** If keys expire after
  an hour but a dead-letter queue replays after a day, the replay arrives as a fresh request
  and the effect lands twice. Size the TTL against the outermost replay / DLQ / manual-reprocess
  window, then add margin — the storage is cheap next to the duplicate.

### API7 Server-Side Request Forgery

When an endpoint fetches a **user-supplied URL** (image-from-URL, webhook target, link
preview, importer): allowlist scheme (`https` only) and host; resolve DNS and **block
private/link-local ranges** (`127/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`,
`::1`, cloud metadata `169.254.169.254`); disable redirects or re-validate each hop; set
a timeout. Never pass raw user URLs to `fetch` server-side. The block list has to cover the
IPv6 equivalents and IPv4-mapped forms too (`fc00::/7`, `fe80::/10`, `::ffff:0:0/96` — so
`::ffff:169.254.169.254` doesn't walk past a v4-only list), plus `0.0.0.0/8` and CGNAT
`100.64.0.0/10`.

**DNS rebinding — the check and the connection can see different IPs.** Validating a hostname
and then handing that same hostname to the HTTP client is check-then-use across a resolution
boundary: the client resolves again at connect time, and an attacker-controlled record with a
short TTL can answer with a public address on the lookup you validated and `169.254.169.254`
on the one that opens the socket. The allowlist passed; the request still went somewhere
private. Either remedy closes it — **resolve once yourself, validate every address in the
answer, and connect to exactly one validated address with fallback to alternates disabled**
(a client that silently retries the next record has re-opened the gap — happy-eyeballs-style
fallback does this by default), carrying the original hostname for TLS/SNI and the `Host`
header so TLS still functions. Note the pin is doing all the defensive work here: an attacker
who controls the hostname controls its certificate too, so cert validation is not a second
layer. Most clients expose the hook as a custom resolver or connect callback. The alternative
is to route outbound calls through a **filtering egress proxy** that enforces the destination
policy at connect time, where the real IP is known. Re-validate on every redirect hop: a
redirect is a new hostname and a new resolution.

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
- [ ] Idempotency keys derive from the intent (not the attempt) and are claimed atomically via a uniqueness constraint on `(principal, key)`, not look-up-then-write on the key alone
- [ ] Same key + different payload is rejected via a stored payload hash, not replayed
- [ ] Idempotency key retention outlives the longest replay / dead-letter window
- [ ] User-supplied URLs allowlisted + private ranges blocked; connection made to the validated address (pinned IP or egress proxy), re-checked on each redirect (SSRF)
- [ ] Headers + CORS allowlist; no verbose errors; consistent 401/403/404
- [ ] Endpoint + version inventory; no debug/non-prod routes or introspection in prod
- [ ] Third-party responses validated, timed out, failed-closed, escaped before any sink
- [ ] GraphQL: depth/complexity limits, introspection off in prod, per-resolver authz

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "Authorization is handled in the middleware" | Middleware knows the caller is authenticated; it rarely knows which object this handler is about to load. The object-level check belongs where the id is resolved — and a route registered outside the group has no middleware at all. |
| "The id is a UUID, nobody's guessing it" | Unguessable isn't unauthorized. Ids leak through exports, shared links, referrer headers, logs, and support tickets, and the ownership predicate costs one clause. |
| "The client won't send that field" | Your client won't. The request is a document anyone can compose; the schema is the only thing deciding what the handler accepts. |
| "It's an internal service calling, so the caller is trusted" | An internal caller is an unauthenticated caller with a friendlier name until something verifies it — and it forwards whatever a user handed it, so its requests carry untrusted content even when the service itself is honest. |
| "We'll add rate limits later" | Later tends to arrive as the incident. An unbounded endpoint gets found by whoever is scanning, on their schedule rather than yours. |
| "Rate limiting is the gateway's job" | Worth confirming rather than assuming, and it only covers request counts. Per-business-action limits — signups, resets, coupons, expensive exports — are shaped by logic the gateway can't see. |
| "This is read-only, so authorization matters less" | Exfiltration doesn't need a write. Reads are what most breaches consist of. |
| "Returning the whole record is simpler — the UI only renders two fields" | The response is the API; what the UI renders is a display choice, and the next consumer reads the rest. Serialize through an allowlist. |
| "That vendor's API is fine, we've consumed it for years" | Trust in the vendor isn't validation of the response. A compromised — or merely changed — upstream sends its output straight into your database, your HTML, or your shell. |

## Red flags

- A handler that takes an id from the request and queries it with no owner or tenant predicate
- Object-level authorization asserted only in middleware, or only by which links the UI renders
- A whole ORM entity or `select('*')` result returned to a client
- A write assembled by spreading the request body
- A list or search endpoint with no maximum page size, or an export with no cap
- An in-memory rate limiter on a runtime with no long-lived process
- An endpoint whose auth requirement nobody can state without reading the handler
- An older API version still serving traffic that no team claims to own
- Debug routes, seeded test endpoints, or GraphQL introspection reachable in production
- A webhook handler that parses the body before verifying the signature, or verifies against a re-serialized copy of it
- A third-party response destructured straight into a database write
- An idempotency key minted inside the retry path, or uniqueness enforced on the key alone rather than on the caller and key together

## Resources

- [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- Pairs with `security-review` (web/OWASP 2025) and `llm-security` (LLM Top 10).
