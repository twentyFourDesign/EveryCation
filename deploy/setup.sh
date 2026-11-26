#!/usr/bin/env bash
# Sets up an Ubuntu 24.04 server for EveryCation and starts it. Safe to run again.
# On a fresh DigitalOcean Droplet, as root, in the Web Console:
#   curl -fsSL https://raw.githubusercontent.com/twentyFourDesign/EveryCation/main/deploy/setup.sh | bash
# Optional settings, put before "bash":  API_HOST=api.example.com ADMIN_HOST=admin.example.com ACME_EMAIL=you@example.com
set -euo pipefail

REPO_URL=${REPO_URL:-https://github.com/twentyFourDesign/EveryCation.git}
BRANCH=${BRANCH:-main}
DIR=/opt/everycation
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "Run this as root."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

say "Updating the system"
apt-get update -q
apt-get -yq -o Dpkg::Options::=--force-confold upgrade
apt-get install -yq git curl ca-certificates ufw fail2ban unattended-upgrades openssl

say "Adding 2 GB of swap"
if ! swapon --show | grep -q /swapfile; then
  [ -f /swapfile ] || { fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile; }
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -q vm.swappiness=10; echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
fi

say "Installing Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "local", "log-opts": { "max-size": "20m", "max-file": "5" } }
JSON
systemctl restart docker

say "Firewall: allowing only SSH, HTTP and HTTPS"
ufw default deny incoming >/dev/null; ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
ufw --force enable

say "SSH: keys only, no password logins (the Web Console still works)"
cat > /etc/ssh/sshd_config.d/00-everycation.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
sshd -t && systemctl restart ssh
systemctl enable --now fail2ban unattended-upgrades >/dev/null 2>&1 || true

say "Getting the code"
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" reset -q --hard "origin/$BRANCH"
else git clone -q --branch "$BRANCH" "$REPO_URL" "$DIR"; fi
cd "$DIR/deploy"

if [ ! -f .env ]; then
  say "Writing settings and generating secrets (deploy/.env)"
  IP=$(curl -fs --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || curl -fs --max-time 5 https://api.ipify.org)
  DASHED=${IP//./-}
  secret() { openssl rand -base64 48 | tr -d '\n/+='; }
  umask 077
  cat > .env <<ENV
# EveryCation server settings. Keep this file private; it is never committed.
# After changing it: cd $DIR/deploy && docker compose up -d
API_HOST=${API_HOST:-api.$DASHED.sslip.io}
ADMIN_HOST=${ADMIN_HOST:-admin.$DASHED.sslip.io}
ACME_EMAIL=${ACME_EMAIL:-wole@24group.com.ng}

POSTGRES_PASSWORD=$(secret)
JWT_SECRET=$(secret)
OTP_SECRET=$(secret)
PARTNER_WEBHOOK_SECRET=$(secret)

# Email for sign-in codes, e.g. smtps://USER:PASSWORD@smtp.provider.com:465
# DigitalOcean blocks ports 25, 465 and 587, so use a provider that offers port 2525 or an HTTP relay.
SMTP_URL=
MAIL_FROM=EveryCation <no-reply@24group.com.ng>
# Test server only: show sign-in codes in the app while there is no email. Set to 0 before real users join.
SHOW_SIGNIN_CODES=1

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_AUDIENCES=
APP_RETURN_URLS=
GEOCODER_URL=https://photon.komoot.io
JOBS_ENABLED=1
ENV
  umask 022
fi

say "Building and starting EveryCation (the first build takes several minutes)"
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null

say "Daily database backups at 02:30, kept for 14 days in /var/backups/everycation"
chmod +x "$DIR/deploy/backup.sh" "$DIR/deploy/update.sh"
echo "30 2 * * * root $DIR/deploy/backup.sh >> /var/log/everycation-backup.log 2>&1" > /etc/cron.d/everycation-backup

API_HOST=$(grep '^API_HOST=' .env | cut -d= -f2-); ADMIN_HOST=$(grep '^ADMIN_HOST=' .env | cut -d= -f2-)
say "Waiting for the API"
for i in $(seq 1 60); do
  if docker compose exec -T api node -e "fetch('http://127.0.0.1:4000/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then break; fi
  sleep 5
done
docker compose ps

cat <<DONE

EveryCation is running.
  API:            https://$API_HOST/v1   (health check: https://$API_HOST/v1/health)
  Staff console:  https://$ADMIN_HOST

Create your staff account (shows a temporary password and an authenticator code once):
  cd $DIR/deploy && docker compose exec api node dist/scripts/create-admin.js you@example.com "Your Name" super_admin

Update to the latest code later with:  $DIR/deploy/update.sh
DONE
