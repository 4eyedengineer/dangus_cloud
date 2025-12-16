# API Reference

Base URL: `http://api.dangus.192.168.1.124.nip.io`

## Authentication

The API uses session-based authentication via GitHub OAuth. After authenticating, a session cookie is set that must be included in subsequent requests.

### Login Flow

1. Redirect user to `GET /auth/github`
2. User authorizes on GitHub
3. GitHub redirects to callback URL
4. Session cookie is set
5. User is redirected to frontend

## Endpoints

### Health

#### GET /health

Check API health status.

**Authentication**: None

**Response**: `200 OK`
```json
{
  "status": "ok"
}
```

---

### Authentication

#### GET /auth/github

Redirect to GitHub OAuth authorization.

**Authentication**: None

**Response**: `302 Redirect` to GitHub

---

#### GET /auth/github/callback

Handle GitHub OAuth callback. Sets session cookie on success.

**Authentication**: None

**Query Parameters**:
- `code` - Authorization code from GitHub
- `state` - CSRF state token

**Response**: `302 Redirect` to frontend

**Errors**:
- `400` - Invalid state or missing code

---

#### GET /auth/me

Get current authenticated user.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "github_id": 12345678,
  "github_username": "username",
  "hash": "a1b2c3",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Errors**:
- `401` - Not authenticated

---

#### POST /auth/logout

Clear session and log out.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "message": "Logged out"
}
```

---

### Projects

#### GET /projects

List all projects for the authenticated user.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "my-project",
      "namespace": "a1b2c3-my-project",
      "created_at": "2024-01-01T00:00:00.000Z",
      "service_count": 2
    }
  ]
}
```

---

#### POST /projects

Create a new project.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "my-project"
}
```

**Validation**:
- `name`: Required, 1-50 characters, lowercase alphanumeric and hyphens only, must start/end with alphanumeric

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "name": "my-project",
  "namespace": "a1b2c3-my-project",
  "created_at": "2024-01-01T00:00:00.000Z",
  "service_count": 0
}
```

**Errors**:
- `400` - Invalid name format
- `409` - Project name already exists

---

#### GET /projects/:id

Get project details with services.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "my-project",
  "namespace": "a1b2c3-my-project",
  "created_at": "2024-01-01T00:00:00.000Z",
  "services": [
    {
      "id": "uuid",
      "name": "api",
      "repo_url": "https://github.com/owner/repo",
      "status": "live"
    }
  ]
}
```

**Errors**:
- `404` - Project not found

---

#### DELETE /projects/:id

Delete a project and all its services.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "message": "Project deleted"
}
```

**Errors**:
- `404` - Project not found

---

### Services

#### POST /projects/:projectId/services

Create a new service in a project.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "api",
  "repo_url": "https://github.com/owner/repo",
  "image": null,
  "port": 3000,
  "branch": "main",
  "dockerfile_path": "Dockerfile",
  "build_context": null,
  "replicas": 1,
  "storage_gb": 5,
  "health_check_path": "/health"
}
```

**Validation**:
- `name`: Required, 1-63 characters, lowercase alphanumeric and hyphens
- `repo_url`: Required if `image` not provided, valid GitHub URL
- `image`: Required if `repo_url` not provided, direct container image reference
- `port`: Required, 1-65535
- `branch`: Optional, default "main"
- `dockerfile_path`: Optional, default "Dockerfile"
- `build_context`: Optional, subdirectory for monorepo builds
- `replicas`: Optional, 1-3, default 1
- `storage_gb`: Optional, 1-10
- `health_check_path`: Optional

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "name": "api",
  "project_id": "uuid",
  "repo_url": "https://github.com/owner/repo",
  "branch": "main",
  "dockerfile_path": "Dockerfile",
  "port": 3000,
  "storage_gb": 5,
  "health_check_path": "/health",
  "webhook_secret": "abc123...",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Errors**:
- `400` - Invalid input
- `403` - No access to repository
- `404` - Project not found
- `409` - Service name already exists in project

---

#### POST /projects/:projectId/services/batch

Create multiple services at once (max 10).

**Authentication**: Required

**Request Body**:
```json
{
  "services": [
    {
      "name": "api",
      "repo_url": "https://github.com/owner/repo",
      "port": 3000,
      "dockerfile_path": "Dockerfile"
    },
    {
      "name": "db",
      "image": "postgres:15",
      "port": 5432
    }
  ]
}
```

**Response**: `201 Created`
```json
{
  "created": [
    { "id": "uuid", "name": "api", "subdomain": "a1b2c3-api" },
    { "id": "uuid", "name": "db", "subdomain": "a1b2c3-db" }
  ],
  "errors": [],
  "summary": {
    "requested": 2,
    "created": 2,
    "failed": 0
  }
}
```

**Errors**:
- `400` - Invalid input or more than 10 services
- `404` - Project not found

---

#### GET /services/:id

Get service details with latest deployment.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "api",
  "project_id": "uuid",
  "repo_url": "https://github.com/owner/repo",
  "image": null,
  "branch": "main",
  "dockerfile_path": "Dockerfile",
  "build_context": null,
  "port": 3000,
  "replicas": 1,
  "storage_gb": 5,
  "health_check_path": "/health",
  "created_at": "2024-01-01T00:00:00.000Z",
  "subdomain": "a1b2c3-api",
  "url": "http://a1b2c3-api.192.168.1.124.nip.io",
  "webhook_url": "http://api.dangus.192.168.1.124.nip.io/webhooks/github/uuid",
  "latest_deployment": {
    "id": "uuid",
    "status": "live",
    "commit_sha": "abc123",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors**:
- `404` - Service not found

---

#### PATCH /services/:id

Update service configuration.

**Authentication**: Required

**Request Body** (all fields optional):
```json
{
  "branch": "develop",
  "dockerfile_path": "docker/Dockerfile",
  "port": 8080,
  "storage_gb": 10,
  "health_check_path": "/healthz"
}
```

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "api",
  "branch": "develop",
  "dockerfile_path": "docker/Dockerfile",
  "port": 8080,
  "storage_gb": 10,
  "health_check_path": "/healthz"
}
```

**Errors**:
- `400` - Invalid input
- `404` - Service not found

---

#### DELETE /services/:id

Delete a service and its Kubernetes resources.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "message": "Service deleted"
}
```

**Errors**:
- `404` - Service not found

---

#### POST /services/:id/deploy

Trigger a manual deployment.

**Authentication**: Required

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "service_id": "uuid",
  "status": "pending",
  "commit_sha": "abc123",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Errors**:
- `404` - Service not found

---

#### GET /services/:id/webhook-secret

Get webhook URL and secret for GitHub integration.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "webhook_url": "http://api.dangus.192.168.1.124.nip.io/webhooks/github/uuid",
  "webhook_secret": "abc123..."
}
```

**Errors**:
- `404` - Service not found

---

### Environment Variables

#### GET /services/:serviceId/env

List environment variables for a service (values masked).

**Authentication**: Required

**Response**: `200 OK`
```json
[
  {
    "id": "uuid",
    "key": "DATABASE_URL",
    "value": "********",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

---

#### POST /services/:serviceId/env

Create an environment variable.

**Authentication**: Required

**Request Body**:
```json
{
  "key": "DATABASE_URL",
  "value": "postgres://user:pass@host:5432/db"
}
```

**Validation**:
- `key`: Required, uppercase, starts with letter, alphanumeric and underscores only
- `value`: Required, any string

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "key": "DATABASE_URL",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Errors**:
- `400` - Invalid key format
- `404` - Service not found
- `409` - Key already exists

---

#### PATCH /services/:serviceId/env/:id

Update an environment variable value.

**Authentication**: Required

**Request Body**:
```json
{
  "value": "new-value"
}
```

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "key": "DATABASE_URL",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

**Errors**:
- `404` - Environment variable not found

---

#### DELETE /services/:serviceId/env/:id

Delete an environment variable.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "message": "Environment variable deleted"
}
```

**Errors**:
- `404` - Environment variable not found

---

#### GET /services/:serviceId/env/:id/value

Reveal the decrypted value of an environment variable.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "value": "postgres://user:pass@host:5432/db"
}
```

**Errors**:
- `404` - Environment variable not found

---

### Deployments

#### GET /services/:serviceId/deployments

List deployment history for a service.

**Authentication**: Required

**Query Parameters**:
- `limit`: 1-100, default 20
- `offset`: default 0

**Response**: `200 OK`
```json
{
  "deployments": [
    {
      "id": "uuid",
      "status": "live",
      "commit_sha": "abc123",
      "image_tag": "abc123",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

---

#### GET /deployments/:id

Get deployment details with build logs.

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "service_id": "uuid",
  "status": "live",
  "commit_sha": "abc123",
  "image_tag": "abc123",
  "build_logs": "Step 1/10: FROM node:18...",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:05:00.000Z"
}
```

**Errors**:
- `404` - Deployment not found

---

### Webhooks

#### POST /webhooks/github/:serviceId

Handle GitHub push webhook.

**Authentication**: HMAC SHA-256 signature verification

**Headers**:
- `X-Hub-Signature-256`: GitHub webhook signature
- `X-GitHub-Event`: Event type (must be "push")

**Request Body**: GitHub push event payload

**Response**: `200 OK`
```json
{
  "message": "Deployment triggered",
  "deployment_id": "uuid"
}
```

**Errors**:
- `400` - Invalid signature or unsupported event
- `404` - Service not found

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "statusCode": 400
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Not authenticated |
| 403 | Forbidden - No permission |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |

## Deployment Status Values

| Status | Description |
|--------|-------------|
| `pending` | Deployment created, waiting to build |
| `building` | Docker image being built |
| `deploying` | Image built, deploying to Kubernetes |
| `live` | Successfully deployed and running |
| `failed` | Build or deployment failed |
