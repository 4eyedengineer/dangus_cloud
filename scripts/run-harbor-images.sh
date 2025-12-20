#!/bin/bash
# Run the app using production images from Harbor
#
# Usage:
#   ./scripts/run-harbor-images.sh        # Pull latest and run
#   ./scripts/run-harbor-images.sh --pull # Just pull latest images
#   ./scripts/run-harbor-images.sh --down # Stop containers

set -e
cd "$(dirname "$0")/.."

COMPOSE_FILES="-f docker-compose.yaml -f docker-compose.harbor.yaml"

case "${1:-up}" in
    --pull|pull)
        echo "Pulling latest images from Harbor..."
        docker compose $COMPOSE_FILES pull frontend backend
        echo "Done! Run './scripts/run-harbor-images.sh' to start."
        ;;
    --down|down)
        echo "Stopping containers..."
        docker compose $COMPOSE_FILES down
        ;;
    *)
        echo "Pulling latest images from Harbor..."
        docker compose $COMPOSE_FILES pull frontend backend
        echo ""
        echo "Starting with Harbor images..."
        docker compose $COMPOSE_FILES up "$@"
        ;;
esac
