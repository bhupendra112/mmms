#!/bin/bash

# Script to fix backend dependencies and ensure it's working

echo "🔧 Fixing backend dependencies..."

# Navigate to backend directory
cd ~/mmms/backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules not found. Installing dependencies..."
    npm install
else
    echo "📦 node_modules exists. Reinstalling to ensure all packages are present..."
    npm install
fi

# Check if multer is installed
if [ ! -d "node_modules/multer" ]; then
    echo "❌ multer still not found. Force installing..."
    npm install multer --save
fi

# Verify multer installation
if [ -d "node_modules/multer" ]; then
    echo "✅ multer is installed"
else
    echo "❌ Failed to install multer"
    exit 1
fi

# Ensure uploads directory exists
mkdir -p ~/mmms/backend/uploads/members

# Check .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Make sure it exists with proper configuration."
fi

echo ""
echo "🔄 Restarting backend server..."
pm2 restart my-server

echo ""
echo "⏳ Waiting 3 seconds for server to start..."
sleep 3

echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📋 Recent backend logs:"
pm2 logs my-server --lines 30 --nostream

echo ""
echo "✅ Backend fix complete!"
echo "If you still see errors, check: pm2 logs my-server"




