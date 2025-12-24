#!/bin/bash

# Script to migrate uploads from /root/mmms/backend/uploads to /var/www/mmms/uploads
# This allows nginx to serve files directly

set -e

SOURCE_DIR="/root/mmms/backend/uploads"
TARGET_DIR="/var/www/mmms/uploads"
WEB_USER="${WEB_USER:-www-data}"

echo "🚀 Migrating uploads directory for nginx serving..."
echo "📍 Source: $SOURCE_DIR"
echo "📍 Target: $TARGET_DIR"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory $SOURCE_DIR does not exist!"
    exit 1
fi

# Create target directory structure
echo "📁 Creating target directory structure..."
sudo mkdir -p "$TARGET_DIR/members"

# Copy files from source to target (preserving structure)
echo "📦 Copying files from $SOURCE_DIR to $TARGET_DIR..."
if [ -d "$SOURCE_DIR/members" ] && [ "$(ls -A $SOURCE_DIR/members 2>/dev/null)" ]; then
    echo "   Found files in $SOURCE_DIR/members, copying..."
    sudo cp -r "$SOURCE_DIR/members"/* "$TARGET_DIR/members/" 2>/dev/null || true
    echo "   ✅ Files copied successfully"
else
    echo "   ℹ️  No files found in source directory (this is OK if starting fresh)"
fi

# Set proper ownership
echo "🔐 Setting ownership to $WEB_USER..."
sudo chown -R $WEB_USER:$WEB_USER "$TARGET_DIR"

# Set proper permissions
echo "🔒 Setting permissions..."
sudo chmod -R 755 "$TARGET_DIR"
if [ -d "$TARGET_DIR/members" ]; then
    sudo find "$TARGET_DIR/members" -type f -exec chmod 644 {} \;
fi

# Verify
echo "✅ Verifying migration..."
if [ -d "$TARGET_DIR/members" ]; then
    file_count=$(find "$TARGET_DIR/members" -type f 2>/dev/null | wc -l)
    echo "   ✅ Target directory created"
    echo "   📊 Files in target: $file_count"
    ls -la "$TARGET_DIR/members" | head -5
else
    echo "   ⚠️  Warning: Target members directory not found"
fi

echo ""
echo "✅ Migration completed!"
echo ""
echo "📝 Next steps:"
echo "1. Update backend/.env: UPLOADS_DIR=$TARGET_DIR"
echo "2. Update nginx config to serve from $TARGET_DIR (already done in nginx-mmms-updated.conf)"
echo "3. Restart backend: pm2 restart mmms-backend"
echo "4. Reload nginx: sudo systemctl reload nginx"
echo ""
echo "💡 Note: Original files are still in $SOURCE_DIR"
echo "   You can delete them after verifying everything works:"
echo "   sudo rm -rf $SOURCE_DIR/members/*"

