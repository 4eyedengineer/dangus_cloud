# Dangus Cloud

A self-hosted Platform-as-a-Service (PaaS) for deploying containerized applications from GitHub repositories. Deploy your apps with minimal configuration - similar to Railway or Render, but running on your own infrastructure.

## Features

- **GitHub Integration**: Connect repositories and deploy with automatic webhook triggers
- **Container Builds**: Automatic Docker image builds from your Dockerfiles
- **Kubernetes Native**: Runs on k3s with Traefik ingress
- **Environment Variables**: Secure encrypted storage for application secrets
- **Deployment History**: Track all deployments with build logs and status
- **Terminal UI**: Retro terminal-themed interface with dark mode

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Browser                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Traefik Ingress Controller                      │
│         dangus.192.168.1.124.nip.io  │  api.dangus.192.168.1.124.nip.io │
└─────────────────────────────────────────────────────────────────────┘
                    │                               │
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │     Frontend      │           │      Backend      │
        │   React + Vite    │◄─────────►│  Node.js/Fastify  │
        │   Tailwind CSS    │           │     Port 3001     │
        └───────────────────┘           └───────────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
        │    PostgreSQL     │       │      Harbor       │       │   Kubernetes API  │
        │    Database       │       │  Container Registry│       │   (k3s cluster)   │
        └───────────────────┘       └───────────────────┘       └───────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Tailwind CSS, Vite |
| Backend | Node.js, Fastify 4 |
| Database | PostgreSQL 15 |
| Auth | GitHub OAuth |
| Registry | Harbor |
| Orchestration | Kubernetes (k3s) |
| Ingress | Traefik |
| Storage | Longhorn PVC |
| Development | Tilt |

## Prerequisites

Before running Dangus Cloud, you need:

1. **k3s** - Lightweight Kubernetes distribution
   ```bash
   curl -sfL https://get.k3s.io | sh -
   ```

2. **Harbor** - Container registry for storing built images
   - Running at `harbor.192.168.1.124.nip.io`
   - Project `dangus` created

3. **Longhorn** - Distributed storage for persistent volumes
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/longhorn/longhorn/master/deploy/longhorn.yaml
   ```

4. **Traefik** - Ingress controller (included with k3s)

5. **Tilt** - Local Kubernetes development tool
   ```bash
   curl -fsSL https://raw.githubusercontent.com/tilt-dev/tilt/master/scripts/install.sh | bash
   ```

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/4eyedengineer/dangus_cloud.git
cd dangus_cloud
```

### 2. Create Kubernetes Secrets

```bash
kubectl create secret generic dangus-secrets \
  --from-literal=GITHUB_CLIENT_ID=your_github_client_id \
  --from-literal=GITHUB_CLIENT_SECRET=your_github_client_secret \
  --from-literal=ENCRYPTION_KEY=$(openssl rand -base64 32) \
  --from-literal=SESSION_SECRET=$(openssl rand -base64 32)
```

### 3. Set Up GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App:
   - **Application name**: Dangus Cloud
   - **Homepage URL**: `http://dangus.192.168.1.124.nip.io`
   - **Authorization callback URL**: `http://api.dangus.192.168.1.124.nip.io/auth/github/callback`
3. Copy the Client ID and Client Secret to your Kubernetes secret

### 4. Start with Tilt

```bash
tilt up --stream
```

### 5. Access the Application

- **Frontend**: http://dangus.192.168.1.124.nip.io
- **Backend API**: http://api.dangus.192.168.1.124.nip.io
- **Health Check**: http://api.dangus.192.168.1.124.nip.io/health
- **Tilt UI**: http://localhost:10350

## Environment Variables

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `PORT` | No | 3001 | Backend server port |
| `HOST` | No | 0.0.0.0 | Backend server host |
| `FRONTEND_URL` | No | http://localhost:5173 | Frontend URL for CORS |
| `GITHUB_CLIENT_ID` | Yes | - | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes | - | GitHub OAuth app client secret |
| `GITHUB_CALLBACK_URL` | No | - | OAuth callback URL |
| `ENCRYPTION_KEY` | Yes | - | Base64-encoded 32-byte key for AES-256-GCM |
| `SESSION_SECRET` | Yes | - | Secret for signing session cookies |
| `HARBOR_URL` | No | - | Harbor registry URL |
| `HARBOR_PROJECT` | No | - | Harbor project name |
| `BASE_DOMAIN` | No | - | Base domain for service ingress |
| `WEBHOOK_BASE_URL` | No | - | Base URL for webhook callbacks |
| `RUN_MIGRATIONS` | No | true | Set to "false" to skip migrations |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | /api | Backend API base URL |
| `VITE_BACKEND_URL` | No | http://localhost:3001 | Full backend URL for OAuth |

## Project Structure

```
dangus_cloud/
├── backend/
│   ├── src/
│   │   ├── server.js           # Main entry point
│   │   ├── routes/             # API endpoints
│   │   ├── plugins/            # Fastify plugins
│   │   └── services/           # Business logic
│   ├── migrations/             # SQL migrations
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/              # Page components
│   │   ├── components/         # Reusable UI components
│   │   └── api/                # API client functions
│   ├── package.json
│   └── Dockerfile
├── k8s/
│   └── dev/                    # Kubernetes manifests
├── docs/
│   ├── DEVELOPMENT.md          # Development guide
│   └── API.md                  # API reference
├── Tiltfile                    # Tilt configuration
└── README.md
```

## Documentation

- [Development Guide](docs/DEVELOPMENT.md) - Setting up the development environment
- [API Reference](docs/API.md) - Complete API documentation

## License

MIT
