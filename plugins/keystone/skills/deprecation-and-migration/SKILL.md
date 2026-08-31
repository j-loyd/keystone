---
name: deprecation-and-migration
description: Retire code that no longer earns its keep and move its users off it safely. Use when the user says "rename this column safely", "kill this old endpoint", "migrate off X", "can we delete this", "zero-downtime migration", or "sunset this service" — and when a schema, API, or message-format change has to ship while old and new code are both live. Scope boundary — removing things that still have consumers; the whole-repo cut list is `auditing-for-overengineering`.
---

# Deprecation and Migration

Code is a liability, not an asset. What you get paid for is behavior; the code is the ongoing
bill — tests to keep green, dependencies to patch, a paragraph in every new engineer's mental
model, and one more piece of surface area for the next advisory. The same behavior with less
code is strictly cheaper. So the default answer to "should this still exist" leans toward no.

The hard part is that you cannot remove it just because it stopped earning.

**Hyrum's Law**: with enough users, every observable behavior of your system becomes something
someone depends on — including the bugs, the timing, the field ordering, the undocumented side
effect. Your stated contract is what you documented; your real contract is everything you emit.
That is *why* deprecation is a migration project rather than an announcement. Consumers can't
"just switch" when the replacement doesn't reproduce the behaviors they're actually bound to,
and nobody — not them, not you — knows which ones those are until the switch breaks something.

Two jobs, in order: decide whether to deprecate, then do the migrating yourself.

## The gate — decide before you announce

Question 1 is disqualifying; work them in order.

1. **Is there an alternative?** If not, build it first — **don't deprecate without one.**
   Deprecating into a vacuum just converts your maintenance problem into N teams' problems, and
   they'll each solve it worse than you would have. The replacement must cover the critical use
   cases and be proven in production, not theoretically better.
2. **Who depends on it, and how do you know?** Get names, not a count — teams, services,
   repos, jobs. Measure real usage over a window long enough to catch monthly and quarterly
   callers. "Nobody uses it" that isn't backed by telemetry or a code search is a guess.
3. **What does migration cost each consumer?** A codemod or config swap you can run for them is
   cheap enough to just do. A hand-rewrite of business logic per consumer is a budget line.
4. **What does carrying it cost?** Sum it over two to three years: patch churn, security
   exposure, the tax on every adjacent change, onboarding drag. Compare to #3 honestly — most
   migrations are cheaper over that horizon, which is exactly why "too expensive" needs numbers.
5. **Advisory or compulsory?** Default advisory; escalate only for a reason you can state.

| | **Advisory** | **Compulsory** |
| --- | --- | --- |
| **Fits when** | The old thing is stable and safe to keep running; you'd prefer people move | Open security exposure, it blocks a migration you must finish, or carry cost is genuinely unsustainable |
| **Mechanism** | Warnings, docs, migration guide, nudges. Consumers move on their own timeline | A dated removal, communicated with lead time proportional to the work you're asking for |
| **You owe** | A working alternative and a guide | All of that, plus tooling, hands-on support, and usually the migration PRs themselves |

Escalating to compulsory doesn't reduce your obligations, it multiplies them. A deadline with no
tooling behind it isn't a compulsory deprecation, it's a threat.

## The Churn Rule

**If you own the infrastructure being deprecated, you are responsible for migrating your users
— or for shipping a backward-compatible update that requires no migration at all.**

An announcement plus a deadline is an unfunded mandate on every team downstream. It's also the
most expensive possible arrangement: you're asking N teams to each learn the old system's quirks
well enough to leave it, when you're the one who already knows them. Doing it once centrally is
cheaper in total engineering time even when it's more expensive for *your* team.

Two ways to discharge the obligation — send the migration yourself (codemod, PRs, a script you
run), or absorb the change behind the interface so nothing on their side moves. Posting it in a
changelog is neither.

## Expand/contract — the shape of a safe migration

A schema change is the riskiest migration you run, because data is the one thing a deploy
rollback doesn't undo. But the usual failure isn't bad SQL — it's **coupling the schema change
to the code change**. Rename a column in the same release that starts using the new name and,
during the rollout window when old and new code are both serving, one of them queries a column
that doesn't exist. Rolling deploys, blue/green, canaries, and a single retried request all put
two code versions live at once; assume they overlap, because they do.

So: **while two versions can be live at once, don't change a shape in place.** Add, migrate,
then subtract — in separate deploys, so both code versions are valid at every moment.

```
EXPAND ─────────────→ MIGRATE ─────────────→ CONTRACT
add the new shape     dual-write, backfill,   drop the old shape,
alongside the old,    then switch reads       alone, in a later
nullable/optional                             deploy
```

### Worked example — renaming `users.name` to `users.full_name`

Five deploys. Generic SQL; adapt the dialect.

**1. Expand.** Add the new column, nullable.

```sql
ALTER TABLE users ADD COLUMN full_name TEXT NULL;
```

Nullable is load-bearing. `NOT NULL` with no default rejects the still-running old code's
inserts, which turns a safe additive step into an outage.

**2. Dual-write.** The app writes both `name` and `full_name` on every insert and update.
Deploy. From here forward, new rows are correct in both columns — only history is stale.

**3. Backfill in throttled batches.**

```sql
UPDATE users SET full_name = name
 WHERE full_name IS NULL AND id > :cursor
 ORDER BY id LIMIT 1000;
```

Driven from a script that walks the key range, sleeps between batches, watches lock waits and
replica lag, and can be stopped and resumed. A single unbounded `UPDATE` over millions of rows
takes locks and holds them; it is the classic self-inflicted outage.

**4. Switch reads — still dual-writing.** Point reads at `full_name`. Keep writing both. Deploy
and let it bake. This is the step that makes rollback free: if step 4 misbehaves, redeploy step
2's code and `name` is still current, because you never stopped maintaining it.

**5. Contract — separately, later.** Stop writing `name` and deploy. Then, in a *different,
later* deploy containing nothing else:

```sql
ALTER TABLE users DROP COLUMN name;
```

Four safe steps and one destructive one, and the destructive one ships alone after the others
have baked.

### Rules

- **Additive first, destructive last and alone.** Adds — new nullable column, new table, new
  index — are safe to ship alongside code. Drops and renames get their own deploy, after
  nothing references the old shape.
- **Every migration has a tested down path. Write and run the down before merging** — against a
  copy with realistically-shaped data, not an empty schema. A reverse that has never executed is
  a deploy you cannot roll back, and "we'll write the rollback if we need it" means writing it
  during the incident. Where a contraction genuinely can't be reversed (dropped data is gone),
  that's the argument for doing it last, alone, after a bake, from a restore you have verified.
- **Backfill in throttled batches, off the hot path.** Bounded, resumable, sleeping between
  batches, with a kill switch.
- **Build large indexes without blocking writes** where the engine supports it. Postgres, for
  instance, offers `CREATE INDEX CONCURRENTLY` — which can't run inside a transaction, so most
  migration frameworks need to be told to skip their automatic transaction wrapper for that one
  migration. Check what your engine and framework actually do.
- **Gate the risky cutover behind a flag** when you want step 4 to be a config change you can
  revert in seconds rather than a deploy.

### Feature flags — deploy and release on different days

That last rule points at a lever worth naming on its own. A feature flag **decouples deployment
from release**: the code merges and ships dark, and a config change — not a deploy — decides
when anyone sees it. That buys two things a migration wants anyway. The new path runs in
production, exercised against real traffic shapes, before it is load-bearing. And **turning the
flag off is a rollback that needs no redeploy** — seconds, no build, no rollout window, and
available to whoever is holding the pager rather than only to whoever can push. That second
property is the whole point; a flag that can't be flipped quickly under pressure isn't buying
it, so check who can flip it and how fast before you rely on it.

Five steps — create (default off) → enable for internal testing → canary on a small slice →
full rollout → **remove the flag and the branch it was guarding**. The fifth is the one that
gets skipped.

Until that last step lands, that code path is two code paths — two branches to reason about, two to
test, and a combination with every other live flag that nobody has actually run. Stale flags
compound: the interesting bugs live in the configurations no one has exercised.

**So a flag gets a cleanup trigger when it's created, or it becomes debt.** Mirror the
deliberate-shortcut marker convention from `coding-standards` at the flag's definition, so
`/debt` harvests it with everything else:

```py
# keystone: both write paths live while this flag exists; remove the flag and the legacy write
# once the backfill finishes and reads have baked a week on the new column.
```

A date works where the timeline is known; a condition ("once every consumer is off v1") works
better where it isn't. What doesn't work is no trigger — that's how a temporary flag becomes a
permanent branch nobody dares delete, and it's the zombie pattern below in miniature.

### The same shape, off SQL

Expand/contract isn't a database pattern. It applies to any interface where two versions can be
live simultaneously — which is any interface you don't control both sides of atomically.

- **API responses** — add the new field alongside the old and populate both, migrate clients,
  remove the old field in a later release. Adding a field is the safe step; removing or
  retyping one is the destructive step, and it's the one that needs consumer telemetry first.
- **API requests** — accept both spellings, prefer the new, warn on the old, then stop
  accepting the old.
- **Message and event schemas** — stricter than HTTP, because a message written by the old
  producer may be read hours later by a lagging or restarted consumer. Roll consumers out to
  tolerate the new shape *before* producers emit it, require consumers to ignore unknown fields,
  and only remove a field once the oldest possible in-flight message has expired.
- **Config keys, feature flags, file formats, on-disk caches** — same three phases.

## Zombie code

Zombie code is code nobody owns and everybody depends on. It isn't dead code — dead code is
easy, nothing calls it. Zombies have live consumers, which is exactly what makes them dangerous:
the thing accruing unpatched dependencies and undocumented behavior is also load-bearing.

Detection signals. One is suspicion; several together is a diagnosis:

- No commits in 6+ months, but live traffic, imports, or scheduled runs
- No named owner — "the team that owned it reorged" or the owner is a person who left
- Tests failing or skipped for months with nobody paged
- Feature-flagged off for months while the code and the branch on the flag both remain
- Docs describing behavior the code no longer has (nobody's reading either one)
- Dependencies pinned to versions with open advisories

**The verdict is binary: it gets investment, or it gets removed.** Limbo is the one option
that's always wrong — you pay the maintenance cost and get none of the maintenance. Investment
means a named owner, working tests, current dependencies, and someone who answers pages.
Removal means running the migration above, not just deleting it out from under its consumers.

For the remove-versus-keep call itself, run the **deletion test** from
`auditing-for-overengineering` — it's the referee, and it lives there. Note the question you're
asking it: not "does this abstraction earn its keep" but "is this code still the right home for
behavior we need." If the behavior is still needed and this is still the best place for it, the
answer is investment.

## Removing it

Verify zero *live* usage, not zero known usage — telemetry over a window long enough to catch
quarterly jobs, plus a static sweep for imports and references. "Nobody has complained" is not
usage data.

Then remove all of it: the code, its tests, its config, its docs, and the deprecation notices
themselves. A deprecation notice left behind after the thing is gone is just another stale
document — it did its job, retire it too.

And then say so plainly. A diff that removes a system and its scaffolding is among the
highest-value changes an engineer ships: it is the one kind of change that makes every future
change cheaper. Put the net-negative line count in the description. Removal is an achievement,
not an apology — if the changelog entry reads like one, the work has been mispriced.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "It still works, why remove it?" | Working code nobody maintains accrues security debt and complexity tax silently. Working is the floor, not the justification. |
| "Someone might need it later" | If it's needed later it can be rebuilt, with the benefit of knowing what it's for. Version control keeps the corpse. |
| "The migration is too expensive" | Compare against carry cost over two to three years, with actual numbers. That comparison usually flips the answer. |
| "We'll plan the deprecation after the new system ships" | By then there are new priorities and no appetite. Ask "how would we remove this in three years" while designing it, when clean interfaces are still free. |
| "Users will migrate on their own" | They won't; their backlog isn't yours. Ship tooling, or do the migration yourself — the Churn Rule. |
| "We can maintain both indefinitely" | Two systems doing one job is double the tests, docs, on-call surface, and onboarding, forever. |
| "The flag is temporary, we'll clean it up after launch" | Launch is exactly when attention leaves. Give the flag a removal trigger at creation, marked in the code where `/debt` will find it. |
| "Just rename the column, it's one line" | During rollout, old and new code run together and one of them queries a column that no longer exists. Expand/contract. |
| "I'll add the column and drop the old one in the same migration" | That welds a safe add to a destructive drop and forfeits the rollback. Drops ship alone, later. |
| "We'll write the rollback if we need it" | You'll be writing it during the incident, untested, at speed. Write and run the down before merging. |
| "Nobody's called that endpoint in ages" | Not until you've measured it over a window that includes the monthly batch job. |

## Red flags

- A deprecation announced with no working replacement, or with no migration tooling or guide
- A deadline set for consumers while the owning team ships no migration help
- "Soft" deprecation that's been advisory for years with no consumers actually moved
- New features being added to something already deprecated
- A feature flag at 100% (or 0%) for months with both branches still in the code, or any flag
  created without a removal trigger
- Deprecation decided without measuring current usage; removal done without verifying zero usage
- Zombie code with live consumers and no owner, left in limbo rather than adopted or removed
- A schema change and the code depending on it in the same deploy
- A column, field, or event property renamed or dropped in place rather than expand/contract
- A migration merged with no tested down path, or a backfill that runs as one unbounded statement
- A destructive migration bundled with anything else in the same deploy
