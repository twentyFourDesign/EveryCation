# Images for the API and the staff console. Built by deploy/docker-compose.yml:
#   docker build --target api|admin|web .     docker build --target admin --build-arg NEXT_PUBLIC_API_URL=https://… .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
COPY packages/tokens/package.json packages/tokens/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @everycation/api --filter @everycation/admin... --filter @everycation/mobile...

FROM deps AS api-build
COPY apps/api apps/api
RUN pnpm --filter @everycation/api build \
 && pnpm --filter @everycation/api deploy --legacy --prod /out \
 && cp -r apps/api/dist apps/api/drizzle /out/

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production PORT=4000 MEDIA_DIR=/data/media
WORKDIR /app
COPY --from=api-build /out ./
RUN mkdir -p /data/media && chown -R node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:4000/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply database changes, then start.
CMD ["sh", "-c", "node dist/db/migrate.js && exec node dist/main.js"]

FROM deps AS admin-build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY packages packages
COPY apps/admin apps/admin
RUN pnpm --filter @everycation/admin build

FROM node:22-bookworm-slim AS admin
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=admin-build --chown=node:node /repo/apps/admin/.next/standalone ./
COPY --from=admin-build --chown=node:node /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=admin-build --chown=node:node /repo/apps/admin/public ./apps/admin/public
USER node
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]

# The traveller app's web version, served by Caddy together with HTTPS.
FROM deps AS web-build
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
COPY packages packages
COPY apps/mobile apps/mobile
RUN cd apps/mobile && npx expo export -p web --output-dir /web

FROM caddy:2 AS web
COPY --from=web-build /web /srv/app
