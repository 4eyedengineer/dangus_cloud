# Dangus Cloud

Self-hosted PaaS for deploying containerized apps from GitHub repos (like Railway/Render on your own k3s). **Retro terminal UI aesthetic**.

**Goal:** Make it dead simple to go from GitHub repo to running service. Minimize clicks, hide complexity, sensible defaults. If a user has to read docs to deploy, we've failed.

Always plan to maximize concurrent tool/agent use.

Reaach for code-reviewer,  playwright-ux-tester, and llm-philosophy-architect agents to deligate and lean on.

Always respond as concisely as possible, keeping critical points.

## Stack

React 18 + Vite | Fastify 4 + PostgreSQL 15 | k3s + Traefik | Harbor | ArgoCD | GitHub Actions (ARC) | Claude Haiku 4.5 (Dockerfile generation)

## Commands

```bash
./dev up          # Start dev environment (hot reload)
./dev logs        # Follow logs (or: ./dev logs backend)
./dev rebuild     # Rebuild and restart
./dev db          # Connect to PostgreSQL (pw: dangus-dev-password)
./dev token       # Generate k3s service account token
./dev             # Show all commands

tilt up --stream  # k3s dev alternative
```

## URLs

- **Dev:** http://192.168.1.124:5173 (frontend) / :3001 (backend)
- **k3s:** http://dangus.192.168.1.124.nip.io / http://api.dangus.192.168.1.124.nip.io
- **Harbor:** https://harbor.192.168.1.124.nip.io
- **ArgoCD:** https://argocd.192.168.1.124.nip.io

## UI Rules

IMPORTANT: Follow the retro terminal aesthetic. See `terminal-ui-design-philosophy-v2.md`.
- Use `Terminal*` components from `frontend/src/components/`
- Monospace fonts only (`font-mono`)
- Box-drawing characters for borders: `─ │ ┌ ┐ └ ┘ ├ ┤`

## Key Paths

- `backend/src/routes/` - API endpoints
- `backend/src/services/` - Business logic (kubernetes, harbor, github, buildPipeline, llmClient, dockerfileGenerator)
- `frontend/src/pages/` - Route components
- `frontend/src/components/` - Reusable Terminal* components
- `templates/` - K8s manifest templates (`{{PLACEHOLDER}}` syntax)
- `k8s/argocd/` - ArgoCD Application manifest

## LLM Dockerfile Generation

Repos without a Dockerfile get one auto-generated via Claude Haiku 4.5. The LLM analyzes the repo structure and generates a production-ready multi-stage Dockerfile.

**Flow:** Select repo → No Dockerfile? → LLM generates one → Build with ConfigMap injection → Deploy

**Key files:**
- `backend/src/services/llmClient.js` - Anthropic SDK wrapper
- `backend/src/services/dockerfileGenerator.js` - Orchestration
- `templates/kaniko-job-generated.yaml.tpl` - Kaniko template with ConfigMap mount

**Required env var:** `ANTHROPIC_API_KEY` in `.env`

## Playwright Testing

Before using Playwright MCP to test the authenticated app, inject the session cookie:

```javascript
// Read cookie from .dev-session, then inject before navigating:
await context.addCookies([{
  name: 'session',
  value: '<content-of-.dev-session>',
  domain: '192.168.1.124',
  path: '/',
  httpOnly: true,
  sameSite: 'Lax'
}]);
await page.goto('http://192.168.1.124:5173');
```

Update the cookie with `./dev auth <cookie>` when you get a new session.

## Do Not

- Commit secrets, `.env` files, or `k8s/tls/*.key`
- Modify `k8s/dev/postgres/` without understanding PVC implications
- Use non-monospace fonts or skip PropTypes
- Push directly to main without PR
