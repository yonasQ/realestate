# Production deployment

The supported target is **one Linux server** (2 vCPU / 2–4 GB RAM is ample) running Docker Compose: Caddy (automatic HTTPS), the Next.js app (single replica), Postgres 16, a notification-retry loop and nightly backups. Everything is in `Dockerfile` and `deploy/`.

> Status: the Docker image build is verified locally. Nothing has been deployed to a real domain, and no email, CRM, Turnstile or analytics credentials have been configured or tested against live providers.

## 1. Server and DNS

1. Provision a VPS (Ubuntu 24.04 LTS or similar) with Docker Engine and the Compose plugin. Open ports 80 and 443 only (plus SSH, restricted).
2. DNS at your registrar:
   - `A     example.com      → <server IPv4>`
   - `AAAA  example.com      → <server IPv6>` (if available)
   - `CNAME www.example.com  → example.com`
3. Wait for DNS to resolve. Caddy obtains and renews Let's Encrypt certificates automatically on first start; `www` redirects to the apex.

## 2. Configuration

```bash
git clone <repo> /opt/realtor && cd /opt/realtor
cp deploy/.env.production.example deploy/.env.production && chmod 600 deploy/.env.production
openssl rand -base64 48   # → APP_SECRET
openssl rand -hex 24      # → CRON_SECRET
openssl rand -hex 24      # → POSTGRES_PASSWORD (also put it in DATABASE_URL)
```

| Variable | Required | Notes |
|---|---|---|
| `DOMAIN`, `SITE_URL` | yes | `SITE_URL=https://<DOMAIN>`; used for canonicals, sitemap, OG and CSRF origin checks |
| `DATABASE_URL`, `POSTGRES_*` | yes | Compose DB host is `db` |
| `APP_SECRET` | yes | ≥ 32 chars; HMAC for IP hashing. Rotating it only resets rate-limit buckets |
| `CRON_SECRET` | yes | ≥ 24 chars; authorises `/api/cron/notifications` |
| `TRUST_PROXY` | set by compose | `true` behind Caddy; never `true` without a proxy that overwrites `X-Forwarded-For` |
| `INQUIRY_NOTIFY_EMAIL`, `SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM` | recommended | Business inbox alerts. `SMTP_FROM`'s domain needs SPF + DKIM (+ DMARC) records from your mail provider |
| `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET` | optional | Signed JSON POST (`X-Webhook-Signature: sha256=HMAC(secret, timestamp + "." + body)`, `Idempotency-Key`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | optional | Cloudflare Turnstile. **Site key is build-time**: rebuild after changing |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | optional | Cookieless analytics; build-time (CSP and script) |
| `LOG_LEVEL` | optional | `info` default |

The app validates its configuration on first use and fails loudly (and `/api/health` returns 503) if anything is invalid.

## 3. First launch

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build
# migrations run automatically (one-shot "migrate" service) before the app starts
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production run --rm tools pnpm import:catalog
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production run --rm tools pnpm admin:create --email you@domain --name "Your Name"
curl -fsS https://<DOMAIN>/api/health
```

Then sign in at `https://<DOMAIN>/admin`, complete **Site settings** (see the launch checklist), submit a test inquiry and confirm the email/CRM alert arrives.

## 4. Updating (deploy procedure)

```bash
git pull
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production build
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d
```

The `migrate` service runs pending migrations (advisory-locked) before the new app container starts. Write migrations to be **backward compatible** with the previous release (expand, deploy, then contract), so rollback is possible.

**Rollback:** check out the previous tag and repeat the update commands. If a migration must be undone, restore from the pre-deploy backup (below). Take one manually before risky migrations:
`docker compose ... exec backup sh -c 'pg_dump -Fc -f /backups/pre-deploy-$(date +%s).dump'`.

## 5. Backups and recovery

- The `backup` container writes `backups/db-*.dump` (pg_dump custom format) and `backups/media-*.tgz` nightly and keeps 14 days. **Copy `backups/` off the server** (e.g. `rclone` to S3/Backblaze, or a provider snapshot); on-server backups don't survive disk loss.
- Restore the database: `docker compose ... exec -T db pg_restore -U realtor -d realtor --clean --if-exists < backups/db-XXXX.dump`
- Restore media: `docker run --rm -v realtor_media:/m -v $PWD/backups:/b alpine tar -xzf /b/media-XXXX.tgz -C /m`
- Test a restore on a scratch machine at least once before launch.

## 6. Operations

- Logs: `docker compose ... logs -f app` (JSON lines). Watch for `inquiry.delivery_failed`, `inquiry.store_failed`, `health.check_failed`.
- Uptime: point an external monitor (UptimeRobot, Better Stack…) at `/api/health`.
- Error monitoring: not bundled. Add Sentry (`@sentry/nextjs`) or forward logs to a service that alerts on `level:error`.
- Cache invalidation is automatic on admin edits. If content is edited directly in SQL, restart the app (or wait ≤ 15 min).
- Scaling beyond one app replica requires a shared Next.js `cacheHandler` (e.g. Redis) so tag invalidations propagate; otherwise replicas can serve stale listings for up to 15 minutes.
- Media can move to S3/R2 by implementing `src/lib/media/storage.ts` (put/get/delete) and serving via CDN.
- Personal data: purge closed and spam inquiries older than 24 months to honour the privacy notice, e.g.
  `DELETE FROM inquiries WHERE status IN ('closed','spam') AND created_at < now() - interval '24 months';`

## Alternative hosts

Any platform that runs a long-lived Node 20+ process with a persistent volume works (Render, Railway, Fly.io with a volume, a managed VM). Serverless/edge platforms need extra work: the image store must move to object storage and `after()` delivery relies on the cron retry.
