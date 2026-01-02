# Manual Fix Commands for Multer and UPLOADS_DIR

## Step-by-Step Commands to Run on Server

### Step 1: Navigate to Backend Directory
```bash
cd /root/mmms/backend
```

### Step 2: Install Multer Package
```bash
npm install multer@^2.0.2 --legacy-peer-deps
```

### Step 3: Verify Multer Installation
```bash
npm list multer
```
Expected output should show: `multer@2.0.2` or similar

### Step 4: Check Current .env File
```bash
cat .env | grep UPLOADS_DIR
```

### Step 5: Add UPLOADS_DIR to .env (if not present)
```bash
# Check if it already exists
grep -q "^UPLOADS_DIR=" .env && echo "Already exists" || echo "UPLOADS_DIR=/var/www/mmms/uploads" >> .env
```

Or manually edit:
```bash
nano .env
# Add this line: UPLOADS_DIR=/var/www/mmms/uploads
# Save and exit (Ctrl+X, then Y, then Enter)
```

### Step 6: Verify UPLOADS_DIR was added
```bash
cat .env | grep UPLOADS_DIR
```
Should show: `UPLOADS_DIR=/var/www/mmms/uploads`

### Step 7: Verify Uploads Directory Exists
```bash
ls -la /var/www/mmms/uploads
```

If it doesn't exist, create it:
```bash
mkdir -p /var/www/mmms/uploads/members
chown -R www-data:www-data /var/www/mmms/uploads
chmod -R 755 /var/www/mmms/uploads
```

### Step 8: Restart PM2 with Updated Environment
```bash
pm2 restart my-server --update-env
```

### Step 9: Wait a Few Seconds for Server to Start
```bash
sleep 3
```

### Step 10: Check Server Status
```bash
pm2 list
```
Should show `my-server` as `online`

### Step 11: Check for Multer Errors
```bash
pm2 logs my-server --err --lines 20
```
Should NOT show any `ERR_MODULE_NOT_FOUND` or `multer` errors

### Step 12: Check Server Output Logs
```bash
pm2 logs my-server --out --lines 20
```
Should show:
- `✅ Database connected successfully!`
- `🚀 Server is running on port 8080`

### Step 13: Test Server Response
```bash
curl http://localhost:8080/
```
Should return: `App is running`

### Step 14: Verify Multer is Working (Optional Test)
```bash
# Check if multer module can be loaded
node -e "import('multer').then(() => console.log('✅ Multer loaded successfully')).catch(e => console.error('❌ Error:', e.message))"
```

---

## Quick One-Liner Fix (All Steps Combined)

```bash
cd /root/mmms/backend && \
npm install multer@^2.0.2 --legacy-peer-deps && \
grep -q "^UPLOADS_DIR=" .env || echo "UPLOADS_DIR=/var/www/mmms/uploads" >> .env && \
pm2 restart my-server --update-env && \
sleep 3 && \
pm2 logs my-server --err --lines 10
```

---

## Verification Commands

### Check Everything is Working:
```bash
# 1. Check multer is installed
cd /root/mmms/backend
ls node_modules/multer

# 2. Check UPLOADS_DIR in .env
grep UPLOADS_DIR .env

# 3. Check server status
pm2 list

# 4. Check for errors
pm2 logs my-server --err --lines 5

# 5. Check server is responding
curl http://localhost:8080/

# 6. Check uploads directory
ls -la /var/www/mmms/uploads/members/ | head -5
```

---

## Troubleshooting Commands

### If multer still shows errors:
```bash
cd /root/mmms/backend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
pm2 restart my-server --update-env
```

### If UPLOADS_DIR is not being read:
```bash
# Check PM2 environment
pm2 env 0

# Restart with explicit env file
pm2 restart my-server --update-env
pm2 save
```

### If server won't start:
```bash
# Check full error logs
pm2 logs my-server --err --lines 50

# Try starting manually to see errors
cd /root/mmms/backend
node server.js
```

---

## Expected Final Status

After running all commands, you should see:

✅ **Multer installed**: `node_modules/multer` exists  
✅ **UPLOADS_DIR set**: `.env` contains `UPLOADS_DIR=/var/www/mmms/uploads`  
✅ **Server online**: `pm2 list` shows `online` status  
✅ **No multer errors**: Error logs don't show `ERR_MODULE_NOT_FOUND`  
✅ **Server responding**: `curl http://localhost:8080/` returns "App is running"  
✅ **Database connected**: Output logs show "Database connected successfully"






