# Local Development Guide

## Overview

This guide covers setting up and running the development environment locally with hot reload support.

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm

## Quick Start

```bash
# Clone and install dependencies
git clone <repository-url>
cd moderation-system
npm install
cd apps/frontend && npm install && cd ../..

# Start development environment
./dev.sh
```

## Development Architecture

The development setup runs:
- **Backend**: In Docker container (port 3001)
- **Frontend**: Locally with Vite for hot reload (port 3000)

This architecture is necessary because Docker Desktop on Mac doesn't propagate file system events properly for hot module replacement (HMR).

```
┌─────────────────────────────────────────────────────┐
│                  Development Setup                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────┐    ┌──────────────────────┐  │
│  │   Frontend       │    │   Backend (Docker)   │  │
│  │   (Local Vite)   │───▶│   Fastify + Postgres │  │
│  │   Port 3000      │    │   Port 3001          │  │
│  │   Hot Reload ✓   │    │                      │  │
│  └──────────────────┘    └──────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Development Script (dev.sh)

The `dev.sh` script automates the development setup:

```bash
#!/bin/bash

# Development script with hot reload
# Backend runs in Docker, Frontend runs locally for hot reload

echo "=== Starting Development Environment ==="

# Stop any existing containers
docker compose -f docker-compose.dev.yml down 2>/dev/null

# Start backend in Docker
echo "Starting backend in Docker..."
docker compose -f docker-compose.dev.yml up backend -d

# Wait for backend
echo "Waiting for backend to be ready..."
sleep 3

# Check if backend is running
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✓ Backend is running on http://localhost:3001"
else
    echo "✓ Backend started on http://localhost:3001"
fi

# Install frontend dependencies if needed
if [ ! -d "apps/frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd apps/frontend && npm install && cd ../..
fi

# Run frontend locally with hot reload
echo ""
echo "Starting frontend with hot reload..."
echo "Frontend: http://localhost:3000"
echo ""
cd apps/frontend && npm run dev
```

## Docker Compose Files

### Production (docker-compose.yml)

Used for production deployment with both services in containers.

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:3001
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PORT=3001
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=http://localhost:3000
```

### Development (docker-compose.dev.yml)

Used for local development with volume mounts:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile.dev
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PORT=3001
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=http://localhost:3000
    volumes:
      - ./apps/backend/src:/app/src:delegated
      - ./apps/backend/scripts:/app/scripts:delegated
    command: npm run dev
```

## Vite Configuration

The frontend uses Vite with polling enabled for Docker compatibility:

```javascript
// apps/frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
      binaryInterval: 300
    },
    hmr: {
      overlay: true
    }
  },
  optimizeDeps: {
    exclude: ['fsevents']
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
```

## Environment Variables

### Backend (.env in project root)

```env
# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://postgres:password@host:port/railway

# Server
PORT=3001
HOST=0.0.0.0

# CORS
CORS_ORIGIN=http://localhost:3000

# JWT
JWT_SECRET=your-development-secret

# Admin (for seeding)
ADMIN_EMAIL=admin@mascon.org
ADMIN_PASSWORD=admin123
```

### Frontend

The frontend uses `VITE_API_URL` which defaults to `http://localhost:3001` in development.

## Database Operations

### Seeding the Database

```bash
# Run seed script (creates admin user and sample data)
docker compose -f docker-compose.dev.yml exec backend node scripts/seed.js
```

**Seed Output:**
```
Starting database seed...
Admin created: admin
Cleared existing data
Event days created: 3
Rooms created: 6
Moderators created: 10
Sessions created: 17
Availability slots created: 24
Assignments created: 7

Seed completed successfully!

Admin Login:
  Username: admin
  Password: admin123
```

### Running Migrations

```bash
docker compose -f docker-compose.dev.yml exec backend node scripts/migrate.js
```

### Accessing Database

```bash
# Connect to Railway PostgreSQL directly
psql $DATABASE_URL
```

## Common Commands

### Start Development

```bash
./dev.sh
```

### Stop All Services

```bash
docker compose -f docker-compose.dev.yml down
# Kill any lingering processes
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
```

### Rebuild Backend

```bash
docker compose -f docker-compose.dev.yml build backend
docker compose -f docker-compose.dev.yml up backend -d
```

### View Logs

```bash
# Backend logs
docker compose -f docker-compose.dev.yml logs -f backend

# Frontend logs appear in terminal running dev.sh
```

### Check Service Status

```bash
# Check if backend is healthy
curl http://localhost:3001/health

# Check if frontend is running
curl http://localhost:3000
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### Hot Reload Not Working

1. Ensure you're running frontend locally, not in Docker
2. Check Vite console for HMR messages
3. Try hard refresh (Cmd+Shift+R)

### Database Connection Issues

1. Verify DATABASE_URL is correct in .env
2. Check Docker container is running: `docker ps`
3. Test connection: `curl http://localhost:3001/health`

### Docker Build Errors

For monorepo, ensure docker-compose uses correct context:

```yaml
services:
  backend:
    build:
      context: .                           # Root of monorepo
      dockerfile: apps/backend/Dockerfile  # Path to Dockerfile
```

## Testing Changes

### Frontend Changes

1. Edit any file in `apps/frontend/src/`
2. Vite will detect the change and hot reload
3. Check terminal for HMR update message:
   ```
   12:16:37 AM [vite] hmr update /src/pages/Public/Landing.jsx
   ```

### Backend Changes

1. Edit any file in `apps/backend/src/`
2. Nodemon will restart the server (if using Dockerfile.dev)
3. Or restart the container manually:
   ```bash
   docker compose -f docker-compose.dev.yml restart backend
   ```

## Production Build

```bash
# Build both services
docker compose build

# Run production locally
docker compose up
```

## IDE Setup

### VS Code Extensions (Recommended)

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Docker
- PostgreSQL

### Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "tailwindCSS.includeLanguages": {
    "javascript": "javascript",
    "javascriptreact": "javascript"
  }
}
```
