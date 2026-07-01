# Plans index

The active-plans index for `docs/plans/`. Keep this current: one row per plan, newest first.
Move a completed plan (file or folder) to `docs/plans/archive/` and shift its row to **Archived**.

## Active

| Plan                      | Level   | Status             | Notes           |
| ------------------------- | ------- | ------------------ | --------------- |
| `YYYY-MM-DD-<feature>.md` | <l/m/h> | planned / building | <one-line hook> |

## Archived

| Plan                              | Shipped | Notes              |
| --------------------------------- | ------- | ------------------ |
| `archive/YYYY-MM-DD-<feature>.md` | <ver>   | <one-line outcome> |

Versioning is git — record material re-plans in each plan's `## Revision log`, not duplicate files.
