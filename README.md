# Addis Homes: realtor website for Temer Properties developments

A production web application for a realtor marketing **Temer Properties** developments in Addis Ababa: property discovery, development showcases, inquiry and viewing requests with a reliable delivery pipeline, and a secure admin area for managing listings, images, inquiries and site content.

> The brand name "Addis Homes" is a placeholder default. Change it in **Admin → Site settings**. See [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) for everything needed before going live.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, TypeScript strict), standalone output |
| Data | PostgreSQL 16 via Drizzle ORM; SQL migrations in `drizzle/` |
| Styling | Tailwind CSS 4 with design tokens in `src/app/globals.css` |
| Images | Uploads validated and resized with `sharp` into WebP variants, served from `/media/*` with immutable caching |
| Email / CRM | SMTP via Nodemailer and/or HMAC-signed webhook (both optional; DB is the source of truth) |
| Tests | Vitest (unit + integration on a real Postgres), Playwright + axe (end-to-end, accessibility) |

## Quick start (local)

```bash
pnpm install
docker compose up -d db          # Postgres on 127.0.0.1:5435 (creates realtor + realtor_test DBs)
cp .env.example .env             # then set APP_SECRET (openssl rand -base64 48) and CRON_SECRET
pnpm db:migrate
pnpm import:catalog              # imports the curated Temer catalogue + images (~2–3 min)
pnpm admin:create --email you@example.com --name "Your Name"   # prompts for a password
pnpm dev                         # http://localhost:3000 (admin at /admin)
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop / production build (no DB needed at build time) / serve |
| `pnpm typecheck`, `pnpm lint` | Static analysis |
| `pnpm test` | Unit + integration tests (uses the `realtor_test` database only) |
| `pnpm test:e2e` | Production build + Playwright journeys, axe, link/image crawl, responsive checks (uses `realtor_e2e`) |
| `pnpm perf` | Throttled mobile lab measurement (TTFB, LCP, CLS, bytes) against a running server |
| `pnpm db:generate` / `pnpm db:migrate` | Create / apply SQL migrations (advisory-locked, safe to run concurrently) |
| `pnpm import:catalog [--update]` | Idempotent import of `content/temer/catalog.json` (never clobbers admin-edited galleries) |
| `pnpm admin:create` | Create an admin/editor or reset a password (revokes their sessions) |
| `pnpm notifications:process` | Retry due inquiry notifications (production uses the cron container instead) |
| `pnpm media:prune [--apply]` | Report/delete unreferenced images |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): design decisions, data model, caching, security, reliability
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): production deployment, DNS/HTTPS, env vars, backups, rollback
- [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md): missing business information and credentials
- [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md): using the admin, publishing rules, image/asset replacement
- [docs/DATA_REVIEW.md](docs/DATA_REVIEW.md): conflicts found in the developer's published data, held for confirmation
