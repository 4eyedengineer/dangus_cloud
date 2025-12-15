# Dangus Cloud - Self-Hosted PaaS Platform

## Project Overview

Build a self-hosted Platform-as-a-Service (PaaS) application called **Dangus Cloud** that runs on a k3s Kubernetes cluster. The platform allows users to deploy containerized applications from GitHub repositories with minimal configuration - similar to Railway or Render, but self-hosted.

**Repository:** https://github.com/4eyedengineer/dangus_cloud

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Tailwind CSS (dark theme) |
| Backend | Node.js with Fastify |
| Database | PostgreSQL |
| Container Builds | Kaniko (runs as k8s Jobs) |
| Container Registry | Harbor (already running in cluster) |
| Ingress | Traefik (k3s default) |
| Persistent Storage | Longhorn PVC |
| Authentication | GitHub OAuth |

---

## Core Concepts

### User
- Authenticated via GitHub OAuth
- Each user gets a unique 6-character hash (e.g., `a1b2c3`) used for namespace and subdomain prefixing
- GitHub access token stored (encrypted) for cloning private repos

### Project
- Logical grouping of related services (like a full-stack app)
- Creates a dedicated Kubernetes namespace: `{user_hash}-{project_name}`
- One user can have multiple projects

### Service
- One GitHub repo, one Dockerfile, one deployed container
- A project can contain multiple services (frontend, backend, worker, etc.)
- Each service gets a subdomain: `{user_hash}-{service_name}.dangus.cloud`

### Deployment
- Represents a single build + release of a service
- Tracks commit SHA, build status, logs, and image tag
- Maintains deployment history

---

## MVP Features

### Authentication
- GitHub OAuth for login (no separate signup)
- Use the same OAuth token for repo access
- Session management with secure cookies or JWTs

### Project Management
- Create new project (validates name, creates k8s namespace)
- List user's projects
- Delete project (removes namespace and all resources)

### Service Management
- Add service to project:
  - Connect GitHub repo URL
  - Configure branch (default: `main`)
  - Configure Dockerfile path (default: `Dockerfile`)
  - Set container port to expose
  - Storage allocation slider: 1-10 GB (optional, creates Longhorn PVC mounted at `/data`)
  - Health check endpoint (optional, disabled by default)
- Generate unique webhook URL + secret for each service
- User manually adds webhook to their GitHub repo settings
- List services in project with status
- Delete service (removes deployment, service, ingress, PVC)

### Environment Variables
- Add/edit/delete environment variables per service
- Values stored encrypted in database
- Injected into container at runtime

### Build Pipeline
- Triggered by GitHub webhook (push to configured branch)
- Kaniko Job workflow:
  1. Clone repo using GitHub token
  2. Build Dockerfile
  3. Push image to Harbor (tag: `harbor.local/{namespace}/{service}:{commit_sha}`)
  4. Update deployment with new image
- Build logs captured and stored

### Service Discovery Panel
- When viewing a project, show internal DNS names for all services
- Format: `http://{service_name}:{port}` (k8s service DNS within namespace)
- Copy button for each

### Deployment Status
- Track status: `pending` → `building` → `deploying` → `live` | `failed`
- Show current status in UI
- Basic deployment history (list of past deployments with commit SHA and timestamp)

---

## Data Model

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  github_username VARCHAR(255) NOT NULL,
  github_access_token TEXT NOT NULL, -- encrypted
  hash VARCHAR(6) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(63) NOT NULL, -- k8s namespace limit
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);
-- Note: namespace is computed as {user.hash}-{name}

-- Services table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(63) NOT NULL,
  repo_url TEXT NOT NULL,
  branch VARCHAR(255) DEFAULT 'main',
  dockerfile_path VARCHAR(255) DEFAULT 'Dockerfile',
  port INTEGER NOT NULL,
  storage_gb INTEGER CHECK (storage_gb >= 1 AND storage_gb <= 10), -- nullable
  health_check_path VARCHAR(255), -- nullable, e.g., /health
  webhook_secret VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, name)
);
-- Note: subdomain is computed as {user.hash}-{name}

-- Environment variables table
CREATE TABLE env_vars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value TEXT NOT NULL, -- encrypted
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(service_id, key)
);

-- Deployments table
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  commit_sha VARCHAR(40) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, building, deploying, live, failed
  image_tag TEXT,
  build_logs TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Repository Structure

```
dangus_cloud/
├── Tiltfile                     # Tilt development configuration
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── ProjectDetail.jsx
│   │   │   └── ServiceDetail.jsx
│   │   ├── hooks/
│   │   ├── api/
│   │   │   └── projects.js      # API client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── Dockerfile
│
├── backend/                     # Fastify API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js          # GitHub OAuth
│   │   │   ├── projects.js
│   │   │   ├── services.js
│   │   │   ├── deployments.js
│   │   │   └── webhooks.js      # GitHub webhook handler
│   │   ├── services/
│   │   │   ├── kubernetes.js    # k8s API interactions
│   │   │   ├── github.js        # GitHub API client (TODO)
│   │   │   └── encryption.js    # Token/secret encryption
│   │   ├── plugins/
│   │   │   ├── database.js      # PostgreSQL connection
│   │   │   └── auth.js          # Auth middleware (TODO)
│   │   └── server.js
│   ├── package.json
│   └── Dockerfile
│
├── k8s/                         # Platform k8s manifests (for Tilt)
│   ├── namespace.yaml
│   ├── postgres.yaml            # PostgreSQL Deployment + PVC
│   ├── backend.yaml             # Backend Deployment + Service + RBAC
│   ├── frontend.yaml            # Frontend Deployment + Service
│   └── ingress.yaml             # Traefik Ingress routes
│
├── templates/                   # Templates for user deployments (TODO)
│   ├── namespace.yaml.tpl
│   ├── deployment.yaml.tpl
│   ├── service.yaml.tpl
│   ├── ingress.yaml.tpl
│   ├── pvc.yaml.tpl
│   └── kaniko-job.yaml.tpl
│
├── dangus_cloud_prompt.md       # This specification
└── README.md
```

---

## Kubernetes Templates

The backend will use these templates to generate k8s manifests for user deployments. Use simple string interpolation or a templating library.

### Key Template Variables
- `{{namespace}}` - `{user_hash}-{project_name}`
- `{{service_name}}` - Service name
- `{{image}}` - Full Harbor image path with tag
- `{{port}}` - Container port
- `{{subdomain}}` - `{user_hash}-{service_name}`
- `{{storage_gb}}` - PVC size
- `{{health_check_path}}` - Optional health endpoint
- `{{env_vars}}` - Array of {key, value} pairs

### Kaniko Job Template Notes
- Use `gcr.io/kaniko-project/executor:latest`
- Mount GitHub token as secret for private repos
- Push to `harbor.local/dangus/{namespace}/{service}:{commit_sha}`
- Job name should include timestamp or commit SHA for uniqueness

---

## API Endpoints

### Auth
- `GET /auth/github` - Redirect to GitHub OAuth
- `GET /auth/github/callback` - OAuth callback, create/update user, set session
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Clear session

### Projects
- `GET /projects` - List user's projects
- `POST /projects` - Create project
- `GET /projects/:id` - Get project details with services
- `DELETE /projects/:id` - Delete project and all resources

### Services
- `POST /projects/:projectId/services` - Create service
- `GET /services/:id` - Get service details
- `PATCH /services/:id` - Update service config (branch, dockerfile path, health check, etc.)
- `DELETE /services/:id` - Delete service
- `POST /services/:id/deploy` - Manual deploy trigger

### Environment Variables
- `GET /services/:serviceId/env` - List env vars (values masked)
- `POST /services/:serviceId/env` - Add env var
- `PATCH /services/:serviceId/env/:id` - Update env var
- `DELETE /services/:serviceId/env/:id` - Delete env var

### Deployments
- `GET /services/:serviceId/deployments` - List deployment history
- `GET /deployments/:id` - Get deployment details with logs

### Webhooks
- `POST /webhooks/github/:serviceId` - GitHub webhook receiver (validates secret, triggers build)

---

## Configuration / Environment Variables

### Backend
```env
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/dangus_cloud

# GitHub OAuth
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_CALLBACK_URL=https://dangus.cloud/auth/github/callback

# Encryption key for tokens/secrets (32 bytes, base64)
ENCRYPTION_KEY=xxx

# Session secret
SESSION_SECRET=xxx

# Kubernetes
KUBECONFIG=/path/to/kubeconfig  # or use in-cluster config

# Harbor
HARBOR_URL=https://harbor.local
HARBOR_PROJECT=dangus

# App
BASE_DOMAIN=dangus.cloud
WEBHOOK_BASE_URL=https://dangus.cloud/webhooks/github
```

---

## Implementation Notes

### User Hash Generation
- Generate a unique 6-character alphanumeric hash for each user
- Use lowercase only for k8s compatibility
- Check for collisions before saving

### Encryption
- Use AES-256-GCM for encrypting GitHub tokens and env var values
- Store IV with ciphertext (prepend or separate column)

### Kubernetes Interaction
- Use `@kubernetes/client-node` npm package
- Apply manifests using the API (create/patch/delete)
- Watch for Job completion when building

### Kaniko Build Flow
1. Receive webhook, validate secret
2. Create deployment record (status: `pending`)
3. Generate Kaniko Job manifest
4. Apply Job to user's namespace (status: `building`)
5. Watch Job until complete
6. On success: Update deployment with image tag, apply new Deployment manifest (status: `deploying` → `live`)
7. On failure: Capture logs, update status to `failed`

### Traefik Ingress
- Use `IngressRoute` CRD (Traefik-specific) or standard `Ingress` with annotations
- Match on `Host(\`{subdomain}.dangus.cloud\`)`
- Route to Service in user's namespace

### CORS
- Frontend served separately, needs CORS configured on backend
- Or serve frontend as static files from backend

---

## Development Setup (Tilt)

Development uses **Tilt** to run all services in the k3s cluster with hot-reload capabilities. This approach ensures the development environment matches production exactly.

### Prerequisites
- Tilt CLI installed (`/home/garrett/.local/bin/tilt`)
- kubectl configured for the k3s cluster
- Harbor registry accessible at `harbor.192.168.1.124.nip.io`

### Quick Start
```bash
cd /home/garrett/projects/dangus_cloud
tilt up --host 0.0.0.0
```

### Access URLs
| Service | URL |
|---------|-----|
| Frontend | http://dangus.192.168.1.124.nip.io |
| Backend API | http://api.dangus.192.168.1.124.nip.io |
| Tilt UI | http://localhost:10350 (or via ingress) |
| PostgreSQL | localhost:5432 (port-forwarded) |

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     k3s Cluster                              │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐           │
│  │ Frontend │───▶│ Backend  │───▶│  PostgreSQL  │           │
│  │ (React)  │    │ (Fastify)│    │              │           │
│  │  :3000   │    │  :3001   │    │    :5432     │           │
│  └──────────┘    └──────────┘    └──────────────┘           │
│       │               │                                      │
│       │               ▼                                      │
│       │         ┌──────────┐                                │
│       │         │ k8s API  │ (for user deployments)         │
│       │         └──────────┘                                │
│       │                                                      │
│  ┌────┴─────────────────────────────────────────────┐       │
│  │              Traefik Ingress                      │       │
│  │  dangus.192.168.1.124.nip.io → frontend:3000     │       │
│  │  api.dangus.192.168.1.124.nip.io → backend:3001  │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### How Tilt Works

Unlike traditional local development (running `npm run dev` in terminals), Tilt runs everything in Kubernetes:

| Traditional Local Dev | Tilt Development |
|-----------------------|------------------|
| `npm run dev` in terminal | Container runs dev server |
| Edit file → process reloads | Edit file → Tilt syncs to container → process reloads |
| `docker run postgres` | PostgreSQL pod in k8s |
| `localhost:3000` | `dangus.192.168.1.124.nip.io` |
| Separate from production | Same k8s patterns as production |

### Live Update (Hot Reload)

Tilt watches your local files and syncs changes into running containers:

**Frontend:**
- `src/` changes sync instantly → Vite HMR reloads
- `package.json` changes trigger `npm install` in container

**Backend:**
- `src/` changes sync → nodemon restarts server
- `package.json` changes trigger `npm install` in container

**PostgreSQL:**
- No live sync needed (database container)
- Data persists in Longhorn PVC

### Tilt Commands

```bash
# Start development
tilt up --host 0.0.0.0

# Stop and remove resources
tilt down

# View logs for a specific resource
tilt logs backend

# Trigger manual rebuild
tilt trigger backend
```

### Tilt UI

The Tilt UI (http://localhost:10350) shows:
- Build status for each service
- Live logs
- Resource health
- Dependency graph

Keyboard shortcuts:
- `r` - Trigger rebuild of selected resource
- `j/k` - Navigate resources
- `l` - View logs

### Environment Variables

Development environment variables are configured in k8s manifests:

- `k8s/backend.yaml` - Contains ConfigMap and Secret for backend
- `k8s/frontend.yaml` - Contains ConfigMap for frontend

**Important:** Before first run, update `k8s/backend.yaml` with:
- Valid GitHub OAuth credentials (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)
- Generated encryption key (`openssl rand -base64 32`)
- Generated session secret (`openssl rand -base64 32`)

### Database Access

PostgreSQL is port-forwarded to localhost:5432 for direct access:

```bash
# Connect via psql
psql postgres://dangus:dangus-dev-password@localhost:5432/dangus_cloud

# Or use any PostgreSQL client
Host: localhost
Port: 5432
Database: dangus_cloud
User: dangus
Password: dangus-dev-password
```

### Service Communication

Within the cluster, services communicate via Kubernetes DNS:
- Frontend → Backend: `http://backend:3001`
- Backend → PostgreSQL: `postgres://dangus:...@postgres:5432/dangus_cloud`

The backend runs with a ServiceAccount that has RBAC permissions to create namespaces, deployments, jobs, etc. for user projects.

### Troubleshooting

**Images not pushing to Harbor:**
- Ensure Harbor is accessible: `curl http://harbor.192.168.1.124.nip.io/api/v2.0/health`
- Check Docker daemon has insecure registry configured

**Pod not starting:**
- Check logs: `tilt logs <resource>`
- Check pod events: `kubectl describe pod <pod-name>`

**Database connection failed:**
- Ensure postgres pod is running: `kubectl get pods -l app=postgres`
- Check if PVC is bound: `kubectl get pvc postgres-pvc`

**Live sync not working:**
- Check Tilt UI for sync errors
- Ensure file patterns match Tiltfile configuration

---

## UI Pages (Minimal)

1. **Login** - "Sign in with GitHub" button
2. **Dashboard** - List of projects, "New Project" button
3. **Project Detail** - List of services, service discovery panel, "Add Service" button
4. **Service Detail** - Config, env vars, deployment history, status, webhook URL to copy
5. **New/Edit Service Form** - Repo URL, branch, Dockerfile path, port, storage slider, health check toggle

### Design Notes
- Dark theme (Tailwind's dark mode)
- Clean and functional, not flashy
- Status indicators: colored dots or badges (green=live, yellow=building, red=failed)

---

## Future Enhancements (Out of Scope for MVP)
- Custom domain support (BYOD)
- Log streaming/viewing in UI
- Resource limits (CPU/memory)
- Rollback to previous deployment
- Multiple replicas/scaling
- MinIO integration for S3-compatible storage
- Build caching
- Monorepo support (multiple Dockerfiles)
- Team/org accounts