<!-- Sibling of security-review/SKILL.md. Data-lifecycle governance: classification,
     minimization, retention, subject rights, and onward sharing. Cited from SKILL.md's
     pre-deployment checklist; api-security cites it for export endpoints. -->

# Data privacy — an engineering property, not a legal footnote

Privacy failures look like design decisions rather than bugs, which is why review misses
them. They surface later as a deletion request nobody can fulfil, or a breach whose blast
radius is years of data no feature ever read. What follows is engineering practice for
handling personal data — it is not legal advice, and nothing here makes a system compliant
with any particular regulation.

### Classify first — the tier sets the obligation

| Tier | Examples | What handling it obliges |
| --- | --- | --- |
| **Non-personal** | aggregate counts, feature flags, telemetry with no rejoin path | Standard controls. The check that matters is whether it is *actually* non-personal: an "anonymous" id that still maps back to a person, or a coarse field that re-identifies when joined with another table, is personal data wearing a different label. |
| **Personal** | name, email, phone, address, account/device ids, IP, location, behavioural history | A named purpose per field; access scoped to the roles that need it; a retention clock; exportable and deletable on request; kept out of logs and error payloads by default. |
| **Sensitive** | health, biometrics, location history, financial account detail, government ids, credentials, anything concerning a minor — and inferences that reveal the same | Everything above, plus: encryption at rest under a distinct key scope; reads logged, not just writes; no onward sharing without a recorded consent basis; and a genuine look at not storing it — tokenize it, hold a reference, or ask for it at the moment of use. |

Tiering is per field, not per table. One sensitive column pulls the whole row's handling up
with it unless it is separated out.

### Collect against a stated purpose

Each stored field should trace to a purpose someone can name. "It might be useful later" is
not an asset — it is latent breach scope, and whoever inherits the system inherits the
liability without the context that justified it. When reviewing a new field, ask what reads
it and what breaks without it. "Nothing yet" is a finding, not a nice-to-have.

The same test applies to breadth, where over-collection hides more easily: full date of
birth where an age band would do, a street address where a postal code would do, a permanent
identifier where a rotating one would do.

### Retention needs a deletion path that actually deletes

A retention policy that lives only in a document is not a control; it needs a clock per data
class and a job that enforces it. And treat "we deleted the row" as the claim most worth
distrusting — the primary row is usually the one copy that *did* get deleted. Trace where
else the data went:

- **Backups and snapshots** — the destination teams forget first. Either the deletion is
  replayed after a restore, or backup retention is short enough to bound the exposure. Pick
  one deliberately and write it down; "we'll remember" is not a mechanism.
- **Caches and replicas** — application caches, CDN copies, read replicas, materialized
  views, and denormalized duplicates living in other services.
- **Search indexes** — a record dropped from the store routinely survives as a searchable
  document.
- **Analytics and warehouse copies** — event pipelines, BI extracts, and the training sets
  built from them. What a trained model retains is its own hard question; at minimum, know
  which datasets contain the subject.
- **Logs, traces, and audit events** — point-deletion from an append-only, retention-locked
  store is usually not feasible, and `cloud-infrastructure-security.md` deliberately requires
  long retention here. So the control is keeping personal data out of logs in the first place
  (A09, which is how it gets there), and bounding whatever landed there by log retention.
  Pick one deliberately; don't promise a per-subject deletion the logging stack can't perform.
- **Queues, event streams, and CDC/outbox tables** — a topic or outbox row with multi-week
  retention holds the full payload long after the source row is gone.
- **Versioned object storage** — deleting an object leaves prior versions and delete markers
  behind unless the lifecycle policy reaps them.
- **Third parties** — every processor that received a copy needs its own deletion, on its
  own timeline, with its own evidence.

Where hard deletion is genuinely impossible — append-only ledgers, records under legal hold
— crypto-shredding (destroying the per-subject key so the ciphertext is inert) is the usual
substitute, and it only works if the data was encrypted per subject from the beginning.

### Export and delete are schema features

Both are cheap designed in and close to impossible to retrofit. The retrofit is what teams
actually attempt, under deadline, after the first request arrives — and it is where the
missed copies above come from. Design for them instead:

- Every table holding personal data carries a traversable subject reference, so "everything
  about this person" is a query rather than codebase archaeology.
- Deletion order is defined where foreign keys or audit requirements conflict — anonymize
  the fields that must be retained rather than orphaning rows or cascading past them.
- Export emits a portable form, and the export path is authorized per-object. It is an IDOR
  target with an unusually large payoff (A01): one missing ownership check hands over a
  complete dossier instead of a single record.
- Both paths have tests, and the test asserts absence from the secondary destinations above
  — not just from the primary store, which is the part that already works.

### Consent gates onward sharing — and a model provider is a third party

Sending personal data outward needs a recorded basis: what was disclosed, to whom, for which
purpose, when, and how it can be withdrawn. Consent captured for one purpose does not
generalize to a new one — a checkbox at signup is not agreement to forward the same data to
an analytics processor, an enrichment vendor, or a support tool.

**Model and inference providers belong on that list**, and they are the ones most often
skipped, because the call looks like an ordinary function call rather than a disclosure.
Anything placed in a prompt has been disclosed to whoever operates that endpoint — including
data pulled in by a retrieval step or returned by a tool call, which no one wrote an explicit
`send()` for. Check the retention and training terms of the endpoint actually in use,
minimize what enters context, and use the **`llm-security`** skill for the prompt-side
controls. Withdrawal should reach the vendor too; where you cannot delete from them, that is
an argument for having sent less in the first place.
