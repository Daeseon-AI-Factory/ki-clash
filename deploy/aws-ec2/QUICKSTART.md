# Ki Clash — Deploy QUICKSTART (kiclash.daeseon.ai)

Tight checklist for the actual deploy. See `README.md` for full background.

Domain plan:
- **Frontend** → `https://kiclash.daeseon.ai` (Vercel)
- **Backend**  → `https://api.kiclash.daeseon.ai` (AWS EC2 + Caddy SSL)

---

## A. AWS EC2 (backend) — ~25 min

### 1. Launch instance

AWS Console → EC2 → Launch instance

| Field | Value |
|---|---|
| Name | `ki-clash` |
| AMI | **Ubuntu Server 24.04 LTS** (x86_64) |
| Instance type | **t3.micro** (Free Tier) |
| Key pair | Create new → `ki-clash-key.pem` → download |
| Security group | Create new — see rules below |
| Storage | 20 GiB gp3 |

Security group rules:
- Inbound 22 (SSH) — from **MY IP** only
- Inbound 80 (HTTP) — from `0.0.0.0/0`
- Inbound 443 (HTTPS) — from `0.0.0.0/0`

### 2. Allocate Elastic IP

EC2 → Elastic IPs → Allocate → Associate to `ki-clash` instance.

Note the IP — needed for DNS in step 4.

### 3. SSH + install Docker

```bash
chmod 400 ki-clash-key.pem
ssh -i ki-clash-key.pem ubuntu@<elastic-ip>

# inside the VM
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker ubuntu
exit
# re-SSH so the docker group sticks
ssh -i ki-clash-key.pem ubuntu@<elastic-ip>
```

### 4. DNS — point api.kiclash.daeseon.ai at the EC2

Wherever `daeseon.ai` is hosted (Cloudflare / Route53 / Namecheap):

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `api.kiclash.daeseon.ai` | `<elastic-ip>` | Auto / 300 |
| CNAME | `kiclash.daeseon.ai` | `cname.vercel-dns.com` | Auto / 300 |

If using Cloudflare, set both records to **DNS only** (gray cloud, NOT proxied) — Caddy needs raw HTTPS for Let's Encrypt and Vercel handles its own SSL.

### 5. Clone repo and configure

```bash
sudo mkdir -p /opt/ki-clash
sudo chown ubuntu:ubuntu /opt/ki-clash
cd /opt/ki-clash
git clone https://github.com/Daeseon-AI-Factory/ki-clash.git .

cp deploy/aws-ec2/.env.prod.example .env

# Generate secrets
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "JWT_SECRET_KEY=$(openssl rand -hex 32)"
# Paste these into .env replacing the REPLACE_WITH_STRONG_RANDOM placeholders
nano .env
# Confirm: API_DOMAIN=api.kiclash.daeseon.ai
# Confirm: CORS_ORIGINS=["https://kiclash.daeseon.ai"]
```

### 6. Boot the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
docker compose -f docker-compose.prod.yml logs -f api
```

Wait for "Application startup complete". Ctrl+C to exit log tail (the stack keeps running).

### 7. Verify

From the EC2 VM:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

From your laptop (after DNS propagates, 1-5 min):
```bash
curl https://api.kiclash.daeseon.ai/health
# {"status":"ok"}    ← Caddy auto-fetched the cert
```

If the second curl returns a TLS error, give it another minute — Let's Encrypt issuance is async.

---

## B. Vercel (frontend) — ~5 min

### 1. Login (local — your laptop)

```bash
cd /Users/daeseonyoo/Documents/GitHub/ai-product/ki-clash/web
npx vercel login
# Browser opens → continue with GitHub
```

### 2. First deploy (creates project)

```bash
npx vercel
# Setup and deploy? Y
# Which scope? <your-account>
# Link to existing project? N
# Project name? ki-clash
# Directory? ./
# Override settings? N
```

Vercel returns a preview URL.

### 3. Set env vars

Vercel dashboard → **ki-clash** → **Settings** → **Environment Variables**:

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.kiclash.daeseon.ai` | Production, Preview, Development |

### 4. Production deploy

```bash
npx vercel --prod
```

### 5. Custom domain

Vercel dashboard → **ki-clash** → **Settings** → **Domains**:
- Add `kiclash.daeseon.ai`
- Vercel will validate the CNAME you set in step A.4 — once it sees `cname.vercel-dns.com`, the domain goes live with auto-SSL

---

## C. Smoke test (final) — ~3 min

1. Open `https://kiclash.daeseon.ai` — lobby loads
2. Click **vs Real Player (PvP)** → **Create Room**
3. Copy the 4-letter code
4. Open the same URL in an **incognito tab** → **Join Room** → paste code → join
5. Both pick characters → both ready → match starts
6. Play a few turns, finish the match, see the finale

If any step fails:
- Browser DevTools → Console + Network for CORS / WS errors
- `ssh ... docker compose logs -f api` on EC2 to see backend logs
- Verify `NEXT_PUBLIC_API_URL` in Vercel matches the backend domain EXACTLY (https, no trailing slash)
