# Deploying EveryCation

One Ubuntu 24.04 server runs everything with Docker: PostgreSQL, the API, the staff console, and Caddy, which gets HTTPS certificates automatically.

## First time

On a fresh DigitalOcean Droplet, open **Web Console** and run as root:

```sh
curl -fsSL https://raw.githubusercontent.com/twentyFourDesign/EveryCation/main/deploy/setup.sh | bash
```

It updates the system, adds swap, installs Docker, allows only SSH, HTTP and HTTPS through the firewall, turns off SSH password logins, writes `deploy/.env` with fresh secrets, builds and starts the app, and schedules daily database backups.

Until a domain is set, the addresses are made from the server's IP with sslip.io, e.g. `https://api.165-22-127-35.sslip.io/v1` and `https://admin.165-22-127-35.sslip.io`.

Then create the first staff account:

```sh
cd /opt/everycation/deploy && docker compose exec api node dist/scripts/create-admin.js you@example.com "Your Name" super_admin
```

## Everyday

| Task | Command (in `/opt/everycation/deploy`) |
| --- | --- |
| Update to the latest code | `./update.sh` (backs up the database first) |
| See what is running | `docker compose ps` |
| Read the API's logs | `docker compose logs -f --tail 100 api` |
| Change a setting | edit `.env`, then `docker compose up -d` |
| Back up now | `./backup.sh` (copies go to `/var/backups/everycation`) |

## Moving to a real domain

Point `api.` and `admin.` records for the domain at the server's IP, set `API_HOST` and `ADMIN_HOST` in `.env`, then run `docker compose up -d --build` (the console is rebuilt because its API address is built in). Update `EXPO_PUBLIC_API_URL` in the app builds to match.

## Before real users join

- Connect email: set `SMTP_URL`. DigitalOcean blocks ports 25, 465 and 587, so use a provider that offers port 2525.
- Set `SHOW_SIGNIN_CODES=0`. While it is 1, the app shows sign-in codes on screen, so anyone who knows an email address can sign in as it.
- Turn on Droplet backups in DigitalOcean too; uploaded photos and voice tips live on this server's disk.
