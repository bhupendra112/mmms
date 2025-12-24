#!/bin/bash

# Script to verify backend and frontend are working correctly

echo "🔍 Verifying Server Status"
echo "=========================="
echo ""

# Check PM2 status
echo "📊 PM2 Process Status:"
pm2 status
echo ""

# Test backend health endpoint
echo "🏥 Testing Backend Health:"
echo "Testing: http://localhost:8080/"
curl -s http://localhost:8080/ || echo "❌ Backend not responding on port 8080"
echo ""
echo ""

# Test backend API endpoint
echo "🔌 Testing Backend API:"
echo "Testing: http://localhost:8080/api/admin/auth/login (should return 400/401, not connection error)"
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/api/admin/auth/login -H "Content-Type: application/json" -d '{}')
if [ "$response" == "000" ]; then
    echo "❌ Backend API not accessible (connection refused)"
else
    echo "✅ Backend API responding (HTTP $response)"
fi
echo ""
echo ""

# Check if backend port is listening
echo "🔌 Checking if port 8080 is listening:"
if command -v netstat &> /dev/null; then
    netstat -tlnp | grep 8080 || echo "⚠️  Port 8080 not found in netstat"
elif command -v ss &> /dev/null; then
    ss -tlnp | grep 8080 || echo "⚠️  Port 8080 not found in ss"
else
    echo "⚠️  Cannot check port (netstat/ss not available)"
fi
echo ""

# Check backend logs for errors
echo "📋 Recent Backend Logs (checking for errors):"
pm2 logs my-server --lines 20 --nostream | tail -20
echo ""

# Check backend error logs specifically
echo "❌ Recent Backend Error Logs:"
pm2 logs my-server --err --lines 10 --nostream | tail -10
echo ""

# Check frontend location
echo "🌐 Frontend Status:"
if [ -d "/var/www/mmms/frontend/dist" ]; then
    echo "✅ Frontend dist folder exists"
    echo "   Location: /var/www/mmms/frontend/dist"
    ls -lah /var/www/mmms/frontend/dist/ | head -10
else
    echo "❌ Frontend dist folder not found at /var/www/mmms/frontend/dist"
    echo "   Frontend needs to be built: cd /var/www/mmms/frontend && npm run build"
fi
echo ""

# Check if frontend PM2 process is running (if it's a dev server)
echo "🖥️  Frontend PM2 Process:"
pm2 info frontend 2>/dev/null || echo "⚠️  Frontend PM2 process info not available"
echo ""

echo "✅ Verification complete!"




