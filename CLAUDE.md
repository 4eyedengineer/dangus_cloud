# Dangus Cloud

Self-hosted PaaS for deploying containerized apps from GitHub repos. Similar to Railway/Render but on your own k3s infrastructure.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Tailwind CSS, Vite |
| Backend | Node.js, Fastify 4 |
| Database | PostgreSQL 15 |
| Auth | GitHub OAuth |
| Registry | Harbor (self-signed TLS) |
| Orchestration | k3s + Traefik ingress |
| GitOps | ArgoCD + Image Updater |
| CI | GitHub Actions (ARC runners) |
| Dev Environment | Docker Compose / Tilt |

## Project Structure

```
backend/
├── src/
│   ├── server.js           # Fastify entry point
│   ├── routes/             # API endpoints (auth, projects, services, deployments, webhooks)
│   ├── plugins/            # Fastify plugins (db, auth)
│   └── services/           # Business logic (kubernetes, harbor, github, buildPipeline)
├── migrations/             # SQL migrations (auto-run on startup)
└── Dockerfile

frontend/
├── src/
│   ├── pages/              # Route components (Dashboard, ProjectDetail, ServiceDetail, etc.)
│   ├── components/         # Reusable Terminal* UI components
│   ├── api/                # API client functions
│   ├── hooks/              # Custom React hooks
│   ├── context/            # React context providers
│   └── services/           # WebSocket and other services
└── Dockerfile

k8s/
├── base/                   # Kustomize base manifests
├── overlays/production/    # Production overlay
├── argocd/                 # ArgoCD Application manifest
└── tls/                    # Self-signed CA for Harbor (ca.crt, harbor.crt)

templates/                  # K8s manifest templates for user deployments
scripts/                    # Helper scripts (setup-harbor-trust.sh, run-harbor-images.sh)
```

## Commands

```bash
# Docker Compose (preferred local dev)
docker compose up                    # Dev mode with hot reload
./scripts/run-harbor-images.sh       # Run production images from Harbor
./scripts/run-harbor-images.sh --pull # Pull latest Harbor images only

# Tilt (k3s development)
tilt up --stream
tilt trigger backend                 # Force rebuild

# Logs
docker compose logs -f backend       # Docker Compose
kubectl logs -l app=backend -f       # k3s

# Database
psql -h 192.168.1.124 -U dangus -d dangus_cloud  # pw: dangus-dev-password
```

## URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| Docker Compose | http://192.168.1.124:5173 | http://192.168.1.124:3001 |
| k3s (Tilt) | http://dangus.192.168.1.124.nip.io | http://api.dangus.192.168.1.124.nip.io |

- Harbor: https://harbor.192.168.1.124.nip.io
- ArgoCD: https://argocd.192.168.1.124.nip.io

## UI Design System

This project uses a **retro terminal/TUI aesthetic**. See `terminal-ui-design-philosophy.md` for full details.

### Color Palette (CSS Variables)
- `--color-accent-green` (#33ff33) - Primary, success, operational
- `--color-accent-amber` (#ffaa00) - Secondary, interactive, attention
- `--color-accent-red` (#ff3333) - Danger, errors, critical
- `--color-bg-primary` (#0a0a0a) - Main background
- `--color-bg-secondary` (#121212) - Elevated surfaces

### Component Conventions
- Use `Terminal*` components from `frontend/src/components/` (TerminalButton, TerminalInput, TerminalSelect, etc.)
- **Monospace fonts only** - via `font-mono` class
- UPPERCASE for section headers and status labels
- Use box-drawing characters for borders: `─ │ ┌ ┐ └ ┘ ├ ┤`
- Glow effects: `shadow-glow-green`, `shadow-glow-amber`, `shadow-glow-red`

### Component Variants
```jsx
<TerminalButton variant="primary">   // Green border/text
<TerminalButton variant="secondary"> // Amber border/text
<TerminalButton variant="danger">    // Red border/text
```

## Code Conventions

### Frontend (React)
- Functional components with PropTypes
- CSS via Tailwind utility classes (no separate CSS files per component)
- Named exports for components, default export for page components
- API functions in `frontend/src/api/`

### Backend (Fastify)
- ES modules (`import`/`export`)
- Route files export async plugin functions
- Services in `backend/src/services/` contain business logic
- Use fastify's built-in logger (`request.log`, `fastify.log`)
- JSON schema validation on routes

### Kubernetes Resources
- Namespace per project: `{userHash}-{projectName}`
- Templates use `{{PLACEHOLDER}}` syntax for substitution
- User services get ingress at `{serviceName}.{BASE_DOMAIN}`

## WebSocket Events

Backend broadcasts real-time updates via WebSocket:
- `deployment:status` - Deployment state changes
- `service:status` - Service health updates
- `build:log` - Build log streaming

## GitOps Pipeline

```
Push to main → GitHub Actions (arc-dangus runner) → Build & push to Harbor → ArgoCD Image Updater detects new tag → ArgoCD syncs to k3s
```

- CI workflow: `.github/workflows/ci.yaml`
- ArgoCD app: `k8s/argocd/application.yaml`
- Harbor images: `harbor.192.168.1.124.nip.io/dangus/{backend,frontend}:latest`
- ARC runner: `arc-dangus` (repo-level, runs in k8s)

## TLS

- Harbor uses self-signed CA (`k8s/tls/ca.crt`)
- Host Docker trusts CA via `/etc/docker/certs.d/harbor.192.168.1.124.nip.io/ca.crt`
- ARC runners trust CA via ConfigMap mounted to `/etc/docker/certs.d/`
- Production (future): Cloudflare for TLS termination on `*.dangus.cloud`

## Do Not

- Commit secrets, `.env` files, or private keys (`k8s/tls/*.key`)
- Modify files in `k8s/dev/postgres/` without understanding PVC implications
- Use non-monospace fonts in the UI
- Skip PropTypes on new components
- Push directly to main without PR
