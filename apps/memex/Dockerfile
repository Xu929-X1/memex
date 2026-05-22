FROM node:20-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    NODE_ENV=production \
    MEMEX_PYTHON_BIN=python3
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        build-essential \
        libgl1 \
        libglib2.0-0 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/memex/package.json apps/memex/package.json
RUN npm install --workspace @memex/web --include-workspace-root

FROM base AS python-deps
WORKDIR /app
COPY apps/memex/services/docling/requirements.txt /tmp/requirements.txt
RUN pip3 install --break-system-packages -r /tmp/requirements.txt \
    && python3 -c "from docling.document_converter import DocumentConverter; DocumentConverter()" || true

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/memex/node_modules ./apps/memex/node_modules
COPY . .
WORKDIR /app/apps/memex
RUN npx prisma generate && npm run build

FROM base AS runtime
WORKDIR /app/apps/memex
COPY --from=python-deps /usr/lib/python3 /usr/lib/python3
COPY --from=python-deps /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=python-deps /usr/local/bin /usr/local/bin
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/memex/node_modules ./node_modules
COPY --from=build /app/apps/memex/.next ./.next
COPY --from=build /app/apps/memex/public ./public
COPY --from=build /app/apps/memex/package.json ./package.json
COPY --from=build /app/apps/memex/prisma ./prisma
COPY --from=build /app/apps/memex/services ./services
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
