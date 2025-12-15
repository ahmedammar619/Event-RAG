#!/bin/bash

# Development script - runs backend in Docker, frontend locally for hot reload

echo "Starting development environment..."
echo ""

# Stop any existing containers
docker compose -f docker-compose.dev.yml down 2>/dev/null

# Start backend in Docker (in background)
echo "Starting backend in Docker..."
docker compose -f docker-compose.dev.yml up --build -d

# Wait for backend to be ready
echo "Waiting for backend to start..."
sleep 3

# Check if backend is running
if ! docker compose -f docker-compose.dev.yml ps | grep -q "running"; then
    echo "ERROR: Backend failed to start. Check Docker logs:"
    docker compose -f docker-compose.dev.yml logs
    exit 1
fi

echo ""
echo "Backend is running on http://localhost:3001"
echo ""

# Install frontend dependencies if needed
if [ ! -d "apps/frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd apps/frontend && npm install && cd ../..
fi

# Start frontend locally
echo "Starting frontend with hot reload on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both frontend and backend"
echo ""

cd apps/frontend && npm run dev

# When frontend stops, also stop backend
echo ""
echo "Stopping backend..."
cd ../..
docker compose -f docker-compose.dev.yml down
