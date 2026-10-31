# syntax=docker/dockerfile:1.7
# ---- Base ------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ---- Dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ---- Build (no database or secrets needed) -----------------------------------
FROM deps AS build
# Public, build-time values: inlined into client JS and the CSP (next.config headers).
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN=""
ARG NEXT_PUBLIC_PLAUSIBLE_SRC="https://plausible.io/js/script.js"
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN \
    NEXT_PUBLIC_PLAUSIBLE_SRC=$NEXT_PUBLIC_PLAUSIBLE_SRC
COPY . .
RUN pnpm build

# ---- Tools image: migrations, catalogue import, admin CLI, notification retries ----
FROM build AS tools
ENV NODE_ENV=production
USER node
CMD ["pnpm", "db:migrate"]

# ---- Runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 STORAGE_DIR=/data/storage
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data/storage && chown -R node:node /data
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
