# Backend File Storage Configuration

## Overview
This document explains how file storage is configured for the MMMS application, including multer configuration and nginx setup.

## File Storage Structure

```
/var/www/mmms/
├── uploads/
│   └── members/
│       ├── 1234567890-M001-Voter_Id_File.jpg
│       ├── 1234567891-M001-Adhar_Id_File.pdf
│       └── ...
├── backend/
└── frontend/
```

## Environment Variables

Add to your `.env` file in the backend directory:

```env
# File uploads directory (optional - defaults to backend/uploads)
# For production with nginx, use absolute path:
UPLOADS_DIR=/var/www/mmms/uploads
```

## Multer Configuration

Files are stored using multer with the following settings:
- **Location**: `UPLOADS_DIR/members/` (or `backend/uploads/members/` if not set)
- **File naming**: `{timestamp}-{memberId}-{fieldName}.{ext}`
- **Max file size**: 5MB
- **Allowed types**: JPEG, JPG, PNG, GIF, PDF

## Database Storage

File paths are stored in the database as relative paths:
- Format: `/uploads/members/{filename}`
- Example: `/uploads/members/1234567890-M001-Voter_Id_File.jpg`

## Nginx Configuration

### Option 1: Serve files directly from nginx (Recommended - Faster)

1. Set `UPLOADS_DIR=/var/www/mmms/uploads` in backend `.env`
2. Ensure nginx has read access to the uploads directory:
   ```bash
   sudo chown -R www-data:www-data /var/www/mmms/uploads
   sudo chmod -R 755 /var/www/mmms/uploads
   ```
3. Use the nginx configuration from `nginx-config-example.conf`
4. The `/uploads/` location in nginx will serve files directly

### Option 2: Proxy through Node.js (Current setup)

Files are served through Express static middleware. This works but is slower than nginx direct serving.

## Production Setup Steps

1. **Create uploads directory:**
   ```bash
   sudo mkdir -p /var/www/mmms/uploads/members
   sudo chown -R www-data:www-data /var/www/mmms/uploads
   sudo chmod -R 755 /var/www/mmms/uploads
   ```

2. **Update backend .env:**
   ```env
   UPLOADS_DIR=/var/www/mmms/uploads
   ```

3. **Update nginx configuration:**
   - Copy `nginx-config-example.conf` to `/etc/nginx/sites-available/mmms`
   - Update SSL certificate paths if needed
   - Test configuration: `sudo nginx -t`
   - Reload nginx: `sudo systemctl reload nginx`

4. **Restart backend:**
   ```bash
   pm2 restart mmms-backend
   ```

## File Permissions

- **Directory permissions**: `755` (rwxr-xr-x)
- **File permissions**: `644` (rw-r--r--)
- **Owner**: `www-data:www-data` (or `nginx:nginx` depending on your system)

## Troubleshooting

### Files not accessible
- Check nginx error logs: `sudo tail -f /var/log/nginx/mmms-error.log`
- Verify file permissions: `ls -la /var/www/mmms/uploads/members/`
- Check SELinux (if enabled): `sudo setsebool -P httpd_read_user_content 1`

### Upload fails
- Check file size limit (default: 5MB in multer, 10MB in nginx)
- Verify uploads directory exists and is writable
- Check backend logs for multer errors

### CORS issues
- Ensure nginx CORS headers are set correctly
- Verify `FRONTEND_URL` in backend `.env` matches your domain

## Development Setup

For local development, files are stored in `backend/uploads/members/` and served by Express. No additional configuration needed.

