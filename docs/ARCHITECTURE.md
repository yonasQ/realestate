# Architecture

## Why a new application

The working directory was empty, so there was nothing to extend. The developer's site (temerproperties.com) is a WordPress/WPResidence install; its public REST API was used **once, offline**, to curate the initial catalogue (`content/temer/catalog.json`) with a source URL per record. The website does not depend on Temer's site at runtime, apart from linking to their brochure PDF.

A headless CMS (Payload, Strapi, Sanity) was considered and rejected: the content model is small and fixed, and a hosted CMS adds a vendor and cost. A self-hosted one would add a second admin system and much heavier dependencies (the build machine had very little disk). A focused admin inside the same Next.js app covers every requirement: drafts/publishing, galleries, pricing, availability, inquiries, settings and audit logging.

## Layout

```
src/app/(site)/        public pages: home, properties (list + [slug]), developments, about, contact, legal
src/app/admin/         login + protected admin (layout guard + per-action guard)
src/app/api/           inquiries (POST), health, cron/notifications
src/app/media/[...key] image variant delivery (immutable)
src/components/        site / property / inquiry / admin / ui
src/lib/db/            Drizzle schema + pooled client
src/lib/queries/       public read models (cached, tagged)
src/lib/admin/         admin read models + transactional write service
src/lib/inquiries/     inquiry service (idempotent create), delivery worker, channels
src/lib/auth/          scrypt hashing, DB sessions, login with lockout
src/lib/security/      origin checks, IP hashing, Postgres rate limiter, Turnstile
src/lib/validation/    zod schemas shared by browser and server
scripts/               migrate, import, admin CLI, prune, notification retry, perf
```

## Data model (PostgreSQL)

- **developments**: a building project (name, area, building type and configuration, construction stage and note, delivery estimate, unit-size range, amenities, finishing options, brochure, optional coordinates with **precision**, optional price). Provenance: `source_url`, `review_notes` (internal only).
- **properties**: a sellable unit type within one development (type, availability, bedrooms, bathrooms, exact size or size range, parking, price, summary/description/highlights, SEO). A property is public only if **it and its development** are published.
- **media**, **property_images**, **development_images**: processed images (variants as JSONB) and ordered galleries with kind (`photo`/`render`/`plan`) and caption.
- **inquiries**: contact and viewing requests with consent record, idempotency key, content fingerprint, follow-up status and per-channel delivery state.
- **admin_users**, **sessions**, **rate_limits**, **site_settings** (singleton), **audit_log**.

Invariants enforced **in the database** (not only in code): slug format and uniqueness; status, type and availability enums; price consistency (`on_request` ⇒ no amount or currency; otherwise amount > 0 **and** currency ETB/USD, NULL-safe); size ranges ordered; coordinates complete and paired with a precision; published ⇒ `published_at`; inquiries need email or phone, and viewings need a date; unique idempotency key, fingerprint and reference.

## Pricing and currency

Temer publishes **no prices**, so every listing shows "Price on request". When a price is entered, it is stored as amount plus explicit currency (ETB or USD) and displayed exactly as entered. It is **never converted**. Price filters and sorts appear only when priced listings exist, and filtering by price requires choosing a currency.

## Rendering and caching

- Public pages render per request (no database at build time, so Docker builds are hermetic). Their data comes from `unstable_cache` entries tagged `catalog` or `settings`, so a typical page view makes **no database query**. Measured warm TTFB is 15–55 ms.
- Admin saves call `updateTag()` inside the server action, so the next public request sees the change (read-your-own-writes; verified by an e2e test).
- A 15-minute TTL is a safety net. **Tag invalidation is per process**, so run a single app instance, or add a shared `cacheHandler` before scaling out (see the Next.js docs on multi-instance revalidation).
- Images are pre-generated WebP variants (480/960/1600/2400 px) with `srcset`/`sizes`, explicit dimensions (CLS 0) and dominant-colour placeholders. Only the LCP image loads eagerly. They are served with `Cache-Control: immutable` and are CDN-friendly.

## Inquiry pipeline (reliability and idempotency)

1. The browser validates with the shared zod schema and sends a per-form **idempotency key** (reused on retry after a timeout).
2. `POST /api/inquiries` checks the same-origin `Origin`/`Sec-Fetch-Site` headers, content type and body size. It applies the Postgres-backed rate limits (8 per 10 min and 40 per day per hashed IP), validates server-side, then runs the honeypot and time-to-fill checks and optional Turnstile.
3. `createInquiry` inserts with `ON CONFLICT DO NOTHING` on the unique key and day-scoped content fingerprint. Concurrent duplicates resolve to one row (tested with 12 parallel requests). Reusing a key with different content returns 409 instead of merging.
4. The client sees success **only after the row is committed**, along with a reference such as `INQ-7K3M9Q`.
5. Delivery runs after the response (`after()`). Workers **claim** rows with a lease and `FOR UPDATE SKIP LOCKED`, send email and/or webhook, and record **each channel's completion separately**, so a retry never re-sends a channel that already succeeded. Transient failures back off exponentially with jitter (8 attempts, capped at 6 h); permanent failures (SMTP 5xx, webhook 4xx) stop and surface in the admin for manual retry. The cron container calls `/api/cron/notifications` every 5 minutes to resume interrupted work.
6. Guarantees: the inquiry is stored exactly once. Notifications are **at-least-once**: a crash between a provider accepting a message and us recording it can cause one duplicate notification. Webhooks carry `Idempotency-Key: <inquiry id>` so a CRM can deduplicate.

## Security

- Authentication: scrypt (N=2¹⁵) password hashes. Sessions are opaque 256-bit tokens in an `httpOnly`, `SameSite=Lax`, `Secure`, `__Host-` prefixed cookie, stored as SHA-256 hashes in the database (revocable). Sessions last 7 days absolute and 12 hours idle. Logins are rate-limited per IP and per account, the account locks for 15 minutes after 5 failures, a dummy hash prevents timing-based user enumeration, there is no public sign-up, and password changes and resets revoke other sessions.
- Authorization: `requireAdmin()` runs in every admin page **and every server action**. Site settings require the `admin` role.
- CSRF: Next.js server actions verify the Origin; the JSON inquiry API checks the Origin and Fetch-Metadata headers; cookies are SameSite=Lax.
- Input handling: zod on the server for every input; LIKE wildcards escaped; Drizzle parameterises all SQL; CR/LF stripped from single-line fields (no email header injection); JSON-LD escaped against `</script>` breakout; no user HTML is ever rendered.
- Uploads: decoded by sharp (magic bytes, not extension or MIME), JPEG/PNG/WebP/AVIF only, ≤ 15 MB, ≤ 60 MP (decompression bombs), animations rejected, EXIF/GPS stripped by re-encoding, random storage keys, path-traversal-safe storage layer, per-user upload rate limit.
- Headers: CSP, HSTS (production), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP; `X-Robots-Tag: noindex` and `no-store` on `/admin`. CSP allows `'unsafe-inline'` scripts, the trade-off for keeping pages cacheable without per-request nonces (documented in `next.config.ts`).
- Privacy: IPs are stored only as keyed HMACs. Logs carry IDs, never names, phones, emails or messages. Data is collected only for the stated purpose, with consent recorded with a notice version.

## Observability

JSON-line logs on stdout/stderr (`inquiry.accepted`, `inquiry.delivery_failed`, `auth.login_failed`, `rate_limit.check_failed`, `health.check_failed`, …). `GET /api/health` returns 503 if the database doesn't answer within 2 s. The admin dashboard surfaces failed and unconfigured notification delivery. Adding Sentry or OpenTelemetry is a follow-up (see the launch checklist).
