#!/bin/bash

# Complete production deployment script for MMMS

echo "🚀 Starting production deployment..."
echo ""

# ============================================
# BACKEND SETUP
# ============================================
echo "📦 STEP 1: Fixing Backend Dependencies"
echo "======================================"
cd ~/mmms/backend

# Install dependencies
echo "Installing npm packages..."
npm install

# Check if multer is installed
if [ ! -d "node_modules/multer" ]; then
    echo "⚠️  multer not found, installing..."
    npm install multer --save
fi

# Ensure uploads directory exists
mkdir -p ~/mmms/backend/uploads/members

# Restart backend
echo "🔄 Restarting backend server..."
pm2 restart my-server
sleep 2

# Check backend status
echo "📊 Backend PM2 Status:"
pm2 status my-server

echo ""
echo ""

# ============================================
# FRONTEND SETUP
# ============================================
echo "🌐 STEP 2: Building Frontend for Production"
echo "=========================================="

# Copy frontend to production location
echo "Copying frontend to /var/www/mmms/..."
sudo rm -rf /var/www/mmms/frontend
sudo cp -r ~/mmms/frontend /var/www/mmms/
sudo chown -R www-data:www-data /var/www/mmms/frontend
sudo chmod -R 755 /var/www/mmms/frontend

# Navigate to frontend
cd /var/www/mmms/frontend

# Create/Update .env file with production API URL
echo "Setting production API URL..."
sudo tee .env.production > /dev/null <<EOF
VITE_BASE_URL=https://mmms.online/api
EOF

# Install dependencies
echo "Installing frontend dependencies..."
sudo npm install

# Build with production environment
echo "Building frontend for production..."
VITE_BASE_URL=https://mmms.online/api sudo -E npm run build

# Verify build
if [ -d "dist" ]; then
    echo "✅ Frontend built successfully!"
    ls -lah dist/
else
    echo "❌ Frontend build failed!"
    exit 1
fi

echo ""
echo ""

# ============================================
# FINAL CHECKS
# ============================================
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================"
echo ""
echo "Backend Status:"
pm2 status my-server
echo ""
echo "Backend Logs (last 10 lines):"
pm2 logs my-server --lines 10 --nostream
echo ""
echo "Frontend location: /var/www/mmms/frontend/dist"
echo ""
echo "⚠️  Make sure your web server (nginx/apache) is configured to serve:"
echo "   - Frontend: /var/www/mmms/frontend/dist"
echo "   - Backend API: Running on port 8080 (or your configured port)"
echo ""

