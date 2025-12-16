# Kubernetes Service Template for User Projects
#
# Template Variables:
#   namespace   - Kubernetes namespace (e.g., `a1b2c3-myapp`)
#   serviceName - Service name
#   port        - Container/service port

apiVersion: v1
kind: Service
metadata:
  name: "{{serviceName}}"
  namespace: "{{namespace}}"
spec:
  type: ClusterIP
  selector:
    app: "{{serviceName}}"
  ports:
    - port: {{port}}
      targetPort: {{port}}
