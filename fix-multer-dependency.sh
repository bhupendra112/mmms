#!/bin/bash

# Script to fix missing multer dependency and set UPLOADS_DIR

echo "🔧 Fixing Backend Dependencies"
echo "=============================="
echo ""

cd /root/mmms/backend || exit 1

# Check if multer is installed
echo "1️⃣ Checking multer installation..."
if [ -d "node_modules/multer" ]; then
    echo "   ✅ multer directory exists"
else
    echo "   ❌ multer not found, installing..."
    npm install multer@^2.0.2 --legacy-peer-deps
    if [ $? -eq 0 ]; then
        echo "   ✅ multer installed successfully"
    else
        echo "   ❌ Failed to install multer"
        exit 1
    fi
fi

echo ""

# Verify multer installation
echo "2️⃣ Verifying multer..."
if npm list multer 2>/dev/null | grep -q "multer@"; then
    VERSION=$(npm list multer 2>/dev/null | grep multer | head -1 | awk '{print $NF}' | tr -d '└─')
    echo "   ✅ multer is installed: $VERSION"
else
    echo "   ⚠️  Could not verify multer version"
fi

echo ""

# Check and set UPLOADS_DIR in .env
echo "3️⃣ Checking UPLOADS_DIR in .env..."
if [ -f ".env" ]; then
    if grep -q "^UPLOADS_DIR=" .env; then
        CURRENT_DIR=$(grep "^UPLOADS_DIR=" .env | cut -d'=' -f2)
        echo "   ℹ️  UPLOADS_DIR is set to: $CURRENT_DIR"
        
        if [ "$CURRENT_DIR" != "/var/www/mmms/uploads" ]; then
            echo "   ⚠️  UPLOADS_DIR is not set to production path"
            read -p "   Update UPLOADS_DIR to /var/www/mmms/uploads? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sed -i 's|^UPLOADS_DIR=.*|UPLOADS_DIR=/var/www/mmms/uploads|' .env
                echo "   ✅ UPLOADS_DIR updated to /var/www/mmms/uploads"
            fi
        else
            echo "   ✅ UPLOADS_DIR is correctly set"
        fi
    else
        echo "   ⚠️  UPLOADS_DIR not found in .env, adding..."
        echo "UPLOADS_DIR=/var/www/mmms/uploads" >> .env
        echo "   ✅ UPLOADS_DIR added to .env"
    fi
else
    echo "   ❌ .env file not found"
    exit 1
fi

echo ""

# Verify uploads directory exists
echo "4️⃣ Verifying uploads directory..."
UPLOADS_DIR=$(grep "^UPLOADS_DIR=" .env | cut -d'=' -f2)
if [ -n "$UPLOADS_DIR" ] && [ -d "$UPLOADS_DIR" ]; then
    echo "   ✅ Directory exists: $UPLOADS_DIR"
    PERM=$(stat -c "%a" "$UPLOADS_DIR" 2>/dev/null || stat -f "%OLp" "$UPLOADS_DIR" 2>/dev/null)
    OWNER=$(stat -c "%U:%G" "$UPLOADS_DIR" 2>/dev/null || stat -f "%Su:%Sg" "$UPLOADS_DIR" 2>/dev/null)
    echo "   Permissions: $PERM, Owner: $OWNER"
else
    echo "   ⚠️  Directory does not exist: $UPLOADS_DIR"
    echo "   Creating directory..."
    mkdir -p "$UPLOADS_DIR/members"
    chown -R www-data:www-data "$UPLOADS_DIR"
    chmod -R 755 "$UPLOADS_DIR"
    echo "   ✅ Directory created with proper permissions"
fi

echo ""

# Restart PM2 process
echo "5️⃣ Restarting backend server..."
pm2 restart my-server
sleep 2

# Check if server started successfully
if pm2 list | grep -q "my-server.*online"; then
    echo "   ✅ Server restarted successfully"
else
    echo "   ❌ Server failed to restart"
    pm2 logs my-server --err --lines 10
    exit 1
fi

echo ""

# Wait a moment and check for multer errors
echo "6️⃣ Checking for multer errors after restart..."
sleep 3
MULTER_ERROR=$(pm2 logs my-server --err --lines 20 --nostream 2>/dev/null | grep -i "multer\|ERR_MODULE_NOT_FOUND" | tail -1)
if [ -n "$MULTER_ERROR" ]; then
    echo "   ⚠️  Still seeing multer errors:"
    echo "   $MULTER_ERROR"
    echo ""
    echo "   Trying to reinstall all dependencies..."
    cd /root/mmms/backend
    rm -rf node_modules package-lock.json
    npm install --legacy-peer-deps
    pm2 restart my-server
    sleep 3
else
    echo "   ✅ No multer errors found"
fi

echo ""
echo "✅ Dependency fix complete!"
echo ""
echo "📋 Summary:"
echo "   - multer: $(npm list multer 2>/dev/null | grep multer | head -1 | awk '{print $NF}' | tr -d '└─' || echo 'Not found')"
echo "   - UPLOADS_DIR: $(grep "^UPLOADS_DIR=" .env 2>/dev/null | cut -d'=' -f2 || echo 'Not set')"
echo "   - Server status: $(pm2 list | grep my-server | awk '{print $10}' || echo 'Unknown')"






