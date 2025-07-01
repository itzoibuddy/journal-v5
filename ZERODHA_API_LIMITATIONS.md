# Zerodha Kite Connect API Limitations

## ⚠️ Important: Historical Trade Data Limitation

**Zerodha's Kite Connect API has a significant limitation that affects trade journaling:**

### What's Available:
- ✅ **Today's trades only** - `kite.getTrades()` returns only today's executed trades
- ✅ **Current holdings** - Portfolio holdings and positions
- ✅ **User profile** - Account details and permissions
- ✅ **Current positions** - Open positions and margins

### What's NOT Available:
- ❌ **Historical trades** - Trades from previous days cannot be fetched
- ❌ **Order history** - Limited access to past orders
- ❌ **Historical data** - No access to trade data older than today

## Why This Happens

This is a **known limitation** of Zerodha's Kite Connect API, not an issue with our implementation. Zerodha designed their API to focus on real-time trading rather than historical data retrieval.

## Workarounds

### 1. Manual Entry for Historical Trades
- Enter your historical trades manually in the trading journal
- Use the manual trade entry form for trades from previous days

### 2. Daily Sync for New Trades
- Sync daily to capture today's trades automatically
- Set up daily reminders to sync after trading sessions

### 3. Alternative Data Sources
- Export trade data from Zerodha's web platform
- Use contract notes for historical trade details
- Consider using other platforms that provide historical data

## What You Can Do

1. **For Today's Trades**: Use the sync feature - it will capture all trades executed today
2. **For Historical Trades**: Enter them manually in your trading journal
3. **For Future Trades**: Sync daily to maintain an up-to-date journal

## Technical Details

The API limitation is enforced at Zerodha's server level. Even with valid authentication, the `getTrades()` method will only return trades from the current trading day.

## Support

If you need historical trade data, consider:
- Contacting Zerodha support for data export options
- Using manual entry for historical trades
- Exploring other trading platforms with better historical data APIs

---

*This limitation is specific to Zerodha's Kite Connect API and does not affect other supported platforms like Angel One, Upstox, etc.* 