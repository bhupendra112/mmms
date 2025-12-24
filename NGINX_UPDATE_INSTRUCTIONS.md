# Nginx Configuration Update Instructions

## Overview
This guide will help you update your nginx configuration to serve uploaded files directly from nginx instead of proxying through Node.js. This improves performance and reduces server load.

## Current Setup
Your current nginx config proxies `/uploads/` requests to the backend server. This works but is slower.

## Updated Configuration
The new configuration serves files directly from `/var/www/mmms/uploads/` using nginx's static file serving, which is much faster.

## Steps to Update

### 1. Backup Current Configuration
```bash
sudo cp /etc/nginx/sites-available/mmms /etc/nginx/sites-available/mmms.backup.$(date +%Y%m%d_%H%M%S)
```

### 2. Update Configuration File
Copy the updated configuration from `nginx-mmms-updated.conf` to your nginx config:

```bash
# On your local machine, copy the updated config
# Then on server, update the file:
sudo nano /etc/nginx/sites-available/mmms
```

Or use the provided updated configuration file and copy it to the server.

### 3. Ensure Uploads Directory Exists
```bash
sudo mkdir -p /var/www/mmms/uploads/members
sudo chown -R www-data:www-data /var/www/mmms/uploads
sudo chmod -R 755 /var/www/mmms/uploads
```

### 4. Test Nginx Configuration
```bash
sudo nginx -t
```

You should see:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 5. Reload Nginx
```bash
sudo systemctl reload nginx
```

### 6. Verify File Serving
Test that files are being served correctly:
```bash
# Check if a file exists
ls -la /var/www/mmms/uploads/members/

# Test with curl (replace with actual filename)
curl -I https://mmms.online/uploads/members/1234567890-M001-Voter_Id_File.jpg
```

You should see HTTP 200 response with proper content-type headers.

## Key Changes

### Before (Proxying):
```nginx
location /uploads/ {
    proxy_pass http://localhost:8080;
    ...
}
```

### After (Direct Serving):
```nginx
location /uploads/ {
    alias /var/www/mmms/uploads/;
    # CORS headers, content types, caching, etc.
}
```

## Benefits

1. **Performance**: Nginx serves static files much faster than Node.js
2. **Reduced Load**: Backend server doesn't handle file serving requests
3. **Better Caching**: Nginx can cache files more efficiently
4. **Lower Memory**: Less memory usage on Node.js server

## Troubleshooting

### Files Not Found (404)
- Check that files exist: `ls -la /var/www/mmms/uploads/members/`
- Verify permissions: `sudo chown -R www-data:www-data /var/www/mmms/uploads`
- Check nginx error logs: `sudo tail -f /var/log/nginx/mmms-uploads-error.log`

### Permission Denied (403)
- Fix ownership: `sudo chown -R www-data:www-data /var/www/mmms/uploads`
- Fix permissions: `sudo chmod -R 755 /var/www/mmms/uploads`

### CORS Errors
- Check CORS headers in nginx config
- Verify `Access-Control-Allow-Origin` header is set correctly
- Check browser console for specific CORS error messages

### Files Still Proxying
- Clear browser cache
- Verify nginx config was reloaded: `sudo systemctl status nginx`
- Check nginx access logs: `sudo tail -f /var/log/nginx/mmms-uploads-access.log`

## Rollback

If something goes wrong, restore the backup:
```bash
sudo cp /etc/nginx/sites-available/mmms.backup.* /etc/nginx/sites-available/mmms
sudo nginx -t
sudo systemctl reload nginx
```

