# Uploads Directory Migration Guide

## Current Situation
- **Current location**: `/root/mmms/backend/uploads/members/`
- **Target location**: `/var/www/mmms/uploads/members/` (for nginx direct serving)

## Why Migrate?
Nginx can serve static files much faster than proxying through Node.js. By moving files to `/var/www/mmms/uploads/`, nginx can serve them directly, improving performance.

## Migration Steps

### 1. Run Migration Script
On your server, run:
```bash
cd /root/mmms
bash migrate-uploads.sh
```

This script will:
- Create `/var/www/mmms/uploads/members/` directory
- Copy all existing files from `/root/mmms/backend/uploads/members/` to the new location
- Set proper permissions (www-data:www-data, 755 for directories, 644 for files)

### 2. Update Backend Environment
Add to `/root/mmms/backend/.env`:
```env
UPLOADS_DIR=/var/www/mmms/uploads
```

### 3. Update Nginx Configuration
The nginx config in `nginx-mmms-updated.conf` is already configured to serve from `/var/www/mmms/uploads/`. 

Copy it to your server:
```bash
sudo cp nginx-mmms-updated.conf /etc/nginx/sites-available/mmms
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Restart Backend
```bash
pm2 restart mmms-backend
```

### 5. Verify Everything Works
1. Check files are accessible:
   ```bash
   ls -la /var/www/mmms/uploads/members/
   ```

2. Test file serving (replace with actual filename):
   ```bash
   curl -I https://mmms.online/uploads/members/1234567890-M001-Voter_Id_File.jpg
   ```

3. Upload a new file through the application and verify it appears in the new location.

## File Structure After Migration

```
/var/www/mmms/
├── uploads/
│   └── members/
│       ├── 1234567890-M001-Voter_Id_File.jpg
│       ├── 1234567891-M001-Adhar_Id_File.pdf
│       └── ...
├── frontend/
│   └── dist/
└── backend/
    └── (code files)
```

## Rollback (If Needed)

If something goes wrong, you can rollback:

1. Update backend `.env` to remove or comment out `UPLOADS_DIR`
2. Update nginx config to proxy `/uploads/` back to backend
3. Files are still in `/root/mmms/backend/uploads/` (they weren't deleted)

## Cleanup (After Verification)

Once you've verified everything works for a few days, you can clean up the old location:
```bash
# Backup first (just in case)
sudo cp -r /root/mmms/backend/uploads /root/mmms/backend/uploads.backup

# Remove old files (only after confirming new location works)
sudo rm -rf /root/mmms/backend/uploads/members/*
```

## Troubleshooting

### Files Not Found After Migration
- Check file count: `find /var/www/mmms/uploads/members -type f | wc -l`
- Compare with old location: `find /root/mmms/backend/uploads/members -type f | wc -l`
- Re-run migration script if needed

### Permission Errors
```bash
sudo chown -R www-data:www-data /var/www/mmms/uploads
sudo chmod -R 755 /var/www/mmms/uploads
sudo find /var/www/mmms/uploads -type f -exec chmod 644 {} \;
```

### Nginx 403 Forbidden
- Check directory permissions: `ls -ld /var/www/mmms/uploads`
- Check SELinux (if enabled): `sudo setsebool -P httpd_read_user_content 1`

### New Uploads Not Appearing
- Verify `UPLOADS_DIR` in backend `.env`
- Check backend logs: `pm2 logs mmms-backend`
- Verify backend has write permissions: `sudo chown -R www-data:www-data /var/www/mmms/uploads`

