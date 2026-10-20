# syntax=docker/dockerfile:1.7
# Build context: repository root (docker build -f apps/api/Dockerfile .)

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0
RUN corepack enable
WORKDIR /repo

# ---- Build: install with the lockfile, compile, then extract production dependencies only.
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @riados/api...
COPY apps/api apps/api
RUN pnpm --filter @riados/api build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @riados/api deploy --prod /out
WORKDIR /out
RUN node_modules/.bin/prisma generate

# ---- Runtime: no compiler, no dev dependencies, non-root user.
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health/live || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
