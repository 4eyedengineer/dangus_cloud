# Kubernetes Namespace Template for User Projects
#
# Template Variables:
#   namespace   - Full namespace name (e.g., `a1b2c3-myapp`)
#   userHash    - User's 6-char hash
#   projectName - Project name

apiVersion: v1
kind: Namespace
metadata:
  name: "{{namespace}}"
  labels:
    app: dangus-cloud
    type: user-project
    user-hash: "{{userHash}}"
    project: "{{projectName}}"
