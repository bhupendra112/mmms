#!/bin/bash

# Script to verify multer fix and environment variables

echo "✅ Verifying Fix Completion"
echo "==========================="
echo ""

cd /root/mmms/backend || exit 1

# 1. Verify multer is installed
echo "1️⃣ Checking multer installation..."
if [ -d "node_modules/multer" ]; then
    echo "   ✅ multer package is installed"
    VERSION=$(npm list multer 2>/dev/null | grep multer | head -1 | awk '{print $NF}' | tr -d '└─')
    echo "   Version: $VERSION"
else
    echo "   ❌ multer package not found"
fi
echo ""

# 2. Verify UPLOADS_DIR in .env
echo "2️⃣ Checking UPLOADS_DIR in .env..."
if grep -q "^UPLOADS_DIR=" .env; then
    UPLOADS_DIR=$(grep "^UPLOADS_DIR=" .env | cut -d'=' -f2)
    echo "   ✅ UPLOADS_DIR is set: $UPLOADS_DIR"
    
    if [ "$UPLOADS_DIR" = "/var/www/mmms/uploads" ]; then
        echo "   ✅ Correct production path"
    else
        echo "   ⚠️  Not set to production path"
    fi
else
    echo "   ❌ UPLOADS_DIR not found in .env"
fi
echo ""

# 3. Restart PM2 with updated environment
echo "3️⃣ Restarting PM2 with updated environment..."
pm2 restart my-server --update-env
sleep 3
echo ""

# 4. Check for multer errors
echo "4️⃣ Checking for multer/module errors..."
MULTER_ERROR=$(pm2 logs my-server --err --lines 30 --nostream 2>/dev/null | grep -i "multer\|ERR_MODULE_NOT_FOUND" | tail -1)
if [ -n "$MULTER_ERROR" ]; then
    echo "   ⚠️  Found error:"
    echo "   $MULTER_ERROR"
else
    echo "   ✅ No multer/module errors found"
fi
echo ""

# 5. Check server status
echo "5️⃣ Server Status:"
pm2 list | grep my-server
echo ""

# 6. Test server response
echo "6️⃣ Testing server response..."
if curl -s -f http://localhost:8080/ > /dev/null 2>&1; then
    RESPONSE=$(curl -s http://localhost:8080/)
    echo "   ✅ Server responding: $RESPONSE"
else
    echo "   ❌ Server not responding"
fi
echo ""

# 7. Check MongoDB connection
echo "7️⃣ MongoDB Connection:"
if pm2 logs my-server --out --lines 30 --nostream 2>/dev/null | grep -q "Database connected successfully"; then
    echo "   ✅ MongoDB connected"
else
    echo "   ⚠️  Could not verify MongoDB connection"
fi
echo ""

# 8. Verify uploads directory
echo "8️⃣ Verifying uploads directory..."
if [ -n "$UPLOADS_DIR" ] && [ -d "$UPLOADS_DIR" ]; then
    echo "   ✅ Directory exists: $UPLOADS_DIR"
    FILE_COUNT=$(find "$UPLOADS_DIR" -type f 2>/dev/null | wc -l)
    echo "   Files in directory: $FILE_COUNT"
    
    if [ -d "$UPLOADS_DIR/members" ]; then
        MEMBER_FILES=$(find "$UPLOADS_DIR/members" -type f 2>/dev/null | wc -l)
        echo "   Member files: $MEMBER_FILES"
    fi
else
    echo "   ⚠️  Directory does not exist: $UPLOADS_DIR"
fi
echo ""

echo "📊 Summary:"
echo "   - multer: $(if [ -d "node_modules/multer" ]; then echo "✅ Installed"; else echo "❌ Missing"; fi)"
echo "   - UPLOADS_DIR: $(grep "^UPLOADS_DIR=" .env 2>/dev/null | cut -d'=' -f2 || echo "Not set")"
echo "   - Server: $(pm2 list | grep my-server | awk '{print $10}' || echo "Unknown")"
echo "   - Multer errors: $(if [ -z "$MULTER_ERROR" ]; then echo "✅ None"; else echo "⚠️ Found"; fi)"
echo ""
echo "✅ Verification complete!"






