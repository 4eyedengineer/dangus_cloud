# TLS Certificates for Internal Services

This directory contains the self-signed CA and certificates for internal services.

## Files

- `ca.key` - CA private key (DO NOT COMMIT - keep secure)
- `ca.crt` - CA certificate (safe to distribute)
- `harbor.key` - Harbor private key (DO NOT COMMIT)
- `harbor.crt` - Harbor certificate
- `harbor-ext.cnf` - OpenSSL extension config for Harbor cert

## Usage

### Regenerate Harbor Certificate (if expired or SANs change)

```bash
cd k8s/tls

# Generate new Harbor cert signed by CA
openssl genrsa -out harbor.key 2048
openssl req -new -key harbor.key -out harbor.csr \
  -subj "/CN=harbor.192.168.1.124.nip.io/O=Dangus Cloud"

openssl x509 -req -in harbor.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out harbor.crt -days 365 -sha256 -extfile harbor-ext.cnf

# Update Kubernetes secret
kubectl create secret tls harbor-tls -n harbor \
  --cert=harbor.crt --key=harbor.key \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Update CA in ARC Runners

```bash
kubectl create configmap harbor-ca -n arc-runners \
  --from-file=ca.crt=ca.crt \
  --dry-run=client -o yaml | kubectl apply -f -
```

## CA Trust Locations

- **ARC Runners (dind)**: `/etc/docker/certs.d/harbor.192.168.1.124.nip.io/ca.crt`
- **Kubernetes nodes**: If needed, copy to `/etc/docker/certs.d/` on each node

## Validity

- CA: 10 years (expires ~2035)
- Harbor cert: 1 year (regenerate annually)
