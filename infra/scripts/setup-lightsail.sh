#!/usr/bin/env bash
set -euo pipefail

# One-time setup for a fresh Lightsail instance.
# Run as: ssh user@lightsail < infra/scripts/setup-lightsail.sh

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"

echo "==> Installing Docker Compose plugin..."
sudo apt-get update -qq
sudo apt-get install -y -qq docker-compose-plugin

echo "==> Creating application directory..."
sudo mkdir -p /opt/walt
sudo chown "$USER":"$USER" /opt/walt

echo ""
echo "==> Setup complete. Next steps:"
echo ""
echo "1. Log out and back in (for docker group to take effect)"
echo ""
echo "2. Authenticate with GHCR:"
echo "   echo \$GHCR_TOKEN | docker login ghcr.io -u USERNAME --password-stdin"
echo ""
echo "3. Copy files to the server:"
echo "   scp infra/docker-compose.prod.yml user@host:/opt/walt/docker-compose.prod.yml"
echo "   scp infra/Caddyfile user@host:/opt/walt/Caddyfile"
echo "   scp .env.production user@host:/opt/walt/.env.production"
echo ""
echo "4. Open firewall ports 80 and 443 in the Lightsail console (Networking tab)"
echo ""
echo "5. Point ai-dev.walt-services.com A record to this instance's static IP"
echo ""
echo "6. Start:"
echo "   cd /opt/walt && docker compose -f docker-compose.prod.yml up -d"
