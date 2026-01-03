#!/bin/bash

cd ./hermes-trading-post/backend

echo "🚀 Starting Hermes Trading Backend..."
echo "📂 Working directory: $(pwd)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the backend server
npm run start
