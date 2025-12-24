#!/bin/bash

# Script to sync frontend code from /root/mmms/frontend to /var/www/mmms/frontend

set -e  # Exit on error

SOURCE_DIR="/root/mmms/frontend"
TARGET_DIR="/var/www/mmms/frontend"

echo "🔄 Syncing frontend code from $SOURCE_DIR to $TARGET_DIR..."

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory $SOURCE_DIR does not exist!"
    exit 1
fi

# Create target directory if it doesn't exist
if [ ! -d "$TARGET_DIR" ]; then
    echo "📁 Creating target directory: $TARGET_DIR"
    mkdir -p "$TARGET_DIR"
fi

# Backup existing dist folder if it exists
if [ -d "$TARGET_DIR/dist" ]; then
    echo "💾 Backing up existing dist folder..."
    cp -r "$TARGET_DIR/dist" "$TARGET_DIR/dist.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
fi

# Sync all files except node_modules and dist
echo "📦 Syncing source files..."
rsync -av --delete \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.git' \
    --exclude 'dist.backup.*' \
    "$SOURCE_DIR/" "$TARGET_DIR/"

# Install dependencies in target directory
echo "📥 Installing dependencies in $TARGET_DIR..."
cd "$TARGET_DIR"
npm install --production=false

# Build the frontend
echo "🏗️  Building frontend for production..."
npm run build

# Set proper permissions
echo "🔐 Setting proper permissions..."
chown -R www-data:www-data "$TARGET_DIR" 2>/dev/null || chown -R nginx:nginx "$TARGET_DIR" 2>/dev/null || true
chmod -R 755 "$TARGET_DIR"

echo "✅ Frontend sync completed successfully!"
echo "📍 Source: $SOURCE_DIR"
echo "📍 Target: $TARGET_DIR"
echo "📦 Build output: $TARGET_DIR/dist"

