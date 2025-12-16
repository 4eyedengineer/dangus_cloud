# Kubernetes Ingress Template for User Projects
#
# Template Variables:
#   namespace   - Kubernetes namespace (e.g., `a1b2c3-myapp`)
#   serviceName - Service name
#   port        - Service port number
#   subdomain   - Subdomain prefix (e.g., `a1b2c3-myservice`)
#   baseDomain  - Base domain (e.g., `192.168.1.124.nip.io`)

apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: "{{serviceName}}"
  namespace: "{{namespace}}"
spec:
  rules:
    - host: "{{subdomain}}.{{baseDomain}}"
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: "{{serviceName}}"
                port:
                  number: {{port}}
