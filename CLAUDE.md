# Workflow conventions for Claude Code

## Auto-land branch work on main

After any batch of commits on a feature branch in this repo, automatically:

1. Push the feature branch to origin (the Stop hook in `.claude/settings.local.json` handles this, but also do it manually if needed).
2. Check if an open PR from the current branch → `main` already exists (use `mcp__github__list_pull_requests` with `head` = `diegoariasasch:<branch>`).
3. If no open PR: open one with `mcp__github__create_pull_request` (`base: main`, `head: <current branch>`). Title = the most significant change; body = bulleted summary of all commits since the last merge + a test plan.
4. Try `mcp__github__enable_pr_auto_merge` with `mergeMethod: MERGE`. If it returns "already in clean status," fall through to step 5.
5. Merge with `mcp__github__merge_pull_request` using `merge_method: merge`.
6. Delete the merged head branch on origin: `git push origin --delete <branch>`. Don't delete the local branch while the session is checked out on it — that's the session's working branch. When the session switches to a new feature branch, the old local one can be pruned too (`git branch -D <old>`).

Do this without asking — the user has authorized it as the standing workflow for this repo. Do NOT force-push main and do NOT bypass branch protection; if the merge is blocked by missing reviews/checks, stop and tell the user.

## Scope

- Branch: whatever the session was started on (typically `claude/...`).
- Target: `main` only. Never merge into other branches.
- Do not open multiple open PRs for the same head branch — update the existing one by pushing additional commits.
