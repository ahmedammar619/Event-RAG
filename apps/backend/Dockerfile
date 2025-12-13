FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy backend package files from monorepo structure
COPY apps/backend/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy backend source code from monorepo structure
COPY apps/backend/ ./

# Railway sets PORT dynamically
ENV PORT=3001

EXPOSE 3001

# Start the application
CMD ["node", "src/app.js"]
