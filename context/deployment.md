# Deployment Guide

## Overview

The system is deployed to Railway with:
- PostgreSQL database (already provisioned)
- Backend service (Fastify API)
- Frontend service (React + Nginx)

## Railway Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Railway                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │───▶│   Backend    │───▶│  PostgreSQL  │  │
│  │   (Nginx)    │    │  (Fastify)   │    │  (Database)  │  │
│  │   Port 3000  │    │   Port 3001  │    │  Port 29070  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│         │                   │                    │          │
│    Public URL          Internal URL         Internal URL    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. Railway account: https://railway.app
2. Railway CLI installed:
   ```bash
   npm install -g @railway/cli
   ```
3. Git repository with your code

## Database (Already Configured)

The PostgreSQL database is already provisioned on Railway:

```
Host: <from Railway dashboard>
Port: <from Railway dashboard>
Database: railway
User: postgres
Password: <from Railway dashboard>

Connection String: Get from Railway dashboard > PostgreSQL service > Connect tab
```

### Initialize Database Schema

Run migrations locally or through Railway's shell:

```bash
# Option 1: Run locally
DATABASE_URL="<your-railway-connection-string>" \
  node apps/backend/scripts/migrate.js

# Option 2: Through Railway shell
railway shell
node scripts/migrate.js
```

## Deploy Backend

### Step 1: Login to Railway

```bash
railway login
```

### Step 2: Initialize Backend Service

```bash
cd apps/backend
railway init
# Select "Create new project" or add to existing
# Name it: moderation-backend
```

### Step 3: Link to Project

```bash
railway link
# Select your project
```

### Step 4: Set Environment Variables

Via CLI:
```bash
railway variables set DATABASE_URL="<your-railway-connection-string>"
railway variables set PORT=3001
railway variables set JWT_SECRET="your-production-secret"
railway variables set CORS_ORIGIN="https://your-frontend-url.railway.app"
railway variables set NODE_ENV=production
railway variables set ADMIN_EMAIL="admin@mascom.org"
railway variables set ADMIN_PASSWORD="secure-initial-password"
```

Or via Railway Dashboard:
1. Go to your project
2. Click on the backend service
3. Go to Variables tab
4. Add each variable

### Step 5: Deploy

```bash
railway up
```

### Step 6: Get Backend URL

```bash
railway domain
# or check Railway dashboard for the generated URL
```

## Deploy Frontend

### Step 1: Initialize Frontend Service

```bash
cd apps/frontend
railway init
# Add to existing project
# Name it: moderation-frontend
```

### Step 2: Set Environment Variables

```bash
railway variables set VITE_API_URL="https://your-backend-url.railway.app"
```

### Step 3: Deploy

```bash
railway up
```

### Step 4: Get Frontend URL

```bash
railway domain
```

## Update Backend CORS

After getting the frontend URL, update the backend:

```bash
cd apps/backend
railway variables set CORS_ORIGIN="https://your-frontend-url.railway.app"
railway up
```

## Dockerfile Configurations

### Backend Dockerfile

```dockerfile
# apps/backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start with migrations
CMD ["sh", "-c", "node scripts/migrate.js && node src/app.js"]
```

### Frontend Dockerfile

```dockerfile
# apps/frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build with environment variables
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Production image
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### Frontend nginx.conf

```nginx
# apps/frontend/nginx.conf
server {
    listen 3000;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

## Railway Configuration Files

### railway.json (Backend)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node src/app.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### railway.json (Frontend)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/",
    "healthcheckTimeout": 30
  }
}
```

## Environment Variables Summary

### Backend
| Variable | Example | Description |
|----------|---------|-------------|
| DATABASE_URL | postgresql://... | PostgreSQL connection string |
| PORT | 3001 | Server port |
| HOST | 0.0.0.0 | Server host |
| JWT_SECRET | random-string | JWT signing secret |
| CORS_ORIGIN | https://frontend.railway.app | Frontend URL |
| NODE_ENV | production | Environment |
| ADMIN_EMAIL | admin@mascom.org | Initial admin email |
| ADMIN_PASSWORD | secret | Initial admin password |

### Frontend
| Variable | Example | Description |
|----------|---------|-------------|
| VITE_API_URL | https://backend.railway.app | Backend API URL |

## Deployment Checklist

- [ ] Database migrations run successfully
- [ ] Backend deployed and health check passes
- [ ] Frontend deployed and loads correctly
- [ ] CORS configured correctly (no CORS errors)
- [ ] Admin can login
- [ ] API endpoints respond correctly
- [ ] Moderator registration works
- [ ] Availability submission works

## Troubleshooting

### CORS Errors
Ensure CORS_ORIGIN in backend matches the exact frontend URL (including https://).

### Database Connection Issues
- Check DATABASE_URL is correct
- Ensure Railway's PostgreSQL service is running
- Check if IP allowlist is needed

### Build Failures
- Check Railway build logs
- Ensure all dependencies are in package.json
- Verify Dockerfile syntax

### Health Check Failures
- Ensure /api/health endpoint returns 200
- Check PORT is correctly set
- Review application logs

## Rollback

Railway keeps deployment history. To rollback:

1. Go to Railway Dashboard
2. Select the service
3. Go to Deployments tab
4. Click on a previous deployment
5. Click "Rollback"

## Monitoring

Railway provides:
- Real-time logs
- Metrics (CPU, Memory)
- Deployment status

Access via Railway Dashboard or CLI:
```bash
railway logs
railway status
```
