FROM node:18-alpine AS builder

WORKDIR /app

# Copy frontend package files from monorepo structure
COPY apps/frontend/package*.json ./

# Install ALL dependencies including devDependencies (vite is a devDep)
RUN npm install --include=dev

# Copy frontend source code from monorepo structure
COPY apps/frontend/ ./

# Build the app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Production image
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Set permissions
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]
