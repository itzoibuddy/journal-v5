import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '../../../lib/db';
import { TradingPlatformFactory } from '../../../lib/trading-platforms/factory';
import { dashboardUpdater } from '../../../lib/trading-platforms/dashboard-updater';
import type { SupportedPlatform } from '../../../lib/trading-platforms/factory';

// Add TestResult type for testOnly diagnostics
type TestResult = {
  platform: string;
  success: any;
  message: any;
  details: any;
};

export async function POST(request: NextRequest) {
  console.log('SYNC API ROUTE POST HIT!');
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body for platform and syncOptions
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // ignore if no body
    }
    const requestedPlatform = body.platform;
    const syncOptions = body.syncOptions || {};
    const freshTotp = body.totp; // Get fresh TOTP from request
    const forceRefresh = body.forceRefresh || false; // Force refresh option
    const testOnly = body.testOnly || false; // Test only mode for diagnostics
    
    // Set default date range if not provided (last 90 days to catch more trades)
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 90);
    
    const startDate = syncOptions.startDate ? new Date(syncOptions.startDate) : defaultStartDate;
    const endDate = syncOptions.endDate ? new Date(syncOptions.endDate) : defaultEndDate;
    
    console.log('Sync request body:', body, 'forceRefresh:', forceRefresh);

    // Fetch all connected trading accounts for the user, filter by platform if provided
    let accounts = await prisma.tradingAccount.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'asc' }
    });
    if (requestedPlatform) {
      accounts = accounts.filter(a => a.platform === requestedPlatform || a.platform === requestedPlatform.toUpperCase());
    }

    console.log('Received sync request for user:', user.email, 'accounts:', accounts.map(a => a.platform), 'date range:', startDate, endDate);

    if (!accounts.length) {
      return NextResponse.json({ error: 'No connected trading accounts found.' }, { status: 400 });
    }

    // If testOnly is true, just test the connection and return results
    if (testOnly) {
      console.log('Test-only mode: Testing connections without syncing trades');
      const testResults: TestResult[] = [];
      
      for (const account of accounts) {
        try {
          const config = account.config ? JSON.parse(account.config) : {};
          const platformInstance = TradingPlatformFactory.createPlatform(
            account.platform as SupportedPlatform,
            {
              apiKey: account.apiKey || undefined,
              apiSecret: account.apiSecret || undefined,
              accessToken: account.accessToken || undefined,
              refreshToken: account.refreshToken || undefined,
              tokenExpiry: account.tokenExpiry || undefined,
              ...config,
              forceRefresh: forceRefresh,
            }
          );

          // Test connection if the platform supports it
          if (typeof (platformInstance as any).testConnection === 'function') {
            const testResult = await (platformInstance as any).testConnection();
            testResults.push({
              platform: account.platform,
              success: testResult.success,
              message: testResult.message,
              details: testResult.details
            });
          } else {
            // Fallback: try to authenticate
            const authenticated = await platformInstance.authenticate();
            testResults.push({
              platform: account.platform,
              success: authenticated,
              message: authenticated ? 'Authentication successful' : 'Authentication failed',
              details: { authenticated }
            });
          }
        } catch (error) {
          testResults.push({
            platform: account.platform,
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            details: { error: error instanceof Error ? error.message : String(error) }
          });
        }
      }

      return NextResponse.json({
        success: true,
        testMode: true,
        results: testResults,
        message: 'Connection tests completed'
      });
    }

    let totalTradesCreated = 0;
    let totalTradesUpdated = 0;
    let totalTradesSkipped = 0;
    let totalFetched = 0;
    let allPlatformResults: any[] = [];
    let anySuccess = false;

    for (const account of accounts) {
      let syncStatus: string = 'FAILED';
      let lastSyncAt: Date = new Date();
      try {
        // Check if account needs TOTP authentication
        if (account.syncStatus === 'TOTP_REQUIRED') {
          console.log(`Account ${account.platform} requires TOTP authentication`);
          allPlatformResults.push({
            platform: account.platform,
            error: 'TOTP (2FA) authentication required. Please enable 2FA in your Angel One app or contact support.',
            tradesFetched: 0,
            tradesCreated: 0,
            tradesUpdated: 0,
            tradesSkipped: 0
          });
          continue; // Skip this account
        }

        // Cast platform to SupportedPlatform for type safety
        const config = account.config ? JSON.parse(account.config) : {};
        
        // Use fresh TOTP if provided, otherwise use stored TOTP
        const totpToUse = freshTotp || config.totp;
        
        const platformInstance = TradingPlatformFactory.createPlatform(
          account.platform as SupportedPlatform,
          {
            apiKey: account.apiKey || undefined,
            apiSecret: account.apiSecret || undefined,
            accessToken: account.accessToken || undefined,
            refreshToken: account.refreshToken || undefined,
            tokenExpiry: account.tokenExpiry || undefined,
            ...config, // This will include clientcode, state, etc.
            totp: totpToUse, // Override with fresh TOTP if provided
            forceRefresh: forceRefresh, // Pass force refresh option
          }
        );

        // Always try to authenticate first - the platform will handle checking if existing tokens are valid
        const authenticated = await platformInstance.authenticate();
        if (!authenticated) {
          // Check for TOTP error
          const lastError = (platformInstance as any).lastError;
          if (lastError && typeof lastError === 'string' && lastError.toLowerCase().includes('totp')) {
            allPlatformResults.push({
              platform: account.platform,
              error: 'Your TOTP code is invalid or expired. Please enter a new TOTP from your authenticator app.',
              errorCode: 'INVALID_TOTP',
              tradesFetched: 0,
              tradesCreated: 0,
              tradesUpdated: 0,
              tradesSkipped: 0
            });
            continue;
          }
          // Otherwise, generic error
          allPlatformResults.push({
            platform: account.platform,
            error: 'Authentication failed. Please check your credentials.',
            tradesFetched: 0,
            tradesCreated: 0,
            tradesUpdated: 0,
            tradesSkipped: 0
          });
          continue;
        }
        
        // Update database with new tokens if authentication was successful and tokens changed
        const currentCredentials = platformInstance.getCredentials();
        if (currentCredentials.accessToken && currentCredentials.accessToken !== account.accessToken) {
          await prisma.tradingAccount.update({
            where: { id: account.id },
            data: {
              accessToken: currentCredentials.accessToken,
              refreshToken: currentCredentials.refreshToken || account.refreshToken,
              tokenExpiry: currentCredentials.tokenExpiry,
              updatedAt: new Date()
            }
          });
          console.log(`Updated tokens for ${account.platform} account`);
        }

        // Fetch trades from the platform, pass date range
        console.log('Fetching trades for', account.platform, 'from', startDate, 'to', endDate);
        
        let platformTrades: any[] = [];
        try {
          // Add detailed logging for Zerodha and Upstox
          if (account.platform === 'ZERODHA' || account.platform === 'UPSTOX') {
            console.log(`${account.platform} sync: Testing connection first...`);
            try {
              const testResult = await (platformInstance as any).testConnection();
              console.log(`${account.platform} test result:`, testResult);
              
              // For Upstox, if the test shows specific issues, provide better error messages
              if (account.platform === 'UPSTOX' && !testResult.success) {
                console.warn('Upstox connection test failed:', testResult.message);
                if (testResult.message.includes('reactivation')) {
                  allPlatformResults.push({
                    platform: account.platform,
                    error: 'Your Upstox account needs reactivation. Please log into your Upstox account and reactivate it before syncing.',
                    errorCode: 'ACCOUNT_REACTIVATION_REQUIRED',
                    tradesFetched: 0,
                    tradesCreated: 0,
                    tradesUpdated: 0,
                    tradesSkipped: 0
                  });
                  syncStatus = 'FAILED';
                  continue;
                }
              }
            } catch (testError) {
              console.warn(`${account.platform} test connection failed:`, testError);
            }
          }
          
          platformTrades = await platformInstance.getTrades(startDate, endDate);
          console.log('Fetched trades:', platformTrades.length, 'for', account.platform);
          
          // Add detailed logging for empty results
          if (platformTrades.length === 0) {
            console.log(`${account.platform}: No trades found. This could be normal if no trades were made in the date range.`);
            if (account.platform === 'ZERODHA') {
              console.log('Zerodha: ⚠️ API Limitation - Only today\'s trades are available via Kite Connect API');
              console.log('Zerodha: Historical trades from previous days cannot be fetched through the API');
              console.log('Zerodha: This is a known limitation of Zerodha\'s Kite Connect API');
            }
          }
        } catch (tradeError) {
          console.error(`Failed to fetch trades for ${account.platform}:`, tradeError);
          
          // Check if it's an authentication error
          const errorMessage = tradeError instanceof Error ? tradeError.message : String(tradeError);
          const errorData = tradeError instanceof Error ? (tradeError as any) : {};
          
          // Check for Zerodha specific token expiration - handle both Error objects and plain objects
          if (account.platform === 'ZERODHA') {
            // Check if the error is a plain object with TokenException structure
            if (typeof tradeError === 'object' && tradeError !== null && !(tradeError instanceof Error)) {
              const errorObj = tradeError as any;
              if (errorObj.error_type === 'TokenException' || 
                  (errorObj.message && errorObj.message.includes('Incorrect `api_key` or `access_token`'))) {
                allPlatformResults.push({
                  platform: account.platform,
                  error: 'Your Zerodha access token has expired. Please reconnect your Zerodha account to continue syncing.',
                  errorCode: 'TOKEN_EXPIRED',
                  tradesFetched: 0,
                  tradesCreated: 0,
                  tradesUpdated: 0,
                  tradesSkipped: 0
                });
                syncStatus = 'FAILED';
                continue;
              }
            }
            
            // Check if it's an Error object with TokenException
            if (errorMessage.includes('Incorrect `api_key` or `access_token`') || 
                errorData.error_type === 'TokenException' ||
                errorMessage.includes('TokenException')) {
              allPlatformResults.push({
                platform: account.platform,
                error: 'Your Zerodha access token has expired. Please reconnect your Zerodha account to continue syncing.',
                errorCode: 'TOKEN_EXPIRED',
                tradesFetched: 0,
                tradesCreated: 0,
                tradesUpdated: 0,
                tradesSkipped: 0
              });
              syncStatus = 'FAILED';
              continue;
            }
          }
          
          // Check for Upstox-specific errors
          if (account.platform === 'UPSTOX') {
            if (errorMessage.includes('reactivation')) {
              allPlatformResults.push({
                platform: account.platform,
                error: 'Your Upstox account needs reactivation. Please log into your Upstox account and reactivate it before syncing.',
                errorCode: 'ACCOUNT_REACTIVATION_REQUIRED',
                tradesFetched: 0,
                tradesCreated: 0,
                tradesUpdated: 0,
                tradesSkipped: 0
              });
              syncStatus = 'FAILED';
              continue;
            }
            
            if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
              allPlatformResults.push({
                platform: account.platform,
                error: 'Upstox tradebook not accessible. This could be due to account reactivation requirements or API permissions. Please check your Upstox account status.',
                errorCode: 'TRADEBOOK_NOT_ACCESSIBLE',
                tradesFetched: 0,
                tradesCreated: 0,
                tradesUpdated: 0,
                tradesSkipped: 0
              });
              syncStatus = 'FAILED';
              continue;
            }
          }
          
          // Check for other authentication errors
          if (errorMessage.includes('Invalid') && (errorMessage.includes('api_key') || errorMessage.includes('access_token'))) {
            allPlatformResults.push({
              platform: account.platform,
              error: 'Authentication failed. Your access token may have expired. Please reconnect your account.',
              errorCode: 'AUTH_FAILED',
              tradesFetched: 0,
              tradesCreated: 0,
              tradesUpdated: 0,
              tradesSkipped: 0
            });
            syncStatus = 'FAILED';
            continue;
          }
          
          // For other API errors
          allPlatformResults.push({
            platform: account.platform,
            error: `Failed to fetch trades: ${errorMessage}`,
            tradesFetched: 0,
            tradesCreated: 0,
            tradesUpdated: 0,
            tradesSkipped: 0
          });
          syncStatus = 'FAILED';
          continue;
        }
        
        totalFetched += platformTrades.length;

        // Add detailed logging for Zerodha trades
        if (account.platform === 'ZERODHA') {
          console.log('Zerodha trades before processing:', platformTrades.map(t => ({
            id: t.id,
            symbol: t.symbol,
            type: t.type,
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            quantity: t.quantity,
            profitLoss: t.profitLoss,
            status: t.status,
            entryDate: t.entryDate
          })));
        }

        let tradesCreated = 0;
        let tradesUpdated = 0;
        let tradesSkipped = 0;

        for (const platformTrade of platformTrades) {
          try {
            // Validate entryDate
            const entryDateObj = new Date(platformTrade.entryDate);
            if (!platformTrade.entryDate || isNaN(entryDateObj.getTime())) {
              console.warn(`Skipping trade ${platformTrade.id}: Invalid entryDate "${platformTrade.entryDate}"`);
              tradesSkipped++;
              continue;
            }
            // Use platformTradeId directly (assume it exists in the Trade model)
            const existingTrade = await prisma.trade.findFirst({
              where: {
                userId: user.id,
                platform: account.platform,
                platformTradeId: platformTrade.id
              }
            });

            const tradeData = {
              userId: user.id,
              symbol: platformTrade.symbol,
              type: platformTrade.type,
              instrumentType: platformTrade.instrumentType,
              entryPrice: parseFloat(platformTrade.entryPrice.toFixed(2)),
              exitPrice: platformTrade.exitPrice !== undefined && platformTrade.exitPrice !== null ? parseFloat(platformTrade.exitPrice.toFixed(2)) : null,
              quantity: platformTrade.quantity,
              strikePrice: platformTrade.strikePrice !== undefined && platformTrade.strikePrice !== null ? parseFloat(platformTrade.strikePrice.toFixed(2)) : null,
              expiryDate: platformTrade.expiryDate ? new Date(platformTrade.expiryDate) : null,
              optionType: platformTrade.optionType || null,
              premium: platformTrade.premium !== undefined && platformTrade.premium !== null ? parseFloat(platformTrade.premium.toFixed(2)) : null,
              entryDate: entryDateObj,
              exitDate: platformTrade.exitDate ? new Date(platformTrade.exitDate) : null,
              profitLoss: (() => {
                // First, try to use the profitLoss directly from the platform
                if (platformTrade.profitLoss !== undefined && platformTrade.profitLoss !== null) {
                  const pl = parseFloat(platformTrade.profitLoss.toFixed(2));
                  console.log(`Using platform P&L for ${platformTrade.symbol}: ${pl}`);
                  return pl;
                }
                
                // If no platform P&L, try to calculate from entry/exit prices
                if (platformTrade.exitPrice !== undefined && platformTrade.exitPrice !== null &&
                    platformTrade.entryPrice !== undefined && platformTrade.entryPrice !== null) {
                  const entryPrice = parseFloat(platformTrade.entryPrice);
                  const exitPrice = parseFloat(platformTrade.exitPrice);
                  const quantity = parseFloat(platformTrade.quantity);
                  
                  let calculatedPL: number;
                  if (platformTrade.type === 'LONG') {
                    calculatedPL = (exitPrice - entryPrice) * quantity;
                  } else {
                    calculatedPL = (entryPrice - exitPrice) * quantity;
                  }
                  
                  const pl = parseFloat(calculatedPL.toFixed(2));
                  console.log(`Calculated P&L for ${platformTrade.symbol}: ${pl} (${platformTrade.type}: ${entryPrice} -> ${exitPrice} x ${quantity})`);
                  return pl;
                }
                
                // If we can't calculate P&L, log it and return null
                console.log(`No P&L available for ${platformTrade.symbol} - platform P&L: ${platformTrade.profitLoss}, exitPrice: ${platformTrade.exitPrice}, entryPrice: ${platformTrade.entryPrice}`);
                return null;
              })(),
              notes: ('notes' in platformTrade ? (platformTrade as any).notes : undefined) || `Auto-synced from ${account.platform} - ${platformTrade.orderId || ''}`,
              platformTradeId: platformTrade.id,
              platform: account.platform,
              sector: (platformTrade as any).sector || null,
              strategy: (platformTrade as any).strategy || null,
              setupImageUrl: (platformTrade as any).setupImageUrl || null,
              setupDescription: (platformTrade as any).setupDescription || null,
              preTradeEmotion: (platformTrade as any).preTradeEmotion || null,
              postTradeEmotion: (platformTrade as any).postTradeEmotion || null,
              tradeConfidence: (platformTrade as any).tradeConfidence || null,
              confidenceLevel: (platformTrade as any).confidenceLevel || null,
              tradeRating: (platformTrade as any).tradeRating || null,
              rating: (platformTrade as any).rating || null,
              lessons: (platformTrade as any).lessons || null,
              lessonsLearned: (platformTrade as any).lessonsLearned || null,
              riskRewardRatio: (platformTrade as any).riskRewardRatio || null,
              stopLoss: (platformTrade as any).stopLoss || null,
              targetPrice: (platformTrade as any).targetPrice || null,
              timeFrame: (platformTrade as any).timeFrame || null,
              marketCondition: (platformTrade as any).marketCondition || null,
              isDemo: (platformTrade as any).isDemo || false,
            };

            if (existingTrade) {
              await prisma.trade.update({
                where: { id: existingTrade.id },
                data: tradeData
              });
              tradesUpdated++;
            } else {
              await prisma.trade.create({
                data: tradeData
              });
              tradesCreated++;
            }
            
            // Log the final trade data for debugging
            if (account.platform === 'ZERODHA') {
              console.log(`Processed Zerodha trade ${platformTrade.symbol}:`, {
                id: platformTrade.id,
                symbol: tradeData.symbol,
                type: tradeData.type,
                entryPrice: tradeData.entryPrice,
                exitPrice: tradeData.exitPrice,
                quantity: tradeData.quantity,
                profitLoss: tradeData.profitLoss
              });
            }
          } catch (error) {
            console.error(`Error processing trade ${platformTrade.id}:`, error);
            tradesSkipped++;
          }
        }

        console.log(`Trades created: ${tradesCreated}, updated: ${tradesUpdated}, skipped: ${tradesSkipped} for ${account.platform}`);

        totalTradesCreated += tradesCreated;
        totalTradesUpdated += tradesUpdated;
        totalTradesSkipped += tradesSkipped;

        allPlatformResults.push({
          platform: account.platform,
          tradesFetched: platformTrades.length,
          tradesCreated,
          tradesUpdated,
          tradesSkipped
        });
        // Consider it a success if we reached this point (authentication and API calls worked)
        anySuccess = true;
        syncStatus = 'SUCCESS';
      } catch (err) {
        if (err instanceof Error && err.message === 'INVALID_TOTP') {
          allPlatformResults.push({
            platform: account.platform,
            error: 'Your TOTP code is invalid or expired. Please enter a new TOTP from your authenticator app.',
            errorCode: 'INVALID_TOTP',
            tradesFetched: 0,
            tradesCreated: 0,
            tradesUpdated: 0,
            tradesSkipped: 0
          });
          syncStatus = 'FAILED';
          continue;
        }
        console.error(`Error syncing account ${account.platform}:`, err);
        allPlatformResults.push({
          platform: account.platform,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
        syncStatus = 'FAILED';
      } finally {
        // Always update syncStatus and lastSyncAt for the account
        await prisma.tradingAccount.update({
          where: { id: account.id },
          data: {
            syncStatus: syncStatus,
            lastSyncAt: lastSyncAt
          }
        });
      }
    }

    const hasInvalidTotp = allPlatformResults.some(r => r.errorCode === 'INVALID_TOTP');
    const hasAuthFailed = allPlatformResults.some(r => r.errorCode === 'AUTH_FAILED');
    const hasTokenExpired = allPlatformResults.some(r => r.errorCode === 'TOKEN_EXPIRED');

    // Return specific error codes for different failure types
    if (!anySuccess) {
      const errorResponse = {
        success: false,
        message: 'All platform syncs failed.',
        allPlatformResults,
        errorCode: hasInvalidTotp ? 'INVALID_TOTP' : hasTokenExpired ? 'TOKEN_EXPIRED' : hasAuthFailed ? 'AUTH_FAILED' : undefined
      };
      console.log('Returning error to frontend:', errorResponse);
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // If no trades were fetched for any platform, return a success message with info
    if (totalFetched === 0) {
      console.warn('No trades fetched for any platform.');
      
      // Check if this is specifically a Zerodha limitation
      const hasZerodha = allPlatformResults.some(r => r.platform === 'ZERODHA');
      let message = 'Sync completed successfully. No trades found in the last 90 days. This is normal if you haven\'t made any buy/sell transactions recently.';
      
      if (hasZerodha) {
        message = 'Sync completed successfully. ⚠️ Note: Zerodha\'s Kite Connect API only provides today\'s trades, not historical data from previous days. This is a known limitation of their API.';
      }
      
      // Trigger dashboard update even when no trades are fetched
      await dashboardUpdater.triggerUpdate({
        type: 'PLATFORM_SYNC',
        userId: user.id,
        data: {
          allPlatformResults,
          totalTradesCreated,
          totalTradesUpdated,
          totalTradesSkipped,
          totalFetched
        },
        timestamp: new Date()
      });

      // Revalidate all relevant pages after sync
      try {
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/trades');
        revalidatePath('/calendar');
        revalidatePath('/analytics');
        revalidatePath('/heatmaps');
        revalidatePath('/');
      } catch (err) {
        console.error('Failed to revalidate paths after sync:', err);
      }
      
      return NextResponse.json({
        success: true,
        message,
        allPlatformResults,
        totalTradesCreated,
        totalTradesUpdated,
        totalTradesSkipped,
        totalFetched
      });
    }

    // Trigger dashboard update
    await dashboardUpdater.triggerUpdate({
      type: 'PLATFORM_SYNC',
      userId: user.id,
      data: {
        allPlatformResults,
        totalTradesCreated,
        totalTradesUpdated,
        totalTradesSkipped,
        totalFetched
      },
      timestamp: new Date()
    });

    // Revalidate all relevant pages after sync
    try {
      const { revalidatePath } = await import('next/cache');
      revalidatePath('/trades');
      revalidatePath('/calendar');
      revalidatePath('/analytics');
      revalidatePath('/heatmaps');
      revalidatePath('/');
    } catch (err) {
      console.error('Failed to revalidate paths after sync:', err);
    }

    return NextResponse.json({
      success: true,
      message: `Sync completed successfully! Fetched ${totalFetched} trades, created ${totalTradesCreated} new trades, updated ${totalTradesUpdated} existing trades, and skipped ${totalTradesSkipped} trades.`,
      allPlatformResults,
      totalTradesCreated,
      totalTradesUpdated,
      totalTradesSkipped,
      totalFetched
    }, { status: 200 });

  } catch (error) {
    console.error('Error in sync API:', error);
    return NextResponse.json({ 
      error: 'Internal server error during sync',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: any) {
  return NextResponse.json({ message: 'Sync endpoint - use POST to sync trades' });
} 