#!/bin/bash

# Script to fix backend dependencies and restart the server

echo "🔧 Fixing backend dependencies..."

# Navigate to backend directory
cd ~/mmms/backend

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
    
    # Restart PM2 backend process
    echo "🔄 Restarting backend server..."
    pm2 restart my-server
    
    # Check PM2 status
    echo "📊 PM2 Status:"
    pm2 status
    
    echo ""
    echo "✅ Backend should now be working!"
    echo "📋 Check logs with: pm2 logs my-server"
else
    echo "❌ Failed to install dependencies. Please check the error above."
    exit 1
fi




