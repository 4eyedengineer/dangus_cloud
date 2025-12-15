# TLDR: Running Dangus Cloud with Tilt

## Prerequisites
- k3s running on `192.168.1.124`
- Harbor registry at `harbor.192.168.1.124.nip.io`
- Docker logged into Harbor (`~/.docker/config.json`)

## Start Tilt
```bash
cd /home/garrett/projects/dangus_cloud
tilt up --stream
```

## Services
| Service | URL |
|---------|-----|
| Frontend | http://dangus.192.168.1.124.nip.io |
| Backend API | http://api.dangus.192.168.1.124.nip.io |
| Health Check | http://api.dangus.192.168.1.124.nip.io/health |
| Tilt UI | http://localhost:10350 |

## Test Endpoints
```bash
# Health check
curl http://api.dangus.192.168.1.124.nip.io/health
# Expected: {"status":"ok"}

# Auth (should redirect to GitHub)
curl -v http://api.dangus.192.168.1.124.nip.io/auth/github
# Expected: 302 redirect to github.com

# Frontend
curl http://dangus.192.168.1.124.nip.io/ | head -20
# Expected: HTML with "Dangus Cloud" title
```

## Check Pod Status
```bash
kubectl get pods
kubectl logs -l app=backend --tail=20
kubectl logs -l app=frontend --tail=20
```

## Live Reload
- Edit `backend/src/*` → auto-syncs, nodemon restarts
- Edit `frontend/src/*` → auto-syncs, Vite HMR updates

## Stop Tilt
```bash
tilt down
```

## Common Issues

**Harbor 401 Unauthorized**: Docker not logged in
```bash
docker login harbor.192.168.1.124.nip.io -u admin
```

**TLS certificate error**: Add to `/etc/docker/daemon.json`:
```json
{"insecure-registries": ["harbor.192.168.1.124.nip.io"]}
```
Then restart Docker.

**Backend crash "database plugin not registered"**: Fixed in commit 8d70e59

**Frontend "blocked host"**: Fixed in commit 8d70e59 (allowedHosts: true)
