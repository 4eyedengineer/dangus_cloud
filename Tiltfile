# Dangus Cloud - Kubernetes Development with Tilt
#
# Services:
#   - Frontend: React/Vite (http://dangus.192.168.1.124.nip.io)
#   - Backend: Node.js/Fastify API (http://api.dangus.192.168.1.124.nip.io)
#   - PostgreSQL: Database (internal only)
#
# Prerequisites:
#   1. Create GitHub OAuth app at https://github.com/settings/developers
#      - Homepage URL: http://dangus.192.168.1.124.nip.io
#      - Callback URL: http://api.dangus.192.168.1.124.nip.io/auth/github/callback
#   2. Create secrets:
#      kubectl create secret generic dangus-secrets \
#        --from-literal=GITHUB_CLIENT_ID=your_client_id \
#        --from-literal=GITHUB_CLIENT_SECRET=your_client_secret \
#        --from-literal=ENCRYPTION_KEY=$(openssl rand -base64 32) \
#        --from-literal=SESSION_SECRET=$(openssl rand -base64 32)

# ============================================================================
# Configuration
# ============================================================================

# Allow any k8s context
allow_k8s_contexts(k8s_context())

# Use Harbor registry for images
default_registry('harbor.192.168.1.124.nip.io/dangus')

# ============================================================================
# PostgreSQL (Database)
# ============================================================================

k8s_yaml([
    'k8s/dev/postgres/deployment.yaml',
    'k8s/dev/postgres/service.yaml',
])
k8s_resource('postgres', labels=['database'])

# ============================================================================
# RBAC and Secrets
# ============================================================================

k8s_yaml([
    'k8s/dev/rbac.yaml',
    'k8s/dev/secrets.yaml',
])

# ============================================================================
# Backend (Node.js/Fastify API)
# ============================================================================

docker_build(
    'dangus-backend',
    './backend',
    live_update=[
        sync('./backend/src', '/app/src'),
        sync('./backend/package.json', '/app/package.json'),
        run('npm install', trigger=['./backend/package.json']),
    ]
)

k8s_yaml([
    'k8s/dev/backend/deployment.yaml',
    'k8s/dev/backend/service.yaml',
    'k8s/dev/backend/ingress.yaml',
])
k8s_resource(
    'backend',
    resource_deps=['postgres'],
    labels=['api'],
    links=[
        link('http://api.dangus.192.168.1.124.nip.io', 'API'),
        link('http://api.dangus.192.168.1.124.nip.io/health', 'Health'),
    ]
)

# ============================================================================
# Frontend (React/Vite)
# ============================================================================

docker_build(
    'dangus-frontend',
    './frontend',
    live_update=[
        sync('./frontend/src', '/app/src'),
        sync('./frontend/public', '/app/public'),
        sync('./frontend/index.html', '/app/index.html'),
        sync('./frontend/package.json', '/app/package.json'),
        run('npm install', trigger=['./frontend/package.json']),
    ]
)

k8s_yaml([
    'k8s/dev/frontend/deployment.yaml',
    'k8s/dev/frontend/service.yaml',
    'k8s/dev/frontend/ingress.yaml',
])
k8s_resource(
    'frontend',
    resource_deps=['backend'],
    labels=['web'],
    links=[
        link('http://dangus.192.168.1.124.nip.io', 'Frontend App'),
    ]
)

# ============================================================================
# Startup Info
# ============================================================================

print("""
================================================================================
  Dangus Cloud - Kubernetes Development
================================================================================

  Services:
    Frontend:  http://dangus.192.168.1.124.nip.io
    Backend:   http://api.dangus.192.168.1.124.nip.io
    Health:    http://api.dangus.192.168.1.124.nip.io/health

  Hot-reload:
    - Edit frontend/src/* -> syncs instantly
    - Edit backend/src/* -> syncs and nodemon auto-reloads

  Setup secrets (if not done):
    kubectl create secret generic dangus-secrets \\
      --from-literal=GITHUB_CLIENT_ID=your_client_id \\
      --from-literal=GITHUB_CLIENT_SECRET=your_client_secret \\
      --from-literal=ENCRYPTION_KEY=$(openssl rand -base64 32) \\
      --from-literal=SESSION_SECRET=$(openssl rand -base64 32)

================================================================================
""")
