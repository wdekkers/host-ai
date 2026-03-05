#!/usr/bin/env bash
set -euo pipefail

# Manual deploy script for use outside of CI/CD.
# Usage: LIGHTSAIL_HOST=1.2.3.4 ./infra/scripts/deploy.sh

LIGHTSAIL_HOST="${LIGHTSAIL_HOST:?Set LIGHTSAIL_HOST env var}"
LIGHTSAIL_USER="${LIGHTSAIL_USER:-ubuntu}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "==> Deploying Walt AI (tag: ${IMAGE_TAG}) to ${LIGHTSAIL_HOST}..."

# Sync compose and caddy config
scp infra/docker-compose.prod.yml "${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}:/opt/walt/docker-compose.prod.yml"
scp infra/Caddyfile "${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}:/opt/walt/Caddyfile"

# Deploy
ssh "${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}" << EOF
  cd /opt/walt
  export IMAGE_TAG=${IMAGE_TAG}
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  docker image prune -f
  echo "==> Deployment complete. Checking health..."
  sleep 10
  docker compose -f docker-compose.prod.yml ps
EOF
