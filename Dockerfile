# 1. Build stage (used for both dev and prod)
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package-lock.json package.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# 2. Development stage (for hot reload)
FROM node:24-alpine AS development

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package-lock.json package.json ./
RUN npm ci

# Copy source code (will be overridden by volume mount in docker-compose)
COPY . .

EXPOSE 4000

CMD ["npm", "run", "start:dev"]

# 3. Production stage
FROM node:24-alpine AS production

WORKDIR /app

# Copy production dependencies and build from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/dist ./dist

# Install only production dependencies
RUN npm ci --omit=dev

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000

# Use node directly for better signal handling
CMD ["node", "dist/main"]
