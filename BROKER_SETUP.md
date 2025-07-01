# Broker Integration Setup Guide

This guide will help you set up the required environment variables for broker integrations.

## Required Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/trading_journal"

# Authentication (Required)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# API Security
ALLOWED_ORIGINS="http://localhost:3000"

# Zerodha Integration (Optional)
ZERODHA_CLIENT_ID="your-zerodha-api-key"
ZERODHA_CLIENT_SECRET="your-zerodha-api-secret"
ZERODHA_REDIRECT_URI="http://localhost:3000/api/auth/zerodha/callback"

# Upstox Integration (Optional)
UPSTOX_CLIENT_ID="your-upstox-client-id"
UPSTOX_CLIENT_SECRET="your-upstox-client-secret"
UPSTOX_REDIRECT_URI="http://localhost:3000/api/auth/upstox/callback"

# Dhan Integration (Optional)
DHAN_CLIENT_ID="your-dhan-client-id"
DHAN_CLIENT_SECRET="your-dhan-client-secret"
DHAN_REDIRECT_URI="http://localhost:3000/api/auth/dhan/callback"

# Environment
NODE_ENV="development"
```

## Setting Up Zerodha Integration

1. **Get Zerodha API Credentials:**
   - Go to [https://kite.trade/connect/apps](https://kite.trade/connect/apps)
   - Sign in with your Zerodha account
   - Create a new app or use an existing one
   - Copy the **API Key** and **API Secret**

2. **Configure Environment Variables:**
   ```env
   ZERODHA_CLIENT_ID="your-api-key-here"
   ZERODHA_CLIENT_SECRET="your-api-secret-here"
   ```

3. **Set Redirect URI:**
   - In your Zerodha app settings, set the redirect URI to:
   ```
   http://localhost:3000/api/auth/zerodha/callback
   ```
   - For production, use your actual domain

4. **Restart Your Application:**
   ```bash
   npm run dev
   ```

## Setting Up Upstox Integration

1. **Get Upstox API Credentials:**
   - Go to [https://developer.upstox.com/](https://developer.upstox.com/)
   - Create a new application
   - Copy the **Client ID** and **Client Secret**

2. **Configure Environment Variables:**
   ```env
   UPSTOX_CLIENT_ID="your-client-id-here"
   UPSTOX_CLIENT_SECRET="your-client-secret-here"
   ```

3. **Set Redirect URI:**
   - In your Upstox app settings, set the redirect URI to:
   ```
   http://localhost:3000/api/auth/upstox/callback
   ```

## Setting Up Dhan Integration

1. **Get Dhan API Credentials:**
   - Go to [https://developers.dhan.co/](https://developers.dhan.co/)
   - Create a new OAuth application
   - Copy the **Client ID** and **Client Secret**

2. **Configure Environment Variables:**
   ```env
   DHAN_CLIENT_ID="your-client-id-here"
   DHAN_CLIENT_SECRET="your-client-secret-here"
   ```

3. **Set Redirect URI:**
   - In your Dhan app settings, set the redirect URI to:
   ```
   http://localhost:3000/api/auth/dhan/callback
   ```

4. **Configure OAuth Scopes:**
   - Make sure your app has the required scopes (usually 'read' for fetching trades)

## Other Brokers

For other brokers (Angel One, ICICI Direct, etc.), the application uses manual credential entry and doesn't require environment variables.

## Troubleshooting

### "Zerodha client ID not configured" Error

This error occurs when the `ZERODHA_CLIENT_ID` environment variable is not set. To fix:

1. Make sure you have a `.env` file in your project root
2. Add the Zerodha environment variables as shown above
3. Restart your development server
4. Try connecting to Zerodha again

### "Unauthorized" Error

This usually means you're not logged in. Make sure to:
1. Sign in to the application first
2. Then try connecting your broker

### Environment Variables Not Loading

If your environment variables aren't being loaded:

1. Make sure the `.env` file is in the project root (same level as `package.json`)
2. Restart your development server completely
3. Check that there are no spaces around the `=` sign in your `.env` file

## Security Notes

- Never commit your `.env` file to version control
- Keep your API keys and secrets secure
- Use different credentials for development and production
- Regularly rotate your API keys for security 