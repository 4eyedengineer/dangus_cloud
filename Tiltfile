# Dangus Cloud - Local Development with Tilt
# ============================================
#
# Prerequisites:
#   1. Copy .env.example to .env and fill in your GitHub OAuth credentials
#   2. Docker running
#   3. Node.js and npm installed
#
# Run with: tilt up

# PostgreSQL Database
# Uses docker-compose style approach to avoid container name conflicts
local_resource(
    'postgres',
    cmd='docker rm -f dangus-postgres 2>/dev/null || true',
    serve_cmd='docker run --rm --name dangus-postgres -e POSTGRES_USER=dangus -e POSTGRES_PASSWORD=dangus-dev-password -e POSTGRES_DB=dangus_cloud -p 5432:5432 postgres:15-alpine',
    readiness_probe=probe(
        tcp_socket=tcp_socket_action(5432),
        initial_delay_secs=5,
        period_secs=5,
    ),
    labels=['database'],
)

# Backend API
local_resource(
    'backend',
    cmd='cd backend && npm install',
    serve_cmd='cd backend && npm run dev',
    serve_dir='.',
    deps=['backend/src'],
    resource_deps=['postgres'],
    env={
        'PORT': '3001',
        'HOST': '0.0.0.0',
        'DATABASE_URL': 'postgres://dangus:dangus-dev-password@localhost:5432/dangus_cloud',
        'RUN_MIGRATIONS': 'true',
        'FRONTEND_URL': 'http://localhost:5173',
        'GITHUB_CLIENT_ID': os.getenv('GITHUB_CLIENT_ID', ''),
        'GITHUB_CLIENT_SECRET': os.getenv('GITHUB_CLIENT_SECRET', ''),
        'GITHUB_CALLBACK_URL': os.getenv('GITHUB_CALLBACK_URL', 'http://localhost:3001/auth/github/callback'),
        'ENCRYPTION_KEY': os.getenv('ENCRYPTION_KEY', 'dev-encryption-key-32-chars-long!'),
        'SESSION_SECRET': os.getenv('SESSION_SECRET', 'dev-session-secret-32-chars-long!'),
        'WEBHOOK_BASE_URL': 'http://localhost:3001/webhooks/github',
        'BASE_DOMAIN': 'localhost',
        'HARBOR_REGISTRY': os.getenv('HARBOR_REGISTRY', 'harbor.192.168.1.124.nip.io'),
        'REGISTRY_SECRET_NAME': 'harbor-registry-secret',
    },
    labels=['backend'],
    links=[
        link('http://localhost:3001/health', 'API Health'),
    ],
)

# Frontend (Vite dev server with proxy to backend)
local_resource(
    'frontend',
    cmd='cd frontend && npm install',
    serve_cmd='cd frontend && npm run dev',
    serve_dir='.',
    deps=['frontend/src'],
    resource_deps=['backend'],
    labels=['frontend'],
    links=[
        link('http://localhost:5173', 'Frontend'),
    ],
)
