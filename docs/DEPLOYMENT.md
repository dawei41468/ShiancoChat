# Deployment Guide

This guide covers deploying ShiancoChat to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Backend Deployment](#backend-deployment)
  - [Docker](#docker)
  - [VPS / Bare Metal](#vps--bare-metal)
- [Frontend Deployment](#frontend-deployment)
- [MongoDB](#mongodb)
- [Reverse Proxy (Nginx)](#reverse-proxy-nginx)
- [SSL / HTTPS](#ssl--https)
- [Health Checks](#health-checks)

---

## Prerequisites

- Python 3.12+
- Node.js 20+
- MongoDB 6.0+ (or MongoDB Atlas)
- A Linux server with at least 2 vCPU and 4GB RAM
- Domain name (for HTTPS)

## Environment Variables

Copy `.env.example` to `.env` and fill in all required values:

```bash
cd backend
cp .env.example .env
```

Critical variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | 32+ char random string for JWT signing | `openssl rand -hex 32` |
| `MONGO_URL` | MongoDB connection URI | `mongodb://localhost:27017` |
| `DB_NAME` | Database name | `shiancochat` |
| `LLM_BASE_URL` | Primary LLM API endpoint | `http://localhost:1234` |
| `LLM_BASE_URLS` | Failover endpoints (JSON array) | `["http://host1:1234", "http://host2:1234"]` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access token lifetime | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | JWT refresh token lifetime | `7` |
| `BING_API_KEY` | Optional Bing Search API key | - |
| `SOUGOU_API_SID` | Optional Sougou API SID | - |
| `SOUGOU_API_SK` | Optional Sougou API secret key | - |

## Backend Deployment

### Docker

A `Dockerfile` for the backend:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 4100

CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "4100", "--workers", "4"]
```

Build and run:

```bash
docker build -t shiancochat-backend .
docker run -d \
  --name shiancochat-backend \
  -p 4100:4100 \
  -v $(pwd)/.env:/app/.env \
  shiancochat-backend
```

### VPS / Bare Metal

1. Clone the repository:
```bash
git clone https://github.com/your-org/ShiancoChat.git
cd ShiancoChat/backend
```

2. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. Run with a production ASGI server (Gunicorn + Uvicorn workers):
```bash
gunicorn backend.server:app \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:4100 \
  --workers 4 \
  --access-logfile - \
  --error-logfile -
```

Or use Uvicorn directly:
```bash
uvicorn backend.server:app \
  --host 0.0.0.0 \
  --port 4100 \
  --workers 4
```

> ⚠️ **Never use `python server.py` in production.** It runs with `reload=True` which is a development-only feature.

### Systemd Service

Create `/etc/systemd/system/shiancochat.service`:

```ini
[Unit]
Description=ShiancoChat Backend
After=network.target

[Service]
Type=simple
User=shianchat
WorkingDirectory=/opt/ShiancoChat/backend
Environment=PATH=/opt/ShiancoChat/backend/venv/bin
Environment=PYTHONPATH=/opt/ShiancoChat
ExecStart=/opt/ShiancoChat/backend/venv/bin/uvicorn backend.server:app --host 0.0.0.0 --port 4100 --workers 4
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable shiancochat
sudo systemctl start shiancochat
```

## Frontend Deployment

The frontend is a standard React SPA. Build it and serve the static files.

```bash
cd frontend
yarn install
yarn build
```

The `build/` folder contains the static assets. Serve it with Nginx, or copy it to a CDN.

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/shiancochat/build;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api {
        proxy_pass http://localhost:4100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## MongoDB

### Self-Hosted

Install MongoDB 6.0+ and enable authentication:

```bash
mongosh
> use admin
> db.createUser({
  user: "shiancochat",
  pwd: "strong_password",
  roles: [{ role: "readWrite", db: "shiancochat" }]
})
```

Update `MONGO_URL`:
```
mongodb://shiancochat:strong_password@localhost:27017/shiancochat?authSource=admin
```

### MongoDB Atlas

1. Create a cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a database user
3. Add your server IP to the allowlist
4. Copy the connection string to `MONGO_URL`

### Backups

Set up daily backups using `mongodump`:

```bash
# Cron job for daily backups at 2 AM
0 2 * * * mongodump --uri="$MONGO_URL" --out=/backups/$(date +\%Y\%m\%d)
```

## Reverse Proxy (Nginx)

A complete Nginx config with rate limiting and security headers:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend static files
    location / {
        root /var/www/shiancochat/build;
        try_files $uri /index.html;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location /api {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:4100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

## SSL / HTTPS

Use Let's Encrypt with Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Health Checks

The app exposes a health endpoint at `GET /api/health` that verifies MongoDB connectivity.

### Kubernetes

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 4100
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/health
    port: 4100
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Uptime Monitoring

Use the health endpoint with UptimeRobot, Pingdom, or a custom monitor:

```bash
curl -f https://your-domain.com/api/health || echo "UNHEALTHY"
```
