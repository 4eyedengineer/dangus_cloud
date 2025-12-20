#!/bin/bash
# Setup Docker to trust Harbor's self-signed CA
# Run with: sudo ./scripts/setup-harbor-trust.sh

set -e

HARBOR_HOST="harbor.192.168.1.124.nip.io"
CA_CERT_PATH="$(dirname "$0")/../k8s/tls/ca.crt"

if [ ! -f "$CA_CERT_PATH" ]; then
    echo "Error: CA certificate not found at $CA_CERT_PATH"
    exit 1
fi

# Create Docker certs directory for Harbor
DOCKER_CERTS_DIR="/etc/docker/certs.d/$HARBOR_HOST"
echo "Creating $DOCKER_CERTS_DIR..."
mkdir -p "$DOCKER_CERTS_DIR"

# Copy CA certificate
echo "Copying CA certificate..."
cp "$CA_CERT_PATH" "$DOCKER_CERTS_DIR/ca.crt"

echo "Done! Docker will now trust Harbor at $HARBOR_HOST"
echo ""
echo "Test with: docker pull $HARBOR_HOST/dangus/dangus-backend:latest"
