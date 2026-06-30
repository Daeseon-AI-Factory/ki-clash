# Naver Cloud shared-server deployment

Use this when JJAN/Ki Clash shares one Naver Cloud server with other services.

The rule is simple: only one host-level reverse proxy owns ports 80/443. This
app exposes Python API and Go gameplay only on `127.0.0.1`, then the host proxy
routes the API domain to those local ports.

## Target shape

- Naver Cloud Platform Seoul server: `223.130.161.55`.
- Server spec: `c2-g3`, 2 vCPU / 4 GB RAM.
- OS/runtime: Ubuntu 22.04, Docker, Caddy.
- Data disk: `/data`, 50 GB.
- Existing service: keep as-is behind the host proxy.
- JJAN Python API: `127.0.0.1:18000`.
- JJAN Go gameplay WebSocket: `127.0.0.1:18001`.
- Existing Mimi Caddy Docker network: `mimi_default`.
- Caddy Docker aliases: `jjan-api:8000`, `jjan-game:8001`.
- Public test API domain: `api-ncp.jjan.daeseon.ai`.
- Final API domain after cutover: `api.jjan.daeseon.ai`.
- Frontend can stay on Vercel.
- Existing NCP Terraform can keep owning the server/security/DNS layer. This
  repo adds only the JJAN app stack and proxy routing.

## Server requirements

- Ubuntu 22.04 server on Naver Cloud.
- Docker Engine and Docker Compose plugin.
- Host-level Caddy or Nginx already handling 80/443.
- Public IP with DNS control.
- `/data` mounted from the data disk.
- 4 GB RAM is enough for the current single-server stack.

## First deploy on the Naver server

```bash
git clone https://github.com/Daeseon-AI-Factory/ki-clash.git app
cd app
cp deploy/naver-cloud/.env.shared.example .env
sudo mkdir -p /data/jjan/postgres /data/jjan/redis
```

Edit `.env`:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Set:

- `POSTGRES_PASSWORD`
- `JWT_SECRET_KEY`
- `CORS_ORIGINS=["https://jjan.daeseon.ai"]`
- `JJAN_DATA_DIR=/data/jjan`
- `JJAN_API_PORT=18000`
- `JJAN_GAME_PORT=18001`

Start the stack:

```bash
COMPOSE_PROJECT_NAME=jjan docker compose -f docker-compose.naver.yml up -d --build
COMPOSE_PROJECT_NAME=jjan docker compose -f docker-compose.naver.yml ps
curl http://127.0.0.1:18000/health
curl http://127.0.0.1:18001/health
sudo du -sh /data/jjan
```

Expected:

```json
{"status":"ok"}
{"status":"ok","server":"go"}
```

## Host proxy

If Caddy is installed directly on the host, copy
`deploy/naver-cloud/Caddy.shared.example` into the existing host Caddyfile and
reload Caddy.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl https://api-ncp.jjan.daeseon.ai/health
```

If Caddy itself runs as a Docker container, do not use the `127.0.0.1` example.
Use `deploy/naver-cloud/Caddy.docker-proxy.example` instead. The JJAN compose
file joins `api` and `game` to the existing external `mimi_default` network with
the aliases `jjan-api` and `jjan-game`, so Mimi Caddy can reach them without
opening public ports.

If the server uses Nginx, route:

- `/api/v1/ws/game/*` to `http://127.0.0.1:18001`
- everything else to `http://127.0.0.1:18000`

Make sure WebSocket upgrade headers are preserved for the game route.

## Data migration from AWS

If keeping current production data matters, do a short maintenance window.
Run this on the AWS server:

```bash
cd ~/app
COMPOSE_PROJECT_NAME=jjan docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U ki_clash ki_clash > /tmp/ki_clash.sql
```

Copy `/tmp/ki_clash.sql` to the Naver server, then import:

```bash
cd ~/app
COMPOSE_PROJECT_NAME=jjan docker compose -f docker-compose.naver.yml exec -T db \
  psql -U ki_clash ki_clash < /tmp/ki_clash.sql
```

Redis state is treated as ephemeral match/session state. Cut over when active
matches can be dropped or after a quiet period.

## Cutover

1. Verify `https://api-ncp.jjan.daeseon.ai/health`.
2. Verify room create/join and PvP WebSocket.
3. In Vercel, set `NEXT_PUBLIC_API_URL=https://api-ncp.jjan.daeseon.ai` and redeploy.
4. Test `https://jjan.daeseon.ai`.
5. Change DNS for `api.jjan.daeseon.ai` from the AWS Elastic IP to `223.130.161.55`.
6. Set Vercel `NEXT_PUBLIC_API_URL=https://api.jjan.daeseon.ai` and redeploy.
7. Keep AWS running for at least one rollback window.
8. Stop AWS only after Naver traffic is healthy.

## Rollback

Point `api.jjan.daeseon.ai` back to the AWS Elastic IP and redeploy Vercel with
the old API URL if needed. Do not destroy the AWS instance until the Naver
deployment has survived real traffic.
