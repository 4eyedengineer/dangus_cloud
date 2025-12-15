# Kubernetes PersistentVolumeClaim Template for User Projects
#
# Template Variables:
#   {{namespace}}   - Kubernetes namespace (e.g., `a1b2c3-myapp`)
#   {{serviceName}} - Service name for the PVC
#   {{storageGb}}   - Storage size in GB (1-10)

apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: "{{serviceName}}-data"
  namespace: "{{namespace}}"
  labels:
    app: "{{serviceName}}"
spec:
  storageClassName: longhorn
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: "{{storageGb}}Gi"
