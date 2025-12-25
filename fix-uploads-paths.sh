#!/bin/bash

# Script to fix uploads directory and migrate files for nginx serving
# This ensures files are accessible via nginx

set -e

SOURCE_DIR="/root/mmms/backend/uploads"
TARGET_DIR="/var/www/mmms/uploads"
WEB_USER="${WEB_USER:-www-data}"

echo "🔧 Fixing uploads directory for file serving..."
echo "📍 Source: $SOURCE_DIR"
echo "📍 Target: $TARGET_DIR"

# 1. Create target directory structure
echo "📁 Creating target directory structure..."
sudo mkdir -p "$TARGET_DIR/members"

# 2. Copy existing files from source to target
if [ -d "$SOURCE_DIR/members" ] && [ "$(ls -A $SOURCE_DIR/members 2>/dev/null)" ]; then
    echo "📦 Copying existing files..."
    file_count=$(find "$SOURCE_DIR/members" -type f 2>/dev/null | wc -l)
    echo "   Found $file_count files to copy"
    
    sudo cp -r "$SOURCE_DIR/members"/* "$TARGET_DIR/members/" 2>/dev/null || true
    echo "   ✅ Files copied"
else
    echo "   ℹ️  No existing files to copy"
fi

# 3. Set proper ownership
echo "🔐 Setting ownership to $WEB_USER..."
sudo chown -R $WEB_USER:$WEB_USER "$TARGET_DIR"

# 4. Set proper permissions
echo "🔒 Setting permissions..."
sudo chmod -R 755 "$TARGET_DIR"
if [ -d "$TARGET_DIR/members" ]; then
    sudo find "$TARGET_DIR/members" -type f -exec chmod 644 {} \;
    sudo find "$TARGET_DIR/members" -type d -exec chmod 755 {} \;
fi

# 5. Verify
echo "✅ Verifying setup..."
if [ -d "$TARGET_DIR/members" ]; then
    target_count=$(find "$TARGET_DIR/members" -type f 2>/dev/null | wc -l)
    echo "   ✅ Target directory: $TARGET_DIR/members"
    echo "   📊 Files in target: $target_count"
    ls -la "$TARGET_DIR/members" | head -5
else
    echo "   ❌ Target directory not found!"
    exit 1
fi

# 6. Test file access
echo ""
echo "🧪 Testing file access..."
if [ -d "$TARGET_DIR/members" ] && [ "$(ls -A $TARGET_DIR/members 2>/dev/null)" ]; then
    test_file=$(ls "$TARGET_DIR/members" | head -1)
    if [ -f "$TARGET_DIR/members/$test_file" ]; then
        echo "   ✅ Test file accessible: $test_file"
        echo "   📍 Full path: $TARGET_DIR/members/$test_file"
    fi
fi

echo ""
echo "✅ Setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Update backend/.env: UPLOADS_DIR=$TARGET_DIR"
echo "2. Restart backend: pm2 restart mmms-backend"
echo "3. Reload nginx: sudo systemctl reload nginx"
echo "4. Test file access: curl -I https://mmms.online/uploads/members/[filename]"



