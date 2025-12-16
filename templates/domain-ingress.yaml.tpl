# Kubernetes Ingress Template for Custom Domains with TLS
#
# Template Variables:
#   namespace     - Kubernetes namespace
#   serviceName   - Backend service name
#   port          - Service port number
#   domain        - Custom domain (e.g., api.example.com)
#   ingressName   - Unique ingress name for this domain
#   secretName    - TLS secret name for certificate storage

apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: "{{ingressName}}"
  namespace: "{{namespace}}"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  labels:
    app.kubernetes.io/managed-by: "dangus-cloud"
    dangus-cloud/domain-type: "custom"
spec:
  tls:
    - hosts:
        - "{{domain}}"
      secretName: "{{secretName}}"
  rules:
    - host: "{{domain}}"
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: "{{serviceName}}"
                port:
                  number: {{port}}
