#!/bin/bash

# Script to set up uploads directory for production
# Run this script on your production server

set -e

# Configuration
UPLOADS_DIR="${UPLOADS_DIR:-/var/www/mmms/uploads}"
WEB_USER="${WEB_USER:-www-data}"

echo "🚀 Setting up uploads directory for MMMS..."
echo "📍 Directory: $UPLOADS_DIR"
echo "👤 Web user: $WEB_USER"

# Create uploads directory structure
echo "📁 Creating directory structure..."
sudo mkdir -p "$UPLOADS_DIR/members"

# Set ownership
echo "🔐 Setting ownership..."
sudo chown -R $WEB_USER:$WEB_USER "$UPLOADS_DIR"

# Set permissions
echo "🔒 Setting permissions..."
sudo chmod -R 755 "$UPLOADS_DIR"
sudo chmod -R 644 "$UPLOADS_DIR/members"/* 2>/dev/null || true

# Verify
echo "✅ Verifying setup..."
ls -la "$UPLOADS_DIR" | head -5
if [ -d "$UPLOADS_DIR/members" ]; then
    echo "✅ Members directory created successfully"
else
    echo "❌ Failed to create members directory"
    exit 1
fi

echo ""
echo "✅ Uploads directory setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Add to backend/.env: UPLOADS_DIR=$UPLOADS_DIR"
echo "2. Update nginx configuration to serve /uploads/ from $UPLOADS_DIR"
echo "3. Restart backend: pm2 restart mmms-backend"
echo "4. Reload nginx: sudo systemctl reload nginx"

