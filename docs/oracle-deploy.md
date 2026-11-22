# Satsway Oracle deploy runbook

Minimal production-style setup for one Oracle VPS with PM2.

## Services

- FastAPI backend: `satsway-api`
- Next.js frontend: `satsway-web`
- Celery worker: `satsway-worker`
- Celery beat scheduler: `satsway-beat`
- PostgreSQL for persistent data
- Redis for Celery broker/results

## First server setup

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm postgresql redis-server nginx iptables-persistent
sudo npm install -g pm2
```

On small Oracle free-tier instances, add swap before running builds or installs:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
```

Oracle Ubuntu images can also block HTTP/HTTPS locally with iptables:

```bash
sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Also make sure the Oracle Cloud security list or NSG allows inbound TCP `80` and later `443`.

Create the database and user:

```bash
sudo -u postgres psql
```

```sql
create user satsway with password 'change-me';
create database satsway owner satsway;
\q
```

## App setup

From the project root:

```bash
cd /opt
sudo git clone <your-repo-url> satsway
sudo chown -R $USER:$USER satsway
cd satsway

./scripts/server-bootstrap.sh
cp .env.production.example .env
nano .env
./scripts/deploy.sh
```

For small Oracle free-tier instances, prefer building locally and pushing the built artifact:

```bash
SATSWAY_SERVER=ubuntu@134.98.148.12 \
SATSWAY_SSH_KEY=~/Documents/market_dashboard/Oracle_Keys/ssh-key-2025-05-06.pem \
NEXT_PUBLIC_API_BASE_URL=http://134.98.148.12 \
./scripts/deploy-oracle.sh
```

Before pushing or deploying changes locally:

```bash
./scripts/check-local.sh
```

GitHub Actions also runs the same critical gates on push/pull request:

- backend compile
- backend tests
- frontend production build

## Required environment variables

Set these in `.env`:

- `DATABASE_URL`
- `AUTH_TOKEN_SECRET`
- `NEXT_PUBLIC_API_BASE_URL`
- `CORS_ORIGINS`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `FRONTEND_SUCCESS_URL`
- `FRONTEND_CANCEL_URL`

For production, set these to your real domain:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.satsway.example.com
CORS_ORIGINS=https://satsway.example.com
FRONTEND_SUCCESS_URL=https://satsway.example.com
FRONTEND_CANCEL_URL=https://satsway.example.com
```

River can stay empty until real Lightning credentials are ready:

- `RIVER_API_KEY`
- `RIVER_ACCOUNT_ID`
- `RIVER_WEBHOOK_SECRET`

## Health checks

```bash
./scripts/healthcheck.sh
pm2 status
pm2 logs satsway-api
```

API checks:

- `GET /health`
- `GET /health/db`
- `GET /health/config` shows non-secret config readiness

## Nginx

Use [nginx-satsway.conf](./nginx-satsway.conf) as a starting point.

```bash
sudo cp docs/nginx-satsway.conf /etc/nginx/sites-available/satsway
sudo nano /etc/nginx/sites-available/satsway
sudo ln -s /etc/nginx/sites-available/satsway /etc/nginx/sites-enabled/satsway
sudo nginx -t
sudo systemctl reload nginx
```

Recommended domain split:

- `https://satsway.example.com` -> Next.js frontend on port `3000`
- `https://api.satsway.example.com` -> FastAPI backend on port `8000`

After DNS works, add HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d satsway.example.com -d api.satsway.example.com
```

## Deploy update

```bash
cd /opt/satsway
git pull
./scripts/deploy.sh
```

What `deploy.sh` does:

- validates `.env`
- installs backend dependencies
- installs production frontend runtime dependencies with `npm ci --omit=dev`
- runs backend tests
- runs Alembic migrations
- starts or reloads PM2 apps
- runs health checks
- saves PM2 process state

`deploy-oracle.sh` does the heavier web build locally first, then syncs the code and `.next` output to the server before running `deploy.sh`.

## Stripe webhooks

Local development can use Stripe CLI:

```bash
stripe listen --forward-to http://127.0.0.1:8000/webhooks/stripe
```

On production, configure the webhook URL in Stripe Dashboard:

```text
https://your-domain.com/webhooks/stripe
```

Then place the production webhook signing secret in `.env` as `STRIPE_WEBHOOK_SECRET`.
