#!/bin/sh
# Generate .env file from environment variables at runtime
# This allows k8s env vars to be picked up by Vite dev server

echo "VITE_API_URL=${VITE_API_URL:-/api}" > /app/.env
echo "VITE_BACKEND_URL=${VITE_BACKEND_URL}" >> /app/.env

echo "Generated .env:"
cat /app/.env

exec "$@"
