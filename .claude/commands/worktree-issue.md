---
description: Work on a GitHub issue in a dedicated git worktree
argument-hint: <issue-number>
allowed-tools: Bash(*), Read, Write, Edit, Glob, Grep, WebFetch, TodoWrite
---

## Task

Work on GitHub issue #$ARGUMENTS in a dedicated git worktree, then commit, push, and create a PR.

## Issue Details

!`gh issue view $ARGUMENTS 2>/dev/null || echo "ERROR: Could not fetch issue #$ARGUMENTS"`

## Setup

Create the worktree (run from main repo):

```bash
git fetch origin main
git worktree add /home/garrett/projects/dangus_cloud-issue-$ARGUMENTS -b issue-$ARGUMENTS origin/main
```

Define the worktree path for all subsequent operations:
```
WORKTREE=/home/garrett/projects/dangus_cloud-issue-$ARGUMENTS
```

## Workflow

### 1. Understand
Read the issue thoroughly. Read all files mentioned using absolute paths:
```bash
# Example: Read a file in the worktree
cat /home/garrett/projects/dangus_cloud-issue-$ARGUMENTS/path/to/file.js
```

### 2. Implement
Make changes using absolute paths to the worktree. For edits, use the full path:
```
/home/garrett/projects/dangus_cloud-issue-$ARGUMENTS/backend/src/...
```

### 3. Verify
Check your changes:
```bash
git -C /home/garrett/projects/dangus_cloud-issue-$ARGUMENTS status
git -C /home/garrett/projects/dangus_cloud-issue-$ARGUMENTS diff
```

### 4. Commit
Stage and commit with a descriptive message:
```bash
git -C /home/garrett/projects/dangus_cloud-issue-$ARGUMENTS add -A
git -C /home/garrett/projects/dangus_cloud-issue-$ARGUMENTS commit -m "<type>: <short description>

<detailed explanation of changes>

Closes #$ARGUMENTS

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 5. Push
Push the branch to origin:
```bash
git -C /home/garrett/projects/dangus_cloud-issue-$ARGUMENTS push -u origin issue-$ARGUMENTS
```

### 6. Create PR
Create the pull request (can run from any directory):
```bash
gh pr create --repo 4eyedengineer/dangus_cloud --head issue-$ARGUMENTS --base main --title "<title from issue>" --body "## Summary
<1-2 sentence description>

## Changes
- <bullet points of what changed>

Closes #$ARGUMENTS

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Rules

- Use ABSOLUTE PATHS for all file operations: `/home/garrett/projects/dangus_cloud-issue-$ARGUMENTS/...`
- Use `git -C <path>` for all git commands - do NOT cd into the worktree
- Stay scoped to ONLY what the issue describes
- Do not refactor unrelated code or add features beyond acceptance criteria
- Follow terminal UI aesthetic (monospace fonts, box-drawing characters) for frontend
- MUST complete all 6 steps including PR creation

## Project Context

- **Stack**: React 18 + Vite | Fastify 4 + PostgreSQL | k3s + Traefik
- **Frontend**: `frontend/src/` - components in `components/`, pages in `pages/`
- **Backend**: `backend/src/` - routes in `routes/`, services in `services/`
- **Templates**: `templates/` - K8s manifests with `{{PLACEHOLDER}}` syntax
