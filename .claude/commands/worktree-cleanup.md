---
description: Clean up merged worktrees and their branches
argument-hint: [issue-number or "all"]
allowed-tools: Bash(git worktree:*), Bash(git branch:*), Bash(ls:*), Bash(gh pr view:*)
---

## Task

Clean up git worktrees for completed/merged issues.

## Current Worktrees

!`git worktree list`

## Instructions

### If argument is "all":
1. List all issue worktrees
2. Check if their PRs are merged
3. Remove merged worktrees and branches

### If argument is a specific issue number:
1. Check if PR for issue #$ARGUMENTS is merged: `gh pr view issue-$ARGUMENTS --json state`
2. If merged, remove the worktree: `git worktree remove ../dangus_cloud-issue-$ARGUMENTS`
3. Delete the local branch: `git branch -d issue-$ARGUMENTS`
4. Confirm cleanup

### Commands Reference
```bash
# Remove a specific worktree
git worktree remove ../dangus_cloud-issue-<NUMBER>

# Delete the local branch (only if merged)
git branch -d issue-<NUMBER>

# Force delete branch (if PR was squash-merged)
git branch -D issue-<NUMBER>

# Prune stale worktree references
git worktree prune
```

## Safety
- Only remove worktrees for MERGED PRs
- Warn before force-deleting branches
- Run `git worktree prune` at the end
