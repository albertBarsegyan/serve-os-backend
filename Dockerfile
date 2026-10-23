# 0. Base with pnpm (pinned — keep in sync with "packageManager" in package.json)
FROM node:24-alpine AS base

WORKDIR /app

ENV HUSKY=0
RUN npm install -g pnpm@11.25.0

# 1. Build stage (used for both dev and prod)
FROM base AS builder

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# 2. Development stage (for hot reload)
FROM base AS development

# Copy package files and install all dependencies (including dev)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code (will be overridden by volume mount in docker-compose)
COPY . .

EXPOSE 4000

CMD ["pnpm", "start:dev"]

# 3. Production dependencies only (no install scripts — bcrypt/sharp ship prebuilt binaries)
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# 4. Production stage (no pnpm in the runtime image)
FROM node:24-alpine AS production

WORKDIR /app

# npm is only used to run package scripts (e.g. migration:prod:run); skip its update check
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies and build output, owned by the runtime user
COPY --chown=nodejs:nodejs --from=builder /app/package.json ./
COPY --chown=nodejs:nodejs --from=prod-deps /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist

USER nodejs

EXPOSE 4000

# Use node directly for better signal handling
CMD ["node", "dist/main.js"]
