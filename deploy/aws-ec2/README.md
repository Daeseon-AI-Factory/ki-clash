# AWS EC2 deployment — Ki Clash backend

Single-instance docker-compose deployment on a t3.micro free-tier EC2.
Runs FastAPI + PostgreSQL + Redis on one VM, fronted by Caddy for
automatic HTTPS termination via Let's Encrypt.

## Pre-requisites

- AWS account with Free Tier eligibility (12 months remaining)
- Domain name (e.g., kiclash.com) — optional but recommended

## Stack laid out on the instance

```
EC2 t3.micro (Ubuntu 24.04 LTS)
├── /opt/ki-clash/                  # cloned repo
│   ├── docker-compose.prod.yml     # production overrides
│   ├── .env                        # production secrets
│   └── Caddyfile                   # reverse proxy + SSL
└── docker compose stack
    ├── api        (FastAPI, port 8000 internal)
    ├── db         (PostgreSQL 16, persistent volume)
    ├── redis      (Redis 7, persistent AOF)
    └── caddy      (port 80, 443) → forwards to api:8000
```

## Step-by-step

### 1. Launch instance (AWS Console)

- AMI: **Ubuntu Server 24.04 LTS** (x86_64)
- Instance type: **t3.micro** (free tier eligible)
- Key pair: create new, download `.pem` (e.g., `ki-clash-key.pem`)
- Network: default VPC
- Security group: create new with these rules
  - Inbound 22 (SSH) — from MY IP only
  - Inbound 80 (HTTP) — from 0.0.0.0/0
  - Inbound 443 (HTTPS) — from 0.0.0.0/0
- Storage: 20 GiB gp3 (within free tier 30GB limit)
- Launch

### 2. Allocate Elastic IP

- Elastic IPs → Allocate → assign to the instance
- Cost: $0 as long as attached to a running instance
- Note the public IP — this is what DNS A records point to

### 3. SSH in

```bash
chmod 400 ki-clash-key.pem
ssh -i ki-clash-key.pem ubuntu@<elastic-ip>
```

### 4. Install Docker + Compose

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker ubuntu
exit   # re-login so group takes effect
ssh -i ki-clash-key.pem ubuntu@<elastic-ip>
docker --version           # verify
docker compose version
```

### 5. Clone and configure

```bash
sudo mkdir -p /opt/ki-clash
sudo chown ubuntu:ubuntu /opt/ki-clash
cd /opt/ki-clash
git clone https://github.com/<your-username>/ki-clash.git .

# Create .env from the template
cp deploy/aws-ec2/.env.prod.example .env
# Edit values — generate strong random for JWT_SECRET_KEY:
#   openssl rand -hex 32
nano .env
```

### 6. Bring up the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
docker compose -f docker-compose.prod.yml logs -f api    # watch startup
```

Quick smoke test from the VM:
```bash
curl http://localhost:8000/health   # → {"status":"ok"}
```

### 7. Set up DNS

In your domain registrar (e.g., Cloudflare):
- A record: `api.<domain>` → `<elastic-ip>` (proxy off / DNS only)

Wait 1-2 min for DNS propagation, then verify:
```bash
dig +short api.<domain>   # → should return the elastic IP
```

### 8. Caddy automatic SSL

The `caddy` container in `docker-compose.prod.yml` reads `Caddyfile`
which references the `api.<domain>` host. On first start, Caddy
requests a Let's Encrypt certificate automatically.

Verify HTTPS:
```bash
curl https://api.<domain>/health   # → {"status":"ok"}
```

### 9. Tell the frontend about it

In Vercel project settings, set:
```
NEXT_PUBLIC_API_URL=https://api.<domain>
```
Redeploy the frontend.

### 10. End-to-end smoke test

Open the Vercel URL in two browsers (or one regular + one incognito):
1. Both sign in as guest
2. Both click "vs Real Player"
3. Both should be auto-paired within ~500ms
4. Play through a Bo3 match

If anything fails, check:
- `docker compose logs api` — application errors
- `docker compose logs caddy` — cert / proxy errors
- AWS security group — port 80/443 actually open
- DNS — does `dig` resolve correctly?

## Ongoing maintenance

```bash
# Pull latest, rebuild, restart
cd /opt/ki-clash
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

## Free-tier cost monitoring

Set up Billing Alerts:
- AWS Console → Billing → Budgets → Create budget
- Threshold: $0.01 (catches ANY unexpected charge)
- Email notification

## When the 12 months free tier ends

Costs become approximately:
- EC2 t3.micro: ~$8.50/month (if not stopped)
- EBS 20GB: ~$1.60/month
- Elastic IP (attached): $0
- Data transfer out (light usage): ~$1-3/month
- Total: ~$10-13/month

Options to extend free or reduce cost:
- Stop the instance when not demoing (only pay for EBS storage)
- Move to a smaller t4g.nano ARM instance (~$3/month)
- Move to OCI Always Free Ampere (24GB RAM, free forever)
- Move to a $4-6 DigitalOcean droplet (similar cost, simpler)
