# Kubernetes Deployment Template for User Services
#
# Template Variables:
#   namespace        - Kubernetes namespace for the deployment
#   serviceName      - Name of the service (used for deployment, labels, selectors)
#   image            - Full container image path with tag (e.g., registry/app:v1.0.0)
#   port             - Container port to expose
#   replicas         - Number of pod replicas (1-3, default: 1)
#   envVars          - Array of environment variables [{name, value}]
#   healthCheckPath  - Optional: HTTP path for health check probe (e.g., /health)
#   storageMountPath - Optional: Mount path for PVC (default: /data when enabled)
#   storageClaimName - Optional: PVC name if persistent storage is enabled
#
# Resource Defaults:
#   Memory: 256Mi (request and limit)
#   CPU: 250m (request and limit)
#
# Update Strategy:
#   Rolling update with maxSurge: 1, maxUnavailable: 0
#   Ensures zero-downtime deployments

apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{serviceName}}
  namespace: {{namespace}}
  labels:
    app: {{serviceName}}
    managed-by: dangus-cloud
spec:
  replicas: {{replicas}}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: {{serviceName}}
  template:
    metadata:
      labels:
        app: {{serviceName}}
    spec:
      containers:
        - name: {{serviceName}}
          image: {{image}}
          imagePullPolicy: Always
          ports:
            - containerPort: {{port}}
              protocol: TCP
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "256Mi"
              cpu: "250m"
          {{#envVars}}
          env:
            {{#each envVars}}
            - name: {{name}}
              value: "{{value}}"
            {{/each}}
          {{/envVars}}
          {{#healthCheckPath}}
          livenessProbe:
            httpGet:
              path: {{healthCheckPath}}
              port: {{port}}
            initialDelaySeconds: 15
            periodSeconds: 20
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: {{healthCheckPath}}
              port: {{port}}
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          {{/healthCheckPath}}
          {{#storageClaimName}}
          volumeMounts:
            - name: data-volume
              mountPath: {{storageMountPath}}
          {{/storageClaimName}}
      {{#storageClaimName}}
      volumes:
        - name: data-volume
          persistentVolumeClaim:
            claimName: {{storageClaimName}}
      {{/storageClaimName}}
