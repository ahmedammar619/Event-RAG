FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy backend package files from monorepo structure
COPY apps/backend/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy backend source code from monorepo structure
COPY apps/backend/ ./

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "src/app.js"]
