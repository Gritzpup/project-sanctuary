#!/bin/bash

cd ./hermes-trading-post

echo "🚀 Starting hermes-trading-post frontend..."

# Clean up any old processes
pkill -f "vite.*hermes" 2>/dev/null || true
sleep 1

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo "🚀 Starting frontend only (backend runs separately in Tilt)..."

# Start the frontend only
npm run dev:frontend
