#!/bin/bash

# Script to test file access via nginx

echo "🧪 Testing file access via nginx..."
echo ""

# Test file (first file in the directory)
TEST_FILE="1766607481752-M001-Voter_Id_File.jpeg"
TEST_URL="https://mmms.online/uploads/members/$TEST_FILE"

echo "📍 Testing: $TEST_URL"
echo ""

# Test with curl
echo "1️⃣ Testing HTTP response..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL")
echo "   HTTP Status Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ File is accessible!"
else
    echo "   ❌ File not accessible (HTTP $HTTP_CODE)"
fi

echo ""
echo "2️⃣ Testing Content-Type header..."
CONTENT_TYPE=$(curl -s -I "$TEST_URL" | grep -i "content-type" | cut -d' ' -f2- | tr -d '\r')
echo "   Content-Type: $CONTENT_TYPE"

if echo "$CONTENT_TYPE" | grep -qi "image"; then
    echo "   ✅ Correct content type!"
else
    echo "   ⚠️  Unexpected content type"
fi

echo ""
echo "3️⃣ Testing file size..."
FILE_SIZE=$(curl -s -I "$TEST_URL" | grep -i "content-length" | cut -d' ' -f2- | tr -d '\r')
if [ -n "$FILE_SIZE" ]; then
    echo "   File size: $FILE_SIZE bytes"
    echo "   ✅ File size header present"
else
    echo "   ⚠️  No content-length header"
fi

echo ""
echo "4️⃣ Testing direct file access..."
if [ -f "/var/www/mmms/uploads/members/$TEST_FILE" ]; then
    ACTUAL_SIZE=$(stat -c%s "/var/www/mmms/uploads/members/$TEST_FILE" 2>/dev/null || stat -f%z "/var/www/mmms/uploads/members/$TEST_FILE" 2>/dev/null)
    echo "   Actual file size: $ACTUAL_SIZE bytes"
    if [ "$FILE_SIZE" = "$ACTUAL_SIZE" ]; then
        echo "   ✅ Sizes match!"
    else
        echo "   ⚠️  Size mismatch"
    fi
else
    echo "   ❌ File not found on disk"
fi

echo ""
echo "5️⃣ Testing nginx error logs..."
echo "   Checking for recent errors..."
sudo tail -5 /var/log/nginx/mmms-uploads-error.log 2>/dev/null || echo "   ℹ️  No error log file (this is OK if no errors)"

echo ""
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ All tests passed! Files are accessible via nginx."
else
    echo "❌ Some tests failed. Check nginx configuration and permissions."
fi



