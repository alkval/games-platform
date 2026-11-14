FROM node:24-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY index.html tsconfig.json tsconfig.server.json vite.config.ts vitest.config.ts ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
# The deploy service checks files out with a restrictive umask; the runtime user must
# still be able to read the schema and migrations it applies on start.
RUN chmod -R a+rX prisma package.json package-lock.json \
  && npm ci --omit=dev && npm cache clean --force && npx prisma generate

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

RUN mkdir -p /app/data && chown node:node /app/data
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node dist-server/server/server.js"]

