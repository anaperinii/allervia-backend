FROM node:22.22.0-bookworm-slim AS tools
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL=postgresql://unused:unused@localhost/unused node node_modules/prisma/build/index.js generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY scripts ./scripts

FROM tools AS build
RUN npm run build && test -f dist/src/main.js
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22.22.0-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node scripts/operations/queue-status.cjs ./scripts/operations/queue-status.cjs
USER node
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
