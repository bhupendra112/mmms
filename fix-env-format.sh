#!/bin/bash

# Fix .env file formatting issue

cd /root/mmms/backend || exit 1

echo "🔧 Fixing .env file formatting..."
echo ""

# Backup .env
cp .env .env.backup
echo "✅ Backup created: .env.backup"
echo ""

# Fix the formatting issue - ensure proper newlines
# Replace the malformed line with properly formatted lines
sed -i 's/JWT_EXPIRES_IN=1dUPLOADS_DIR=/JWT_EXPIRES_IN=1d\nUPLOADS_DIR=/' .env

echo "✅ .env file formatted correctly"
echo ""
echo "📄 Current .env content:"
cat .env
echo ""

# Restart with updated environment
echo "🔄 Restarting PM2 with updated environment..."
pm2 restart my-server --update-env
sleep 3

echo ""
echo "✅ Done! Server restarted with corrected environment variables."






