# Development Guide

This guide covers setting up the development environment for Dangus Cloud.

## Prerequisites

- **Node.js** 18+
- **k3s** with kubectl configured
- **Tilt** for local Kubernetes development
- **Harbor** container registry running
- **GitHub OAuth App** configured

## Development Setup

### 1. Install Dependencies

The project uses Tilt for local development, which handles dependency installation automatically. However, you can install locally for IDE support:

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Configure Kubernetes Secrets

Before starting Tilt, create the required secrets:

```bash
kubectl create secret generic dangus-secrets \
  --from-literal=GITHUB_CLIENT_ID=your_client_id \
  --from-literal=GITHUB_CLIENT_SECRET=your_client_secret \
  --from-literal=ENCRYPTION_KEY=$(openssl rand -base64 32) \
  --from-literal=SESSION_SECRET=$(openssl rand -base64 32)
```

To update an existing secret:

```bash
kubectl delete secret dangus-secrets
# Then recreate with the command above
```

### 3. Start Tilt

```bash
tilt up --stream
```

This will:
- Build and deploy PostgreSQL
- Build and deploy the backend with live reload
- Build and deploy the frontend with hot module replacement
- Set up ingress routes

Access the Tilt UI at http://localhost:10350 to monitor builds and logs.

### 4. Access the Application

| Service | URL |
|---------|-----|
| Frontend | http://dangus.192.168.1.124.nip.io |
| Backend API | http://api.dangus.192.168.1.124.nip.io |
| Health Check | http://api.dangus.192.168.1.124.nip.io/health |
| Tilt UI | http://localhost:10350 |

## Database Migrations

Migrations run automatically on backend startup. To disable:

```bash
# Set in your environment or Kubernetes deployment
RUN_MIGRATIONS=false
```

### Migration Files

Located in `backend/migrations/`:

| File | Description |
|------|-------------|
| `001_create_users.sql` | Users table with GitHub OAuth data |
| `002_create_projects.sql` | Projects table |
| `003_create_services.sql` | Services table with deployment config |
| `004_create_env_vars.sql` | Encrypted environment variables |
| `005_create_deployments.sql` | Deployment history |

### Running Migrations Manually

```bash
# Connect to the backend pod
kubectl exec -it $(kubectl get pod -l app=dangus-backend -o jsonpath='{.items[0].metadata.name}') -- sh

# Run migrations
node src/migrate.js
```

### Database Access

```bash
# Port forward PostgreSQL
kubectl port-forward svc/postgres 5432:5432

# Connect with psql
psql -h localhost -U dangus -d dangus_cloud
# Password: dangus-dev-password
```

## Hot Reload Behavior

### Backend

- Uses `nodemon` for automatic restarts
- Watches `src/` directory for changes
- Syncs files to the container via Tilt live_update
- Restarts on `package.json` changes (runs `npm install`)

### Frontend

- Uses Vite's Hot Module Replacement (HMR)
- Changes to React components update instantly
- CSS changes apply without page reload
- Syncs `src/`, `public/`, and `index.html`

## Testing Locally

### Health Check

```bash
curl http://api.dangus.192.168.1.124.nip.io/health
# Expected: {"status":"ok"}
```

### Authentication Flow

1. Visit http://dangus.192.168.1.124.nip.io
2. Click "Login with GitHub"
3. Authorize the OAuth app
4. You'll be redirected back to the dashboard

### Test API Endpoints

```bash
# Get current user (requires session cookie)
curl -b cookies.txt http://api.dangus.192.168.1.124.nip.io/auth/me

# List projects
curl -b cookies.txt http://api.dangus.192.168.1.124.nip.io/projects

# Create a project
curl -X POST -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"name":"test-project"}' \
  http://api.dangus.192.168.1.124.nip.io/projects
```

## Common Troubleshooting

### Tilt won't start

**Problem**: `tilt up` fails with registry errors

**Solution**: Ensure Harbor is running and accessible:
```bash
curl -k https://harbor.192.168.1.124.nip.io/api/v2.0/ping
```

### Backend crashes on startup

**Problem**: Backend pod in CrashLoopBackOff

**Check logs**:
```bash
kubectl logs -l app=dangus-backend --tail=100
```

**Common causes**:
- Missing `dangus-secrets` - create the secret
- Database not ready - wait for PostgreSQL pod
- Invalid `ENCRYPTION_KEY` - must be base64-encoded 32 bytes

### Database connection errors

**Problem**: `ECONNREFUSED` or connection timeout

**Solutions**:
1. Check PostgreSQL pod status:
   ```bash
   kubectl get pods -l app=postgres
   ```
2. Check service exists:
   ```bash
   kubectl get svc postgres
   ```
3. Verify DATABASE_URL in backend deployment

### OAuth callback fails

**Problem**: "Invalid redirect_uri" from GitHub

**Solution**: Ensure the callback URL in GitHub OAuth app settings matches exactly:
```
http://api.dangus.192.168.1.124.nip.io/auth/github/callback
```

### Frontend shows blank page

**Problem**: White screen after loading

**Check browser console** for errors, common causes:
- API URL mismatch - check `VITE_API_URL` and `VITE_BACKEND_URL`
- CORS errors - ensure `FRONTEND_URL` is set correctly in backend
- JavaScript errors - check browser dev tools

### Changes not reflecting

**Problem**: Code changes don't appear

**Solutions**:
1. Check Tilt UI for sync status
2. Force rebuild:
   ```bash
   tilt trigger dangus-backend
   # or
   tilt trigger dangus-frontend
   ```
3. Check for sync errors in Tilt logs

## Stopping Development

```bash
# Stop Tilt (keeps resources running)
Ctrl+C

# Stop and remove all resources
tilt down
```

## Environment Variable Reference

See the main [README.md](../README.md#environment-variables) for the complete list.

## File Watching

Tilt watches these paths:

**Backend**:
- `backend/src/**` - Application code
- `backend/package.json` - Dependencies

**Frontend**:
- `frontend/src/**` - Application code
- `frontend/public/**` - Static assets
- `frontend/index.html` - HTML template
- `frontend/package.json` - Dependencies
