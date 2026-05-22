FROM node:20-slim AS base
ENV NODE_ENV=production

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/memex/package.json apps/memex/package.json
RUN npm install --workspace @memex/web --include-workspace-root

FROM base AS build
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=2048
# Dummy DATABASE_URL so prisma generate / next build don't fail on missing env at build time.
# Runtime env on Railway overrides this.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    DIRECT_URL=postgres://build:build@localhost:5432/build \
    JWT_SECRET=build-time-placeholder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/memex/node_modules ./apps/memex/node_modules
COPY . .
WORKDIR /app/apps/memex
RUN npx prisma generate && npm run build

FROM base AS runtime
WORKDIR /app/apps/memex
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/memex/node_modules ./node_modules
COPY --from=build /app/apps/memex/.next ./.next
COPY --from=build /app/apps/memex/public ./public
COPY --from=build /app/apps/memex/package.json ./package.json
COPY --from=build /app/apps/memex/prisma ./prisma
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
