# keystone — repo instructions

Project-specific notes for working in this repo. (General working discipline lives in the
keystone skills themselves; this file is only for what's specific to keystone-the-repo.)

## Releasing — bump the version as a unit

keystone carries its version in **three** places that must always move together. The harness's
plugin-update check reads the **manifests**, not `VERSION` — bumping only `VERSION` makes the
update check report "already at latest" on a stale number (this bit us: `VERSION` reached 0.27
while the manifests were stuck at 0.18). On every release, bump all three:

1. `VERSION`
2. `plugins/keystone/.claude-plugin/plugin.json` → `version`
3. `.claude-plugin/marketplace.json` → `metadata.version`

Then `grep -rn "<old-version>" --include='*.json' VERSION` to confirm nothing is left behind,
and add the matching `CHANGELOG.md` entry. `/ship` carries the agnostic reminder; this is the
concrete file list for this repo.

## Conventions

- **No auto-commits** — stage freely; commit/push only when explicitly asked.
- **Releases ship via squashed PRs** to `main` (the `gh pr create … && gh pr merge --squash`
  flow), not direct pushes.
- **Attribution** — upstream provenance for copied/adapted work is recorded in `ATTRIBUTION.md`
  (with the required MIT notices) and summarized in the README "Credits" section. Shipped
  skill/command _prose_ stays clean of framework name-drops for readability, but credit is never
  removed — keep `ATTRIBUTION.md` current when vendoring or adapting anything new.
- **Skill/command budgets** — `SKILL.md` files stay under ~500 lines; push depth into sibling
  reference files. Keep `description:` frontmatter lean (it's always-loaded).
- Completed plans move to `docs/plans/archive/`; keep `docs/plans/README.md` accurate.
