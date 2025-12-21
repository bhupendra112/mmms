#!/bin/bash

# Script to fix multer installation issue in backend

echo "🔧 Fixing Multer Installation Issue"
echo "===================================="
echo ""

# Navigate to backend
cd ~/mmms/backend

# Check current status
echo "📋 Step 1: Checking current status..."
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules directory doesn't exist"
else
    echo "✅ node_modules directory exists"
    if [ -d "node_modules/multer" ]; then
        echo "✅ multer is already installed"
    else
        echo "❌ multer is NOT installed"
    fi
fi
echo ""

# Remove node_modules and package-lock.json to start fresh
echo "🗑️  Step 2: Cleaning up (removing node_modules and package-lock.json)..."
rm -rf node_modules package-lock.json
echo "✅ Cleanup complete"
echo ""

# Install all dependencies fresh
echo "📦 Step 3: Installing all dependencies..."
npm install
echo ""

# Verify multer installation
echo "🔍 Step 4: Verifying multer installation..."
if [ -d "node_modules/multer" ]; then
    echo "✅ multer is installed successfully"
    ls -la node_modules/multer/package.json
else
    echo "❌ multer installation failed, trying explicit install..."
    npm install multer --save
    if [ -d "node_modules/multer" ]; then
        echo "✅ multer installed via explicit install"
    else
        echo "❌ Failed to install multer"
        exit 1
    fi
fi
echo ""

# Restart PM2
echo "🔄 Step 5: Restarting backend server..."
pm2 restart my-server
echo "⏳ Waiting 5 seconds for server to start..."
sleep 5
echo ""

# Check logs for errors
echo "📋 Step 6: Checking server logs for multer errors..."
if pm2 logs my-server --lines 50 --nostream 2>&1 | grep -q "Cannot find package 'multer'"; then
    echo "❌ Multer error still present in logs"
    echo "Recent error logs:"
    pm2 logs my-server --err --lines 10 --nostream | tail -10
else
    echo "✅ No multer errors found in recent logs"
fi
echo ""

# Test backend endpoint
echo "🧪 Step 7: Testing backend endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/)
if [ "$response" == "200" ] || [ -n "$response" ]; then
    echo "✅ Backend is responding (HTTP $response)"
else
    echo "⚠️  Backend might not be responding"
fi
echo ""

# Final status
echo "📊 Final PM2 Status:"
pm2 status
echo ""
echo "✅ Fix complete! Check the logs above to verify multer is working."

