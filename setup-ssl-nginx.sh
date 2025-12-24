#!/bin/bash

# Script to set up SSL/HTTPS for mmms.online using Let's Encrypt

echo "🔒 Setting up SSL/HTTPS for mmms.online"
echo "========================================"
echo ""

# 1. Install certbot if not installed
echo "1️⃣  Checking/Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
else
    echo "✅ Certbot is already installed"
fi
echo ""

# 2. Make sure nginx HTTP config is working first
echo "2️⃣  Ensuring HTTP config is correct..."
sudo bash -c 'cat > /etc/nginx/sites-available/mmms << "EOF"
server {
    listen 80;
    server_name mmms.online www.mmms.online;

    root /var/www/mmms/frontend/dist;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location /uploads/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF'

# Enable site
sudo ln -sf /etc/nginx/sites-available/mmms /etc/nginx/sites-enabled/mmms
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
echo ""

# 3. Check if SSL already exists
echo "3️⃣  Checking for existing SSL certificates..."
if [ -d "/etc/letsencrypt/live/mmms.online" ]; then
    echo "✅ SSL certificates already exist"
    echo "   Updating nginx config to use HTTPS..."
    
    # Update config to include HTTPS
    sudo certbot --nginx -d mmms.online -d www.mmms.online --non-interactive --agree-tos --redirect
else
    echo "⚠️  No SSL certificates found"
    echo "4️⃣  Obtaining SSL certificates with Let's Encrypt..."
    echo "   (This will prompt for email - press Ctrl+C if you want to do it manually)"
    echo ""
    
    # Run certbot to get certificates
    sudo certbot --nginx -d mmms.online -d www.mmms.online --agree-tos --redirect
fi

echo ""
echo "✅ SSL setup complete!"
echo ""
echo "5️⃣  Verifying setup:"
sudo nginx -t
sudo systemctl status nginx --no-pager | head -5
echo ""
echo "🌐 Your site should now be accessible at: https://mmms.online"




