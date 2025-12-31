# Parallel Agent Orchestration Guide

Spawn multiple AI coding agents to work on related issues concurrently.

## Philosophy

- **Issues ARE the prompts** - Write issues with enough context that an agent can work autonomously
- **Maximize parallelism** - Group independent work into waves
- **Fail fast** - Agents complete code; you handle git/PR if they can't
- **Trust but verify** - Review diffs before merging, resolve conflicts manually

---

## Process

### 1. Break Down the Feature

Create one issue per logical unit of work. Each issue should be completable in isolation.

**Issue template:**
```markdown
## Problem
What's broken or missing.

## Solution
High-level approach.

## Files to Modify
- `path/to/file` - what changes

## Implementation
Code snippets, function signatures, or pseudocode.

## Acceptance Criteria
- [ ] Testable outcomes
```

**Key:** Include file paths and code examples. Agents work best with concrete starting points.

### 2. Organize into Waves

```
Wave 1: Independent changes (no shared files)
Wave 2: Changes that may touch same files (expect conflicts)
Wave 3: Integration/testing (depends on all above)
```

**Rule:** If two issues modify the same file, either put them in different waves or assign to same agent.

### 3. Create the Slash Command

Create `.claude/commands/worktree-issue.md` with:
- Worktree setup using absolute paths
- `git -C <path>` for all git commands (avoids cd issues)
- Steps: understand → implement → commit → push → PR
- Clear scope rules

### 4. Pre-approve Permissions

Add git command patterns to `.claude/settings.local.json`:
```json
"Bash(git -C /path/to/worktree add:*)",
"Bash(git -C /path/to/worktree commit:*)",
"Bash(git -C /path/to/worktree push:*)"
```

Agents with `--print` flag can't request approvals interactively.

### 5. Spawn the Wave

```bash
for issue in <issue-numbers>; do
  (claude --print "/worktree-issue $issue" > "issue-${issue}.log" 2>&1) &
done
```

### 6. Monitor

```bash
# Running agents
ps aux | grep "claude.*worktree" | grep -v grep | wc -l

# Worktrees created
git worktree list

# File changes per worktree
git -C <worktree-path> status --short

# Logs
tail -f issue-*.log
```

### 7. Complete Stragglers

If agents finish code but fail on git, complete manually:
```bash
git -C <worktree> add -A && git -C <worktree> commit -m "..."
git -C <worktree> push -u origin <branch>
gh pr create --head <branch> --title "..." --body "Closes #N"
```

### 8. Merge

```bash
gh pr merge N --squash --delete-branch
```

If conflicts after prior merges:
```bash
cd <worktree> && git fetch origin main && git rebase origin/main
# resolve conflicts
git push --force-with-lease
```

### 9. Cleanup

```bash
git worktree remove <path>
git branch -D <branch>
git worktree prune
```

---

## Tips

| Tip | Why |
|-----|-----|
| 1-3 files per issue | Higher success rate |
| Include "Files to Modify" | Agents find code faster |
| Add code snippets | Reduces guesswork |
| Backend-first waves | Fewer frontend conflicts |
| Merge same-file PRs sequentially | Rebase between each |

---

## Failure Modes

| Problem | Solution |
|---------|----------|
| Agent stuck on permissions | Complete git manually |
| Merge conflict | Rebase, resolve, force-push |
| Agent went off-scope | Reject PR, clarify issue |
| Agent can't find files | Add explicit paths to issue |
| Too many conflicts | Smaller waves, sequential merge |
