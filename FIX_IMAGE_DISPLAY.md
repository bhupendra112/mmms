# Fix Image Display Issue

## Problem
Images are uploaded to `/root/mmms/backend/uploads/members/` but nginx is configured to serve from `/var/www/mmms/uploads/`, causing images not to display.

## Solution

### Step 1: Migrate Files to Nginx-Accessible Location

Run on your server:
```bash
cd /root/mmms
bash fix-uploads-paths.sh
```

This will:
- Copy all files from `/root/mmms/backend/uploads/members/` to `/var/www/mmms/uploads/members/`
- Set proper permissions (www-data:www-data)
- Verify the migration

### Step 2: Update Backend Configuration

Add to `/root/mmms/backend/.env`:
```env
UPLOADS_DIR=/var/www/mmms/uploads
```

### Step 3: Update Nginx Configuration

Ensure nginx is configured to serve from `/var/www/mmms/uploads/`. The config in `nginx-mmms-updated.conf` is already correct.

If not already done:
```bash
sudo cp nginx-mmms-updated.conf /etc/nginx/sites-available/mmms
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Restart Backend

```bash
pm2 restart mmms-backend
```

### Step 5: Verify

1. Check files exist in new location:
   ```bash
   ls -la /var/www/mmms/uploads/members/ | head -10
   ```

2. Test file access via nginx:
   ```bash
   # Get a filename from the list
   curl -I https://mmms.online/uploads/members/1766607481752-M001-Voter_Id_File.jpeg
   ```
   Should return HTTP 200 with proper content-type.

3. Check file permissions:
   ```bash
   ls -la /var/www/mmms/uploads/members/ | head -5
   ```
   Files should be owned by `www-data:www-data` and have `644` permissions.

## Alternative: Keep Files in Current Location

If you prefer to keep files in `/root/mmms/backend/uploads/`, you can:

1. Update nginx config to serve from that location:
   ```nginx
   location /uploads/ {
       alias /root/mmms/backend/uploads/;
       # ... rest of config
   }
   ```

2. But this is NOT recommended because:
   - Files in `/root/` are not easily accessible by nginx
   - Security concerns with serving files from root's home directory
   - Better to use `/var/www/mmms/uploads/` for web-accessible files

## Troubleshooting

### Images Still Not Showing

1. **Check nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/mmms-uploads-error.log
   ```

2. **Check file permissions:**
   ```bash
   sudo chown -R www-data:www-data /var/www/mmms/uploads
   sudo chmod -R 755 /var/www/mmms/uploads
   sudo find /var/www/mmms/uploads -type f -exec chmod 644 {} \;
   ```

3. **Verify nginx config:**
   ```bash
   sudo nginx -t
   ```

4. **Check if files are in correct location:**
   ```bash
   # Count files in old location
   find /root/mmms/backend/uploads/members -type f | wc -l
   
   # Count files in new location
   find /var/www/mmms/uploads/members -type f | wc -l
   ```
   Both should match (or new location should have more if new uploads happened).

5. **Test direct file access:**
   ```bash
   # Test if nginx can read the file
   sudo -u www-data cat /var/www/mmms/uploads/members/1766607481752-M001-Voter_Id_File.jpeg | head -c 100
   ```
   Should output binary data without errors.

### Permission Denied Errors

```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/mmms/uploads

# Fix permissions
sudo chmod -R 755 /var/www/mmms/uploads
sudo find /var/www/mmms/uploads -type f -exec chmod 644 {} \;
```

### SELinux Issues (if enabled)

```bash
# Allow nginx to read user content
sudo setsebool -P httpd_read_user_content 1

# Set proper context
sudo chcon -R -t httpd_sys_content_t /var/www/mmms/uploads
```



