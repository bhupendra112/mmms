#!/bin/bash

# Script to verify backend health and check for module errors

echo "🔍 Backend Health Check"
echo "======================"
echo ""

# Check PM2 status
echo "1️⃣ PM2 Process Status:"
pm2 list | grep -E "my-server|mmms|backend" || echo "   ⚠️  No matching PM2 process found"
echo ""

# Check recent errors
echo "2️⃣ Recent Error Log (last 10 lines):"
pm2 logs my-server --err --lines 10 --nostream 2>/dev/null | tail -10 || echo "   ℹ️  No recent errors"
echo ""

# Check if server is responding
echo "3️⃣ Server Health Check:"
if curl -s -f http://localhost:8080/ > /dev/null 2>&1; then
    echo "   ✅ Server is responding on port 8080"
    RESPONSE=$(curl -s http://localhost:8080/)
    echo "   Response: $RESPONSE"
else
    echo "   ❌ Server is not responding on port 8080"
fi
echo ""

# Check MongoDB connection
echo "4️⃣ MongoDB Connection:"
if pm2 logs my-server --out --lines 20 --nostream 2>/dev/null | grep -q "Database connected successfully"; then
    echo "   ✅ MongoDB connection successful"
else
    echo "   ⚠️  Could not verify MongoDB connection from logs"
fi
echo ""

# Check for module errors in recent logs
echo "5️⃣ Module Import Errors:"
RECENT_ERRORS=$(pm2 logs my-server --err --lines 50 --nostream 2>/dev/null | grep -i "ERR_MODULE_NOT_FOUND\|Cannot find module\|MODULE_NOT_FOUND" | tail -5)
if [ -n "$RECENT_ERRORS" ]; then
    echo "   ⚠️  Found module errors:"
    echo "$RECENT_ERRORS" | sed 's/^/   /'
else
    echo "   ✅ No recent module errors found"
fi
echo ""

# Check backend dependencies
echo "6️⃣ Backend Dependencies:"
if [ -f "backend/package.json" ]; then
    cd backend
    echo "   Checking for missing dependencies..."
    MISSING=$(npm list --depth=0 2>&1 | grep -i "missing\|ERR!" | head -5)
    if [ -n "$MISSING" ]; then
        echo "   ⚠️  Potential missing dependencies:"
        echo "$MISSING" | sed 's/^/   /'
    else
        echo "   ✅ All dependencies appear to be installed"
    fi
    cd ..
else
    echo "   ⚠️  package.json not found"
fi
echo ""

# Check uploads directory
echo "7️⃣ Uploads Directory:"
if [ -n "$UPLOADS_DIR" ]; then
    echo "   UPLOADS_DIR: $UPLOADS_DIR"
    if [ -d "$UPLOADS_DIR" ]; then
        echo "   ✅ Directory exists"
        PERM=$(stat -c "%a" "$UPLOADS_DIR" 2>/dev/null || stat -f "%OLp" "$UPLOADS_DIR" 2>/dev/null)
        echo "   Permissions: $PERM"
    else
        echo "   ❌ Directory does not exist"
    fi
else
    echo "   ℹ️  UPLOADS_DIR not set (using default)"
fi
echo ""

# Summary
echo "📊 Summary:"
if curl -s -f http://localhost:8080/ > /dev/null 2>&1; then
    echo "   ✅ Backend server is running and healthy"
else
    echo "   ❌ Backend server may have issues"
fi

