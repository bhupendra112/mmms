# Frontend Deployment Instructions

## Quick Deploy

To sync your frontend code from `/root/mmms/frontend` to `/var/www/mmms/frontend`:

```bash
cd /root/mmms

# Make script executable (first time only)
chmod +x deploy-frontend.sh

# Run the deployment script
./deploy-frontend.sh
```

**Alternative (if permission issues):**
```bash
cd /root/mmms
bash deploy-frontend.sh
```

## Manual Steps

If you prefer to do it manually:

```bash
# 1. Navigate to source directory
cd /root/mmms/frontend

# 2. Sync files to production (excluding node_modules, dist, .git)
sudo rsync -av --delete \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.git' \
    --exclude 'dist.backup.*' \
    /root/mmms/frontend/ /var/www/mmms/frontend/

# 3. Set permissions
sudo chown -R www-data:www-data /var/www/mmms/frontend
sudo chmod -R 755 /var/www/mmms/frontend

# 4. Install dependencies
cd /var/www/mmms/frontend
sudo -u www-data npm install --production=false

# 5. Build for production
sudo -u www-data npm run build

# 6. Set permissions on dist
sudo chown -R www-data:www-data /var/www/mmms/frontend/dist
sudo chmod -R 755 /var/www/mmms/frontend/dist
```

## What the Script Does

1. ✅ Checks if source directory exists
2. ✅ Backs up existing `dist` folder
3. ✅ Syncs all source files (excluding node_modules, dist, .git)
4. ✅ Sets proper permissions
5. ✅ Installs dependencies
6. ✅ Builds frontend for production
7. ✅ Sets permissions on build output
8. ✅ Verifies deployment

## Important Notes

- The script preserves your existing `dist` folder by backing it up
- Only source files are synced, not `node_modules` or `dist`
- Dependencies are installed fresh in the target directory
- Build is done in the production location
- Permissions are set for web server (www-data or nginx)

## Troubleshooting

### Permission Errors

If you get npm cache permission errors:
```bash
# Fix npm cache permissions
sudo chown -R www-data:www-data /var/www/.npm
# OR
sudo chown -R 33:33 /var/www/.npm

# Fix home npm cache
sudo chown -R $USER:$USER ~/.npm
```

If you get file permission errors:
```bash
sudo chown -R $USER:$USER /var/www/mmms/frontend
```

### npm Install Issues

If npm install fails with permission errors:
```bash
cd /var/www/mmms/frontend
sudo rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

If npm install fails with cache issues:
```bash
npm cache clean --force
cd /var/www/mmms/frontend
npm install --legacy-peer-deps
```

### Build Issues

If vite is not found:
```bash
cd /var/www/mmms/frontend
# Make sure dependencies are installed
npm install --legacy-peer-deps
# Then build
npm run build
```

If build fails:
```bash
cd /var/www/mmms/frontend
# Clean and reinstall
rm -rf node_modules package-lock.json dist
npm install --legacy-peer-deps
npm run build
```

