# Trading Platform Integration

This document describes the trading platform integration feature that allows users to automatically sync their trade data from various trading platforms into the trading journal.

## Supported Platforms

### Currently Supported
- **Angel One** - Angel Broking trading platform
- **Zerodha** - Zerodha Kite trading platform

### Coming Soon
- Upstox
- 5paisa
- ICICI Direct

## Features

### Real-time Trade Sync
- Automatically fetch trades from connected platforms
- Support for incremental and full sync
- Real-time trade data updates
- Duplicate trade detection and handling

### Platform Management
- Connect multiple trading accounts
- Secure credential storage (encrypted)
- Platform-specific configuration
- Connection status monitoring

### Background Sync
- Automated periodic sync (configurable intervals)
- Manual sync triggers
- Sync history and status tracking
- Error handling and retry mechanisms

## Architecture

### Core Components

1. **Base Trading Platform** (`app/lib/trading-platforms/base.ts`)
   - Abstract base class for all platform integrations
   - Common interface and error handling
   - Retry mechanisms and request management

2. **Platform Implementations**
   - `app/lib/trading-platforms/angel-one.ts` - Angel One integration
   - `app/lib/trading-platforms/zerodha.ts` - Zerodha integration

3. **Platform Factory** (`app/lib/trading-platforms/factory.ts`)
   - Creates platform instances based on type
   - Manages platform configurations
   - Provides platform metadata

4. **Sync Service** (`app/lib/trading-platforms/sync-service.ts`)
   - Handles trade synchronization logic
   - Database operations for trade storage
   - Sync result tracking and reporting

5. **Background Sync** (`app/lib/trading-platforms/background-sync.ts`)
   - Automated sync scheduling
   - Background job management
   - Configuration management

### Database Schema

The integration adds several new models to the database:

```prisma
model TradingAccount {
  id          String   @id @default(cuid())
  userId      String
  platform    String   // "ANGEL_ONE", "ZERODHA", etc.
  accountId   String   // Platform-specific account ID
  accountName String?
  isActive    Boolean  @default(true)
  syncStatus  String   @default("PENDING")
  lastSyncAt  DateTime?
  
  // Encrypted credentials
  apiKey      String?
  apiSecret   String?
  accessToken String?
  refreshToken String?
  tokenExpiry DateTime?
  
  // Relations
  user        User     @relation(fields: [userId], references: [id])
  tradeSyncs  TradeSync[]
  
  @@unique([userId, platform, accountId])
}

model TradeSync {
  id          String   @id @default(cuid())
  accountId   String
  syncType    String   // "FULL", "INCREMENTAL", "REALTIME"
  status      String   @default("PENDING")
  startedAt   DateTime @default(now())
  completedAt DateTime?
  duration    Int?
  
  // Results
  tradesFetched    Int @default(0)
  tradesCreated    Int @default(0)
  tradesUpdated    Int @default(0)
  tradesSkipped    Int @default(0)
  errors           Int @default(0)
  
  // Relations
  account     TradingAccount @relation(fields: [accountId], references: [id])
}
```

The existing `Trade` model is extended with platform-specific fields:

```prisma
model Trade {
  // ... existing fields ...
  
  // Platform integration fields
  platformTradeId String?  // Original trade ID from platform
  platform        String?  // Source platform
  accountId       String?  // Associated trading account
  isSynced        Boolean  @default(false)
  lastSyncAt      DateTime?
  
  @@unique([userId, platformTradeId, platform])
}
```

## API Endpoints

### Trading Platform Sync
- `GET /api/trading-platforms/sync` - Get supported platforms and instructions
- `POST /api/trading-platforms/sync` - Sync trades from a platform

### Trading Accounts (Future)
- `GET /api/trading-platforms/accounts` - List user's trading accounts
- `POST /api/trading-platforms/accounts` - Create new trading account
- `PUT /api/trading-platforms/accounts/[id]` - Update trading account
- `DELETE /api/trading-platforms/accounts/[id]` - Delete trading account

## Usage

### Setting Up Platform Integration

1. **Navigate to Trading Platforms Page**
   - Go to `/trading-platforms` in the application
   - Or access via the navigation menu

2. **Select Platform**
   - Choose from the list of supported platforms
   - Review setup instructions for the selected platform

3. **Get Platform Credentials**
   - Follow the platform-specific instructions
   - Generate API credentials from your trading platform
   - Ensure proper permissions are set

4. **Enter Credentials**
   - Fill in the required credential fields
   - Optional fields can be left blank if not needed

5. **Test Connection**
   - Click "Sync Trades" to test the connection
   - Review the sync results and any error messages

### Platform-Specific Setup

#### Angel One
1. Log in to your Angel One account
2. Go to API Settings in your account
3. Generate API credentials (Client Code and Password)
4. Enable TOTP if you have 2FA enabled
5. Use the credentials to connect your account

**Required Fields:**
- Client Code (API Key)
- Password (API Secret)
- TOTP (optional, if 2FA enabled)

#### Zerodha
1. Log in to your Zerodha Kite account
2. Go to API Settings
3. Generate API Key and Secret
4. Get Request Token from Zerodha login
5. Use the credentials to connect your account

**Required Fields:**
- API Key
- API Secret
- Request Token

### Managing Connected Accounts

Once connected, you can:
- View sync status and history
- Manually trigger syncs
- Update credentials
- Disconnect accounts
- Configure sync intervals

## Security

### Credential Storage
- All credentials are encrypted before storage
- API keys and secrets are never logged
- Access tokens are encrypted and have expiration handling
- Credentials can be revoked from the trading platform

### Data Privacy
- Only trade data is fetched, no personal information
- No trading operations are performed
- Data is stored locally in your journal
- You maintain full control over your data

### Best Practices
- Use dedicated API credentials for journal integration
- Regularly rotate API keys and secrets
- Monitor sync logs for any unusual activity
- Revoke access immediately if suspicious activity is detected

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify API credentials are correct
   - Check if credentials have expired
   - Ensure proper permissions are set on the trading platform
   - For 2FA-enabled accounts, ensure TOTP is provided

2. **No Trades Found**
   - Check the date range for sync
   - Verify trades exist in the specified period
   - Ensure the account has trading activity
   - Check platform-specific limitations

3. **Sync Errors**
   - Review error messages in the sync results
   - Check network connectivity
   - Verify trading platform API status
   - Contact support if issues persist

### Platform-Specific Issues

#### Angel One
- Ensure TOTP is enabled if 2FA is active
- Check if API access is enabled in account settings
- Verify client code and password are correct

#### Zerodha
- Request tokens expire quickly, generate fresh ones
- Ensure API key has proper permissions
- Check if account is active and not suspended

## Development

### Adding New Platforms

To add support for a new trading platform:

1. **Create Platform Implementation**
   ```typescript
   // app/lib/trading-platforms/new-platform.ts
   import { BaseTradingPlatform, PlatformTrade, PlatformCredentials } from './base';
   
   export class NewPlatform extends BaseTradingPlatform {
     // Implement required methods
     async authenticate(): Promise<boolean> { /* ... */ }
     async getTrades(): Promise<PlatformTrade[]> { /* ... */ }
     // ... other methods
   }
   ```

2. **Update Factory**
   ```typescript
   // app/lib/trading-platforms/factory.ts
   case 'NEW_PLATFORM':
     return new NewPlatform(credentials);
   ```

3. **Add Platform Configuration**
   ```typescript
   case 'NEW_PLATFORM':
     return {
       requiresApiKey: true,
       requiresApiSecret: true,
       fields: [
         { name: 'apiKey', label: 'API Key', type: 'text', required: true },
         // ... other fields
       ]
     };
   ```

4. **Update UI Components**
   - Add platform to the selection list
   - Include setup instructions
   - Add credential fields

### Testing

1. **Unit Tests**
   - Test platform implementations
   - Test sync service logic
   - Test error handling

2. **Integration Tests**
   - Test API endpoints
   - Test database operations
   - Test background sync

3. **Manual Testing**
   - Test with real platform credentials
   - Verify trade data accuracy
   - Test error scenarios

## Future Enhancements

### Planned Features
- Webhook support for real-time updates
- Advanced filtering and sync options
- Bulk trade import/export
- Trade reconciliation tools
- Performance analytics integration

### Platform Expansions
- Support for international platforms
- Mobile app integrations
- Third-party data providers
- Custom platform integrations

## Support

For issues or questions regarding trading platform integration:

1. Check the troubleshooting section above
2. Review platform-specific documentation
3. Contact support with detailed error information
4. Include platform name, error messages, and steps to reproduce

## License

This trading platform integration feature is part of the Trading Journal application and follows the same licensing terms. 