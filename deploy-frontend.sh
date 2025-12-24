#!/bin/bash

# Script to deploy frontend from /root/mmms/frontend to /var/www/mmms/frontend

# Don't exit on error for permission fixes - continue even if some steps fail
set +e

SOURCE_DIR="/root/mmms/frontend"
TARGET_DIR="/var/www/mmms/frontend"

echo "🚀 Starting frontend deployment..."
echo "📍 Source: $SOURCE_DIR"
echo "📍 Target: $TARGET_DIR"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory $SOURCE_DIR does not exist!"
    exit 1
fi

# 1. Backup existing dist folder if it exists (preserve build)
if [ -d "$TARGET_DIR/dist" ]; then
    echo "💾 Backing up existing dist folder..."
    sudo cp -r "$TARGET_DIR/dist" "$TARGET_DIR/dist.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
fi

# 2. Sync source files (excluding node_modules, dist, .git)
echo "📦 Syncing source files from $SOURCE_DIR to $TARGET_DIR..."
sudo mkdir -p "$TARGET_DIR"
sudo rsync -av --delete \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.git' \
    --exclude 'dist.backup.*' \
    --exclude '.env.local' \
    "$SOURCE_DIR/" "$TARGET_DIR/"

# 3. Set proper permissions
echo "🔐 Setting proper permissions..."
sudo chown -R www-data:www-data "$TARGET_DIR" 2>/dev/null || sudo chown -R nginx:nginx "$TARGET_DIR" 2>/dev/null || true
sudo chmod -R 755 "$TARGET_DIR"

# 4. Fix npm cache permissions (if needed)
echo "🔧 Fixing npm cache permissions..."
if [ -d "/var/www/.npm" ]; then
    sudo chown -R www-data:www-data /var/www/.npm 2>/dev/null || sudo chown -R 33:33 /var/www/.npm 2>/dev/null || true
fi
# Also fix npm cache in home directory
if [ -d "$HOME/.npm" ]; then
    sudo chown -R $USER:$USER "$HOME/.npm" 2>/dev/null || true
fi

# 5. Navigate to frontend and clean node_modules
echo "🧹 Cleaning existing node_modules and cache..."
cd "$TARGET_DIR"
sudo rm -rf node_modules package-lock.json .vite-temp 2>/dev/null || true
npm cache clean --force 2>/dev/null || true

# 6. Install dependencies (as root, including dev dependencies for build)
echo "📥 Installing all dependencies (including dev dependencies)..."
npm install --legacy-peer-deps

# Verify critical build dependencies are installed
echo "🔍 Verifying critical build dependencies..."
MISSING_DEPS=0
if [ ! -d "node_modules/@vitejs/plugin-react" ]; then
    echo "⚠️  @vitejs/plugin-react not found, installing..."
    npm install @vitejs/plugin-react@^5.1.1 --legacy-peer-deps --save-dev
    MISSING_DEPS=1
fi
if [ ! -d "node_modules/vite" ]; then
    echo "⚠️  vite not found, installing..."
    npm install vite@^7.2.4 --legacy-peer-deps --save-dev
    MISSING_DEPS=1
fi
if [ ! -d "node_modules/@tailwindcss/vite" ]; then
    echo "⚠️  @tailwindcss/vite not found, installing..."
    npm install @tailwindcss/vite@^4.1.17 --legacy-peer-deps
    MISSING_DEPS=1
fi

# If any dependencies were missing, reinstall everything
if [ $MISSING_DEPS -eq 1 ]; then
    echo "🔄 Reinstalling all dependencies to ensure completeness..."
    npm install --legacy-peer-deps
fi

# 7. Set permissions after install
echo "🔐 Setting permissions after install..."
sudo chown -R www-data:www-data "$TARGET_DIR" 2>/dev/null || sudo chown -R nginx:nginx "$TARGET_DIR" 2>/dev/null || true
sudo chmod -R 755 "$TARGET_DIR"

# 8. Build the frontend for production
echo "🏗️  Building frontend for production..."
set -e  # Exit on error for build
npm run build
set +e  # Continue on error after build

# 9. Set permissions on dist folder
echo "🔐 Setting permissions on build output..."
sudo chown -R www-data:www-data "$TARGET_DIR/dist" 2>/dev/null || sudo chown -R nginx:nginx "$TARGET_DIR/dist" 2>/dev/null || true
sudo chmod -R 755 "$TARGET_DIR/dist"

# 10. Verify deployment
echo "✅ Verifying deployment..."
ls -la "$TARGET_DIR/" | head -10
if [ -d "$TARGET_DIR/dist" ]; then
    echo "✅ Build output found in $TARGET_DIR/dist"
    ls -lh "$TARGET_DIR/dist" | head -5
else
    echo "⚠️  Warning: dist folder not found!"
fi

echo ""
echo "✅ Frontend deployment completed successfully!"
echo "📍 Source: $SOURCE_DIR"
echo "📍 Target: $TARGET_DIR"
echo "📦 Build output: $TARGET_DIR/dist"

