# Upstox Account Reactivation Guide

## 🔍 **Error: UDAPI100058 - Account Reactivation Required**

If you're seeing this error when trying to connect your Upstox account:

```
"UDAPI100058": "No segments for these users are active. Manual reactivation is recommended from Upstox app/web."
```

This means your Upstox account needs to be reactivated before you can use the API.

## 🛠️ **How to Reactivate Your Upstox Account**

### **Step 1: Log into Upstox App/Web**
1. Open the Upstox mobile app or go to [https://upstox.com](https://upstox.com)
2. Log in with your credentials
3. Complete any pending verification steps

### **Step 2: Check Account Status**
1. Go to your account settings
2. Look for any "Account Reactivation" or "Activate Account" options
3. Follow the prompts to reactivate your account

### **Step 3: Complete KYC (if required)**
1. If your KYC is pending, complete it
2. Upload required documents
3. Wait for verification (usually 24-48 hours)

### **Step 4: Enable API Access**
1. Go to your Upstox account settings
2. Look for "API Access" or "Developer Settings"
3. Enable API access for your account
4. Make sure your account is fully active

### **Step 5: Try Connecting Again**
1. Once your account is reactivated, try connecting again
2. The OAuth flow should work normally

## 📱 **Alternative: Contact Upstox Support**

If you can't reactivate your account through the app/web:

1. **Email Support**: support@upstox.com
2. **Phone Support**: 022-4179-2999
3. **Live Chat**: Available on the Upstox website

**Subject**: "Account Reactivation Required for API Access"

**Include in your message**:
- Your Upstox client ID
- The error code: UDAPI100058
- Request for account reactivation to enable API access

## 🔄 **After Reactivation**

Once your account is reactivated:

1. **Try the OAuth flow again** - it should work normally
2. **Check your API credentials** - make sure they're still valid
3. **Test the connection** - the trading journal should be able to fetch your data

## ⚠️ **Common Issues**

- **Account inactive for too long**: Upstox deactivates accounts that haven't been used
- **Pending KYC**: Complete KYC verification
- **API access disabled**: Enable API access in account settings
- **Wrong credentials**: Double-check your client ID and secret

## 📞 **Need Help?**

If you're still having issues after reactivation:
1. Check the console logs for detailed error messages
2. Verify your Upstox app configuration
3. Make sure your account is fully active and verified 