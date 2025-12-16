# Kubernetes Job Template for Kaniko Docker Image Builds
#
# Template Variables:
#   namespace          - Kubernetes namespace for the job
#   jobName            - Unique job name (should include timestamp or commit SHA)
#   repoUrl            - GitHub repository URL (e.g., github.com/owner/repo)
#   branch             - Git branch to build from
#   commitSha          - Specific commit SHA to build
#   dockerfilePath     - Path to Dockerfile within the repository (e.g., ./Dockerfile)
#   imageDest          - Full destination image path (e.g., harbor.example.com/project/image:tag)
#   gitSecretName      - Name of Kubernetes secret containing git credentials
#   registrySecretName - Name of Kubernetes secret containing registry credentials
#
# Secrets Required:
#   Git Secret (gitSecretName):
#     - GIT_USERNAME: GitHub username or token name
#     - GIT_PASSWORD: GitHub personal access token
#
#   Registry Secret (registrySecretName):
#     - config.json: Docker registry config for Harbor authentication
#
# Resource Defaults:
#   Memory: 2Gi (request), 4Gi (limit)
#   CPU: 500m (request), 2000m (limit)
#
# Job Cleanup:
#   TTL: 3600 seconds (1 hour) after completion

apiVersion: batch/v1
kind: Job
metadata:
  name: {{jobName}}
  namespace: {{namespace}}
  labels:
    app: kaniko-build
    managed-by: dangus-cloud
    commit-sha: {{commitSha}}
spec:
  ttlSecondsAfterFinished: 3600
  backoffLimit: 2
  activeDeadlineSeconds: 1800
  template:
    metadata:
      labels:
        app: kaniko-build
        job-name: {{jobName}}
    spec:
      restartPolicy: Never
      initContainers:
        - name: git-clone
          image: alpine/git:latest
          env:
            - name: GIT_USERNAME
              valueFrom:
                secretKeyRef:
                  name: {{gitSecretName}}
                  key: GIT_USERNAME
            - name: GIT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{gitSecretName}}
                  key: GIT_PASSWORD
          command:
            - /bin/sh
            - -c
            - |
              git clone --single-branch --branch {{branch}} \
                https://${GIT_USERNAME}:${GIT_PASSWORD}@{{repoUrl}} /workspace && \
              cd /workspace && \
              git checkout {{commitSha}}
          volumeMounts:
            - name: workspace
              mountPath: /workspace
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
      containers:
        - name: kaniko
          image: gcr.io/kaniko-project/executor:latest
          args:
            - "--dockerfile={{dockerfilePath}}"
            - "--context=dir:///workspace"
            - "--destination={{imageDest}}"
            - "--cache=true"
            - "--cache-ttl=24h"
            - "--snapshot-mode=redo"
            - "--log-format=text"
            - "--skip-tls-verify"
          volumeMounts:
            - name: workspace
              mountPath: /workspace
            - name: docker-config
              mountPath: /kaniko/.docker
              readOnly: true
          resources:
            requests:
              memory: "2Gi"
              cpu: "500m"
            limits:
              memory: "4Gi"
              cpu: "2000m"
      volumes:
        - name: workspace
          emptyDir: {}
        - name: docker-config
          secret:
            secretName: {{registrySecretName}}
            items:
              - key: config.json
                path: config.json
