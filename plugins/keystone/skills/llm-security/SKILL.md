---
name: llm-security
description: Security review for LLM and agent code — prompt injection, tool/output abuse, data exfiltration, excessive agency, RAG/memory poisoning. Use when building or reviewing anything that calls an LLM, runs an agent loop, exposes tools to a model, does RAG, or ingests untrusted content into a prompt. Anchored to OWASP LLM Top 10 (2025).
---

# LLM & Agent Security

The attack surface web reviews miss. Use alongside `security-review` whenever a model is in
the loop — Claude API apps, Agno agents, MCP tools, RAG pipelines, the knowledge platform.

## The one principle

**Model output and any content the model ingests are UNTRUSTED.** A model that read a web
page, a file, a DB row, an email, or a tool result may now be repeating an attacker's
instructions. Never let model/tool output reach a privileged action, a shell, a query, or
another user without a trust boundary in between. (keystone's `scan.js` hook flags injection
in tool output; `guard.js` blocks the dangerous sinks — but design for it too.)

## OWASP LLM Top 10 : 2025 — what to check

### LLM01 Prompt Injection (the core risk)

- **Direct:** user input overrides your instructions ("ignore previous instructions…").
- **Indirect:** instructions hidden in content the model _fetches_ — a web page, PDF, repo
  file, email, image (OCR), or tool result. This is the dangerous one for agents/RAG.
- Defenses: keep a strong, clearly-delimited system prompt; mark external content as data,
  not instructions; don't concatenate untrusted text into the instruction channel; strip
  zero-width/bidi obfuscation; constrain the model with an allowlist of actions, not trust.

### LLM02 Sensitive Information Disclosure

- Don't put secrets, other users' data, or full system internals in the prompt/context.
- Scrub PII/secrets from what you send to the model and from what you log.
- Assume anything in context can be coaxed out — minimize what's there (least context).

### LLM03 Supply Chain

- Vet models, third-party prompts, **skills, and MCP servers** — a poisoned tool
  description or skill is an injection vector. Pin and review external agent components.
- **Models invent plausible package names** (typosquat, slopsquat, or wholly invented) — a
  plan that names a dependency is an injection of an unverified external component. The
  `writing-plans` Anti-Reinvention & Package Legitimacy gate detects this at plan time;
  registry existence alone is not legitimacy.

### LLM04 Data and Model Poisoning

- RAG/fine-tune/memory inputs are attack surface: an attacker who can write to your vector
  store, knowledge base, or **persisted memory/instincts** can plant instructions recalled
  later. Validate and attribute sources; isolate untrusted corpora.

### LLM05 Improper Output Handling (→ classic web vulns)

- Treat model output like untrusted user input at every downstream sink:
  - Rendered as HTML → XSS (sanitize).
  - Used in a query → injection (parameterize).
  - Passed to a shell/eval → RCE (never; `execFile` + allowlist).
  - Used as a URL to fetch → SSRF.
  - Written to a file path → traversal.

### LLM06 Excessive Agency (the agent risk)

- Give tools the **least privilege** needed: scope, read-only where possible, no blanket
  shell/db/filesystem. Require human approval (HITL) for irreversible/high-impact actions.
- Bound autonomy: cap tool-call depth/iterations and spend; a runaway or hijacked loop
  shouldn't be able to delete, pay, email, or exfiltrate freely.
- Separate identities/tokens for the agent (its own scoped GitHub/Gmail/DB creds), not the
  operator's.

### LLM07 System Prompt Leakage

- Assume the system prompt **can** leak — so don't put secrets, keys, or
  security-by-obscurity rules in it. Enforce authz in code, not in the prompt.

### LLM08 Vector & Embedding Weaknesses

- RAG access control: a user must only retrieve chunks they're authorized to see (embed
  ownership/tenant into retrieval filters). Guard against embedding-inversion data leaks and
  cross-tenant retrieval.

### LLM09 Misinformation

- Don't let unverified model output drive consequential decisions unchecked. Ground with
  citations, verify claims, and surface uncertainty (pairs with adversarial verification).

### LLM10 Unbounded Consumption

- Cap tokens, request rate, tool calls, and cost per user/session (matches the
  `cost-aware-llm-pipeline` skill). Prevent denial-of-wallet and model-extraction abuse.

## Review method for agent/LLM code

1. **Map the trust boundaries:** where does untrusted content enter the prompt/context, and
   what can the model _do_ (tools, output sinks)?
2. **Trace indirect injection:** for every external source the model reads, assume it
   contains hostile instructions — what's the worst action it could trigger?
3. **Check each tool** for least privilege, HITL on irreversible actions, and bounded use.
4. **Check output handling** at every sink (LLM05 list above).
5. **Check context hygiene** (LLM02/07): no secrets, no cross-user data, no authz-by-prompt.

## Agent action audit (enumerate what it can DO)

For an agent with tools, do an explicit action audit — the failure mode is rarely the model
"saying" something bad; it's the model **doing** something bad with a granted capability.
(Method inspired by Trail of Bits' agentic-actions-auditor; written original.)

1. **Enumerate every action** the agent can take: each tool, its real capability (not its
   name), and what it can reach (filesystem paths, DB scope, network egress, money, other
   users, prod). Include indirect reach — a "run shell" tool can do _anything_.
2. **Classify each by impact + reversibility:** read-only / reversible-write /
   **irreversible** (delete, pay, send, deploy, grant access, external POST).
3. **Check the gate on each:** least-privilege scope, and a **human-approval checkpoint on
   every irreversible action** — never auto-approved from model output alone. Confirm a
   hijacked loop (via indirect injection) still can't reach an irreversible action ungated.
4. **Check the kill-switch:** bounded iterations/depth/spend, and the agent runs with its
   **own scoped credentials**, not the operator's, so blast radius is contained.
5. **Flag over-broad tools:** a shell/admin/`*`-scope tool where a narrow one would do is the
   finding — recommend the least-privilege replacement.

## Quick checklist

- [ ] External/fetched/tool content treated as data, not instructions (indirect injection)
- [ ] Model output sanitized/parameterized/escaped at every downstream sink (LLM05)
- [ ] Tools least-privilege; irreversible actions gated by human approval (LLM06)
- [ ] Tool-call depth, iteration, and cost bounded (LLM06/LLM10)
- [ ] No secrets / cross-user data / authz logic in the prompt or system prompt (LLM02/07)
- [ ] RAG retrieval scoped to the caller's authorization; corpus/memory write-access controlled (LLM04/08)
- [ ] Agent runs with its own scoped credentials, not the operator's (LLM06)
- [ ] PII/secrets scrubbed from prompts and logs (LLM02)

## Resources

- [OWASP Top 10 for LLM Applications (2025)](https://genai.owasp.org/llm-top-10/)
- keystone: `scan.js` (injection tripwire), `guard.js` (sink blocks), `security-review`
  (web vulns), `/cso` (full audit).
