# Upstox OAuth Troubleshooting Guide

## 🔍 **Current Issue: OAuth Redirect Loop**

You're experiencing a redirect loop where after logging into Upstox, you're redirected back to the Upstox login page instead of completing the OAuth flow.

## 🛠️ **Step-by-Step Fix**

### **1. Check Your Upstox App Configuration**

Go to your Upstox Developer Console and verify these settings:

**Required Settings:**
- **Redirect URI**: Must be exactly `http://localhost:3000/api/auth/upstox/callback`
- **Client ID**: Should match your `UPSTOX_API_KEY` or `UPSTOX_CLIENT_ID` environment variable
- **Client Secret**: Should match your `UPSTOX_API_SECRET` or `UPSTOX_CLIENT_SECRET` environment variable

**Common Issues:**
- ❌ `http://localhost:3000/api/auth/upstox/callback/` (trailing slash)
- ❌ `https://localhost:3000/api/auth/upstox/callback` (https instead of http)
- ❌ `http://127.0.0.1:3000/api/auth/upstox/callback` (127.0.0.1 instead of localhost)

### **2. Verify Environment Variables**

Check your `.env` file has these exact values:

```env
# Use either naming convention:
UPSTOX_API_KEY="your-client-id-here"
UPSTOX_API_SECRET="your-client-secret-here"

# OR the original naming:
UPSTOX_CLIENT_ID="your-client-id-here"
UPSTOX_CLIENT_SECRET="your-client-secret-here"

NEXTAUTH_URL="http://localhost:3000"
```

### **3. Updated OAuth URLs**

The application now uses the correct Upstox API v2 endpoints:

- **OAuth Authorization URL**: `https://api.upstox.com/v2/login/authorization/dialog`
- **Token Exchange URL**: `https://api.upstox.com/v2/login/authorization/token`
- **User Profile URL**: `https://api.upstox.com/v2/user/profile`
- **Trade Book URL**: `https://api.upstox.com/v2/tradebook`

### **4. Test the OAuth Flow**

1. **Visit the debug page**: `http://localhost:3000/upstox-test`
2. **Check the environment variables** displayed
3. **Click the OAuth URL** to test the flow
4. **Monitor the console logs** for detailed information

### **5. Common Solutions**

#### **Solution A: Fix Redirect URI in Upstox App**
1. Go to Upstox Developer Console
2. Update your app's redirect URI to: `http://localhost:3000/api/auth/upstox/callback`
3. Save the changes
4. Try the OAuth flow again

#### **Solution B: Check for HTTPS Issues**
If you're using HTTPS locally, update your redirect URI to:
```
https://localhost:3000/api/auth/upstox/callback
```

#### **Solution C: Clear Browser Cache**
1. Clear your browser cache and cookies
2. Try the OAuth flow in an incognito/private window
3. Make sure you're logged into the trading journal app first

### **6. Debug Information**

The updated code now provides detailed logging. Check your console for:

```
=== UPSTOX OAUTH INITIATION STARTED ===
Upstox OAuth environment check: {
  hasClientId: true,
  nextAuthUrl: 'http://localhost:3000',
  redirectUri: 'http://localhost:3000/api/auth/upstox/callback',
  clientIdLength: 36
}
```

### **7. Expected Flow**

1. ✅ Click "Connect" on Upstox broker
2. ✅ Redirected to Upstox login page (`https://api.upstox.com/v2/login/authorization/dialog`)
3. ✅ Login with Upstox credentials
4. ✅ Upstox redirects back to callback URL
5. ✅ Callback processes the authorization code using correct API
6. ✅ Redirects to brokers page with success message

### **8. If Still Not Working**

1. **Check the debug page**: `http://localhost:3000/upstox-test`
2. **Look for error messages** in the console
3. **Verify the callback is being reached** by checking the logs
4. **Try the test OAuth URL** from the debug page

### **9. Alternative: Manual Testing**

If the OAuth flow still doesn't work, you can test the callback manually:

1. Visit: `http://localhost:3000/api/auth/upstox/callback`
2. You should see: `{"message":"Upstox callback endpoint is accessible",...}`
3. If this works, the issue is with the OAuth flow, not the callback

## 🚨 **Emergency Fix**

If nothing else works, try this temporary fix:

1. **Update your Upstox app redirect URI** to: `http://localhost:3000/api/auth/upstox/callback`
2. **Restart your development server**: `npm run dev`
3. **Clear browser cache** and try again
4. **Use incognito mode** to avoid cache issues

## 📞 **Need Help?**

If you're still having issues:
1. Check the console logs for specific error messages
2. Verify your Upstox app configuration matches exactly
3. Make sure you're logged into the trading journal app
4. Try the debug page at `/upstox-test` 