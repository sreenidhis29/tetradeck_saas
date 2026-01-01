# ============================================================
# Enterprise HR System - Backend Dockerfile
# ============================================================
# Multi-stage build for optimized production image

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Stage 2: Production
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source from builder
COPY --from=builder /app/src ./src
COPY --from=builder /app/migrations ./migrations

# Create necessary directories
RUN mkdir -p logs uploads backups && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health/live || exit 1

# Start command
CMD ["node", "src/server.js"]
