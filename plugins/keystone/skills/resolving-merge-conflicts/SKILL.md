---
name: resolving-merge-conflicts
description: Work through an in-progress merge or rebase conflict hunk by hunk, resolving by intent rather than by picking a side, then finish the operation. Use when git reports conflicts, a rebase stops mid-stack, or the user says "fix the conflicts", "this won't merge", or "I'm stuck in a rebase". Covers semantic conflicts git cannot flag, and when aborting is genuinely right.
---

# Resolving Merge Conflicts

A conflict marker is not a formatting problem. It is git telling you that two people changed the
same lines for two different reasons, and it cannot know which reason still applies. Resolving it
means recovering both intents and deciding what the code should do now — not choosing whichever
side looks tidier.

This is narrow-bridge territory. A bad resolution compiles, passes review, and silently deletes
someone's work. Follow the sequence.

## Before you touch a hunk

Know what operation you are in — it changes what "ours" and "theirs" mean, and getting this
backwards is the single most common way to resolve every hunk exactly wrong.

```bash
git status                    # merge? rebase? cherry-pick? which step?
git log --oneline -3 HEAD
git log --oneline -3 MERGE_HEAD 2>/dev/null   # merge only
```

| Operation | `--ours` / `HEAD` is | `--theirs` is |
| --------- | -------------------- | ------------- |
| **merge** | your branch (the one you are on) | the branch being merged in |
| **rebase** | the **upstream** you are replaying onto | **your** commit being replayed |
| **cherry-pick** | the target branch | the commit being picked |

Rebase inverts the intuition. During a rebase, `--ours` is *not* your work — your work is
`--theirs`. Confirm with `git status` before reaching for either flag.

## The loop, per hunk

Work one hunk at a time. Do not bulk-resolve a file and hope.

1. **Read both sides in full.** Not just the conflicting lines — the function they sit in. A
   conflict is usually a symptom of two changes to the same *behavior*, and the behavior is
   wider than the markers.

2. **Recover each side's intent from its primary source.** Do not infer intent from the diff
   alone. Find out why each change was made:

   ```bash
   git log --oneline -5 HEAD -- <file>          # what was this side doing?
   git log --oneline -5 MERGE_HEAD -- <file>
   git log -1 --format=%B <sha>                 # the commit message states the why
   ```

   The commit message, the linked issue, or the surrounding tests are the primary sources. If
   you cannot determine why a side changed, say so before resolving — a guess here is how work
   gets silently dropped.

3. **Decide what the code should do now.** Usually one of:
   - **One intent supersedes the other** — take that side, and be able to say why.
   - **Both intents still apply** — write the combination that satisfies both. This is real
     editing, not concatenating both sides.
   - **Neither survives contact** — the two changes together reveal a third answer. Write that.

4. **Delete every marker** and make the region read as if one person wrote it. No `<<<<<<<`,
   no orphaned duplicate imports, no both-versions-stacked-with-a-blank-line-between.

5. **Stage that file** (`git add <file>`) only once its hunks are all genuinely resolved.

## The trap: conflicts git cannot see

Git conflicts on **overlapping lines**. It does not conflict on **incompatible meaning**. These
merge clean and break at runtime:

- One side renames a function; the other adds a new caller of the old name.
- One side changes a function's signature or return shape; the other adds a call site.
- One side adds a field to a type; the other adds a constructor that does not set it.
- One side changes a config key; the other adds a reader of the old key.
- Both sides add a migration, and now two migrations claim the same version number.
- One side deletes a file the other side started importing.

**After every file resolves clean, grep for the identifiers that moved.** If a rename appeared
on either side, search the whole tree for the old name — not just the conflicted files. This
check catches more real breakage than the hunk-by-hunk work does.

## Finishing the operation

Leaving the repo mid-merge is its own failure — the next session inherits a broken tree with no
context.

```bash
# merge
git status                    # confirm nothing is left unmerged
git commit                    # keep the generated message; add why, not what

# rebase
git rebase --continue         # repeat per conflicted commit
```

**Verify before you claim it worked.** A clean merge proves the text reconciled, not that the
program does. Run the test suite — and see `verification-before-completion`, because "it merged"
is exactly the kind of adjacent evidence that gets mistaken for a completion claim.

## When to abort

`--abort` is a legitimate tool and a bad reflex. It is right when:

- You are in the wrong operation entirely (rebasing onto the wrong base, merging the wrong branch).
- The conflict reveals the merge shouldn't happen yet — the other side needs to land something first.
- The scope is beyond what you can resolve responsibly and someone with the context should do it.

It is **not** right merely because the conflicts are numerous or tedious. Aborting after partial
resolution throws away work that was already correct, and the next attempt starts from zero.

If you abort, say why in the same breath. And if a partial resolution is worth keeping, stash or
branch it first:

```bash
git stash -u                  # or: git checkout -b conflict-wip && git commit -am wip
git merge --abort
```

## Reporting

Say what you resolved and how — per file, one line, naming the intent you preserved:

```
src/auth/session.ts   — kept both: their token refresh + our expiry check (both still required)
src/api/client.ts     — took theirs; our retry wrapper was superseded by their transport change
src/types/user.ts     — combined; their new field + our validation, constructor updated
```

Flag anything you resolved on an assumption rather than evidence, and anything the semantic sweep
turned up. A resolution you are unsure about is worth a sentence now and cheap to fix; found in
production, it is neither.
