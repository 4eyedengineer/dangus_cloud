# Kubernetes Namespace Template for User Projects
#
# Template Variables:
#   namespace   - Full namespace name (e.g., `myproject`)
#   projectName - Project name

apiVersion: v1
kind: Namespace
metadata:
  name: "{{namespace}}"
  labels:
    app: dangus-cloud
    type: user-project
    project: "{{projectName}}"
