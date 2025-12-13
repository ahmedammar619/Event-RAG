FROM node:18-alpine AS builder

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm install --include=dev

# Copy source code
COPY . .

# Build the app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npx vite build

# Production image
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf

# Set permissions
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]
