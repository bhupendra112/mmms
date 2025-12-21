#!/bin/bash

# Script to deploy frontend from ~/mmms to /var/www/mmms/

echo "Starting frontend deployment..."

# 1. Backup existing frontend if it exists
if [ -d "/var/www/mmms/frontend" ]; then
    echo "Backing up existing frontend..."
    sudo mv /var/www/mmms/frontend /var/www/mmms/frontend.backup.$(date +%Y%m%d_%H%M%S)
fi

# 2. Copy new frontend from GitHub location to production
echo "Copying frontend to production location..."
sudo cp -r ~/mmms/frontend /var/www/mmms/

# 3. Set proper permissions
echo "Setting permissions..."
sudo chown -R www-data:www-data /var/www/mmms/frontend
sudo chmod -R 755 /var/www/mmms/frontend

# 4. Navigate to frontend and install dependencies
echo "Installing dependencies..."
cd /var/www/mmms/frontend
sudo -u www-data npm install --production

# 5. Build the frontend for production
echo "Building frontend for production..."
sudo -u www-data npm run build

# 6. Verify deployment
echo "Verifying deployment..."
ls -la /var/www/mmms/

echo "✅ Frontend deployment completed successfully!"

