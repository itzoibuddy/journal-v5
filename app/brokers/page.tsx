'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import BrokerCredentialModal from '../components/BrokerCredentialModal'
import { TradingPlatformFactory } from '../lib/trading-platforms/factory'

interface BrokerConfig {
  id: string
  name: string
  logo: string
  status: 'available' | 'connected' | 'error'
  description: string
  features: string[]
  requiresAPI: boolean
  limitations?: string
}

interface BrokerSettings {
  connectedBrokers: string[]
  connectedAccounts: any[]
  autoSync: boolean
  syncFrequency: string
  lastSync: string | null
}

function TotpModal({ open, onClose, onSubmit, loading, error, forceRefresh = false }: { 
  open: boolean, 
  onClose: () => void, 
  onSubmit: (totp: string, forceRefresh: boolean) => void, 
  loading: boolean, 
  error?: string,
  forceRefresh?: boolean
}) {
  const [totp, setTotp] = useState('');
  const [localError, setLocalError] = useState('');
  const [useForceRefresh, setUseForceRefresh] = useState(forceRefresh);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!totp || totp.length !== 6) {
      setLocalError('Please enter a valid 6-digit TOTP code.');
      return;
    }
    setLocalError('');
    onSubmit(totp, useForceRefresh);
  };
  
  useEffect(() => { 
    if (!open) { 
      setTotp(''); 
      setLocalError(''); 
      setUseForceRefresh(forceRefresh);
    } 
  }, [open, forceRefresh]);
  
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-2">Enter TOTP to Sync</h2>
        <p className="text-gray-600 mb-4">
          Please enter the 6-digit TOTP from your authenticator app to sync your trades. 
          <strong className="text-red-600"> TOTP codes expire every 30 seconds, so enter a fresh code quickly!</strong>
        </p>
        <p className="text-sm text-gray-500 mb-4">
          📅 Syncing trades from the last 90 days
        </p>
        
        {/* Force Refresh Option */}
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useForceRefresh}
              onChange={(e) => setUseForceRefresh(e.target.checked)}
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-orange-800">
              Force Refresh Sync
            </span>
          </label>
          <p className="text-xs text-orange-700 mt-1">
            {useForceRefresh 
              ? "This will delete existing holdings-based trades and re-create them from your current portfolio. Use this if you've deleted trades and want to re-sync them."
              : "Normal sync - avoids creating duplicate trades."
            }
          </p>
        </div>
        
        <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200 mb-4">
          💡 <strong>Note:</strong> If you've already synced trades recently, you might see "no trades found" - this is normal! The system avoids duplicates.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            className="w-full border rounded px-3 py-2 mb-2 text-lg text-center tracking-widest"
            placeholder="123456"
            value={totp}
            onChange={e => setTotp(e.target.value.replace(/[^0-9]/g, ''))}
            disabled={loading}
            autoFocus
          />
          {(localError || error) && <div className="text-red-600 text-sm mb-2">{localError || error}</div>}
          <div className="text-xs text-gray-500 mb-4">
            💡 Tip: Open your authenticator app first, then quickly copy and paste the 6-digit code here.
          </div>
          <div className="flex justify-end space-x-2 mt-2">
            <button type="button" className="px-3 py-1 rounded bg-gray-200" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="px-3 py-1 rounded bg-indigo-600 text-white" disabled={loading}>
              {loading ? 'Syncing...' : useForceRefresh ? 'Force Sync' : 'Sync'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BrokersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [connectingBroker, setConnectingBroker] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null)
  const [credentialModalOpen, setCredentialModalOpen] = useState(false)
  const [selectedBroker, setSelectedBroker] = useState<BrokerConfig | null>(null)
  const [credentialFields, setCredentialFields] = useState<any[]>([])
  const [credentialLoading, setCredentialLoading] = useState(false)
  const [credentialError, setCredentialError] = useState<string | null>(null)
  const [credentialHelper, setCredentialHelper] = useState<{ url: string; instructions: string } | null>(null)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [totpModalOpen, setTotpModalOpen] = useState(false)
  const [totpSyncLoading, setTotpSyncLoading] = useState(false)
  const [pendingTotp, setPendingTotp] = useState(false)
  const [totpModalError, setTotpModalError] = useState<string | undefined>(undefined)
  const [forceRefreshRequested, setForceRefreshRequested] = useState(false)
  
  const [brokerSettings, setBrokerSettings] = useState<BrokerSettings>({
    connectedBrokers: [],
    connectedAccounts: [],
    autoSync: true,
    syncFrequency: 'hourly',
    lastSync: null
  })

  // Available brokers configuration
  const availableBrokers: BrokerConfig[] = [
    // Indian Brokers
    {
      id: 'zerodha',
      name: 'Zerodha',
      logo: '🔵',
      status: brokerSettings.connectedBrokers.includes('zerodha') ? 'connected' : 'available',
      description: 'India\'s largest discount broker with Kite Connect API',
      features: ['Real-time trade sync', 'Portfolio data', 'Order history', 'Holdings', 'P&L tracking'],
      requiresAPI: true,
      limitations: '⚠️ API Limitation: Only today\'s trades are available. Historical trades cannot be fetched.'
    },
    {
      id: 'upstox',
      name: 'Upstox',
      logo: '🟠',
      status: brokerSettings.connectedBrokers.includes('upstox') ? 'connected' : 'available',
      description: 'Modern discount broker with powerful API and low brokerage',
      features: ['Live market data', 'Order management', 'Portfolio tracking', 'Options chain'],
      requiresAPI: true
    },
    {
      id: 'angelone',
      name: 'Angel One',
      logo: '👼',
      status: brokerSettings.connectedBrokers.includes('angelone') ? 'connected' : 'available',
      description: 'Leading full-service broker with SmartAPI integration',
      features: ['Trade sync', 'Research reports', 'Mutual funds', 'IPO applications'],
      requiresAPI: true
    },
    {
      id: 'dhan',
      name: 'Dhan',
      logo: '💎',
      status: brokerSettings.connectedBrokers.includes('dhan') ? 'connected' : 'available',
      description: 'Next-gen trading platform with advanced charting and analytics',
      features: ['Advanced charts', 'Options strategies', 'Backtesting', 'Algo trading'],
      requiresAPI: true
    },
    {
      id: 'groww',
      name: 'Groww',
      logo: '🌱',
      status: brokerSettings.connectedBrokers.includes('groww') ? 'connected' : 'available',
      description: 'Popular platform for stocks, mutual funds and digital gold',
      features: ['Stock trading', 'Mutual funds', 'SIP tracking', 'Goal planning'],
      requiresAPI: true
    },
    {
      id: '5paisa',
      name: '5paisa',
      logo: '💰',
      status: brokerSettings.connectedBrokers.includes('5paisa') ? 'connected' : 'available',
      description: 'Affordable brokerage with comprehensive trading solutions',
      features: ['Low brokerage', 'Research reports', 'Mutual funds', 'Insurance'],
      requiresAPI: true
    },
    {
      id: 'icicidirect',
      name: 'ICICI Direct',
      logo: '🏛️',
      status: brokerSettings.connectedBrokers.includes('icicidirect') ? 'connected' : 'available',
      description: 'Full-service broker from ICICI Bank with research and advisory',
      features: ['Research reports', 'Investment advisory', 'Mutual funds', 'IPO services'],
      requiresAPI: true
    },
    {
      id: 'fyers',
      name: 'Fyers',
      logo: '🚀',
      status: brokerSettings.connectedBrokers.includes('fyers') ? 'connected' : 'available',
      description: 'Technology-focused broker with advanced trading tools',
      features: ['API trading', 'Advanced charts', 'Options strategies', 'Market scanner'],
      requiresAPI: true
    },
    {
      id: 'sasonline',
      name: 'SAS Online',
      logo: '📈',
      status: brokerSettings.connectedBrokers.includes('sasonline') ? 'connected' : 'available',
      description: 'Established broker with comprehensive trading and investment services',
      features: ['Full-service trading', 'Research', 'Mutual funds', 'Portfolio management'],
      requiresAPI: true
    }
  ]

  useEffect(() => {
    if (status === 'loading') return
    
    if (status === 'unauthenticated') {
      router.push('/signin')
    } else if (session?.user) {
      fetchBrokerSettings()
      
      // Handle OAuth callback messages
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const error = urlParams.get('error');
      
      if (success) {
        let successMessage = 'Broker connected successfully!';
        const autoSync = urlParams.get('auto_sync');
        
        if (success === 'zerodha_connected') {
          if (autoSync === 'true') {
            successMessage = 'Zerodha connected successfully! ✅ Today\'s trades have been automatically synced and your dashboard is now updated.';
          } else {
            successMessage = 'Zerodha connected successfully! Your trades from the last 90 days have been automatically synced.';
          }
        } else if (success === 'upstox_connected') {
          successMessage = 'Upstox connected successfully! Your trades from the last 90 days have been automatically synced.';
        } else if (success === 'angel_one_connected') {
          successMessage = 'Angel One connected successfully!';
        } else if (success === 'icici_direct_connected') {
          successMessage = 'ICICI Direct connected successfully!';
        } else if (success === 'dhan_connected') {
          successMessage = 'Dhan connected successfully!';
        }
        
        setMessage({ type: 'success', text: successMessage });
        setTimeout(() => setMessage(null), 8000); // Show for longer since it's important
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      if (error) {
        let errorMessage = 'Failed to connect broker. Please try again.';
        if (error === 'zerodha_login_failed') {
          errorMessage = 'Zerodha login failed. Please try again.';
        } else if (error === 'zerodha_invalid_api_key') {
          errorMessage = 'Zerodha API key is invalid or not configured. Please check your environment variables.';
        } else if (error === 'zerodha_invalid_api_secret') {
          errorMessage = 'Zerodha API secret is invalid or not configured. Please check your environment variables.';
        } else if (error === 'zerodha_invalid_checksum') {
          errorMessage = 'Zerodha authentication checksum is invalid. Please try again.';
        } else if (error === 'zerodha_not_configured') {
          errorMessage = 'Zerodha integration is not configured. Please set up the required environment variables.';
        } else if (error === 'upstox_access_denied') {
          errorMessage = 'Upstox access denied. Please authorize the application.';
        } else if (error === 'dhan_access_denied') {
          errorMessage = 'Dhan access denied. Please authorize the application.';
        } else if (error === 'token_exchange_failed') {
          errorMessage = 'Authentication failed. Please try again.';
        } else if (error === 'invalid_token_response') {
          errorMessage = 'Invalid response from Zerodha. Please try again.';
        } else if (error === 'user_not_found') {
          errorMessage = 'User not found. Please sign in again.';
        } else if (error === 'no_request_token') {
          errorMessage = 'No request token received from Zerodha. Please try again.';
        } else if (error === 'callback_error') {
          errorMessage = 'An error occurred during authentication. Please try again.';
        } else if (error === 'invalid_response_format') {
          errorMessage = 'Invalid response format from Zerodha. Please try again.';
        } else if (error === 'account_reactivation_required') {
          const details = urlParams.get('details');
          errorMessage = `Upstox account needs reactivation. Please log into your Upstox app/web and reactivate your account before trying again. ${details ? `Details: ${details}` : ''}`;
        } else if (error === 'invalid_auth_code') {
          const details = urlParams.get('details');
          errorMessage = `Authentication code expired or invalid. Please try connecting again. ${details ? `Details: ${details}` : ''}`;
        } else if (error === 'token_exchange_failed') {
          const details = urlParams.get('details');
          if (details === 'redirect_uri_mismatch') {
            errorMessage = 'Upstox redirect URI mismatch. Please check your Upstox app configuration.';
          } else {
            errorMessage = 'Authentication failed. Please try again.';
          }
        }
        
        setMessage({ type: 'error', text: errorMessage });
        setTimeout(() => setMessage(null), 5000);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [session, status, router])

  const fetchBrokerSettings = async () => {
    try {
      const response = await fetch('/api/trading-platforms/accounts');
      const data = await response.json();
      if (response.ok && data.success) {
        console.log('Fetched accounts:', data.data);
        setBrokerSettings(prev => ({
          ...prev,
          connectedAccounts: data.data || [],
          connectedBrokers: (data.data || []).map((acc: any) => {
            // Map platform names back to broker IDs
            const platformMap: { [key: string]: string } = {
              'ZERODHA': 'zerodha',
              'UPSTOX': 'upstox',
              'ANGEL_ONE': 'angelone',
              'GROWW': 'groww',
              'DHAN': 'dhan',
              'FYERS': 'fyers',
              'SAS_ONLINE': 'sasonline',
              '5PAISA': '5paisa',
              'ICICI_DIRECT': 'icicidirect'
            };
            return platformMap[acc.platform] || acc.platform.toLowerCase();
          })
        }));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching broker settings:', error)
      setLoading(false)
    }
  }

  const handleConnectBroker = async (brokerId: string) => {
    console.log('handleConnectBroker called with brokerId:', brokerId);
    
    // For OAuth-supported brokers, redirect directly
    if (brokerId === 'zerodha') {
      console.log('Redirecting to Zerodha OAuth');
      // Direct redirect to Zerodha OAuth - no fetch check needed
      window.location.href = '/api/auth/zerodha';
      return;
    }
    
    if (brokerId === 'upstox') {
      console.log('Redirecting to Upstox OAuth');
      window.location.href = '/api/auth/upstox';
      return;
    }
    
    if (brokerId === 'dhan') {
      console.log('Redirecting to Dhan OAuth');
      window.location.href = '/api/auth/dhan';
      return;
    }
    
    if (brokerId === 'angelone') {
      console.log('Redirecting to Angel One setup');
      window.location.href = '/trading-platforms/angel-one-setup';
      return;
    }
    
    if (brokerId === 'icicidirect') {
      console.log('Redirecting to ICICI Direct setup');
      window.location.href = '/trading-platforms/icici-direct-setup';
      return;
    }

    console.log('Using modal approach for broker:', brokerId);
    // For other brokers, use the old modal approach
    const broker = availableBrokers.find(b => b.id === brokerId)
    if (!broker) return
    // Map broker.id to SupportedPlatform value
    let platformKey = broker.id.toUpperCase()
    if (platformKey === 'ANGELONE') platformKey = 'ANGEL_ONE'
    if (platformKey === 'ICICIDIRECT') platformKey = 'ICICI_DIRECT'

    try {
      const config = TradingPlatformFactory.getPlatformConfig(platformKey as any)
      setSelectedBroker(broker)
      setCredentialFields(config.fields)
      setCredentialModalOpen(true)
      setCredentialError(null)
      if (broker.id === 'zerodha') {
        setCredentialHelper({
          url: `https://kite.zerodha.com/connect/login?v=3&api_key=${process.env.NEXT_PUBLIC_ZERODHA_API_KEY}`,
          instructions: '1. Click the button below to open the Zerodha login page. 2. Log in and authorize. 3. Copy the request_token from the URL you are redirected to and paste it here.'
        });
      } else {
        setCredentialHelper(null);
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'This broker is not yet supported.' })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const handleCredentialSubmit = async (form: Record<string, string>) => {
    if (!selectedBroker) return
    setCredentialLoading(true)
    setCredentialError(null)
    // Map broker.id to SupportedPlatform value
    let platformKey = selectedBroker.id.toUpperCase()
    if (platformKey === 'ANGELONE') platformKey = 'ANGEL_ONE'
    if (platformKey === 'ICICIDIRECT') platformKey = 'ICICI_DIRECT'
    try {
      // For Angel One, ensure correct mapping of all required fields
      let payload: Record<string, any> = { platform: platformKey as any };
      if (platformKey === 'ANGEL_ONE') {
        payload = {
          platform: platformKey,
          apiKey: form.apiKey,
          clientcode: form.clientcode,
          apiSecret: form.apiSecret,
          totp: form.totp,
          state: form.state
        };
      } else {
        payload = { platform: platformKey as any, ...form };
      }
      // Debug log: print the payload being sent to the backend
      console.log('Submitting broker connect payload:', payload);
      const res = await fetch('/api/trading-platforms/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to connect broker.')
      
      setCredentialModalOpen(false)
      setSelectedBroker(null)
      setCredentialFields([])
      setMessage({ type: 'success', text: `Successfully connected to ${selectedBroker.name}!` })
      setTimeout(() => setMessage(null), 5000)
      // Refresh connected brokers from backend
      await fetchBrokerSettings()
      // Trigger sync after connect
      await handleSyncNow()
    } catch (error: any) {
      setCredentialError(error.message || 'Failed to connect broker.')
    } finally {
      setCredentialLoading(false)
    }
  }

  const handleDisconnectBroker = async (brokerId: string) => {
    // Map broker ID back to platform name
    const platformMap: { [key: string]: string } = {
      'angelone': 'ANGEL_ONE',
      'zerodha': 'ZERODHA',
      'upstox': 'UPSTOX',
      'groww': 'GROWW',
      'dhan': 'DHAN',
      'fyers': 'FYERS',
      'sasonline': 'SAS_ONLINE',
      '5paisa': '5PAISA',
      'icicidirect': 'ICICI_DIRECT'
    };
    
    const platformName = platformMap[brokerId] || brokerId.toUpperCase();
    
    try {
      // Call the DELETE API to remove the account from database
      const response = await fetch(`/api/trading-platforms/accounts?platform=${platformName}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to disconnect broker');
      }
      
      setBrokerSettings(prev => ({
        ...prev,
        connectedBrokers: prev.connectedBrokers.filter(id => id !== brokerId),
        connectedAccounts: prev.connectedAccounts.filter((acc: any) => acc.platform !== platformName)
      }))
      setMessage({ type: 'success', text: 'Broker disconnected successfully!' })
      setTimeout(() => setMessage(null), 5000)
      // Refresh connected brokers from backend
      await fetchBrokerSettings()
    } catch (error) {
      console.error('Error disconnecting broker:', error);
      setMessage({ type: 'error', text: 'Failed to disconnect broker. Please try again.' })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const handleSyncNow = async (platform?: string, totp?: string, forceRefresh: boolean = false) => {
    setSyncing(true);
    setSyncingPlatform(platform || null);
    try {
      const syncPayload: any = {};
      if (platform) {
        syncPayload.platform = platform;
      }
      if (totp) {
        syncPayload.totp = totp;
      }
      if (forceRefresh) {
        syncPayload.forceRefresh = true;
      }
      
      const response = await fetch('/api/trading-platforms/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncPayload),
      });
      const result = await response.json();
      console.log('SYNC RESULT', result);
      // Always check for INVALID_TOTP first, even if response.ok is false
      if (result.errorCode === 'INVALID_TOTP') {
        setTotpModalOpen(true);
        setPendingTotp(true);
        setTotpModalError(
          'Your TOTP code is invalid or expired. Please open your authenticator app and enter a fresh 6-digit TOTP code. You do NOT need to disconnect or reconnect your account - just enter a new TOTP code.'
        );
        setTimeout(() => setMessage(null), 5000);
        return;
      }
      
      // Check for authentication failure
      if (result.errorCode === 'AUTH_FAILED') {
        setMessage({ type: 'error', text: 'Authentication failed. Your access token may have expired. Please reconnect your account.' });
        setTimeout(() => setMessage(null), 5000);
        return;
      }

      // Check for token expiration (specifically for Zerodha)
      if (result.errorCode === 'TOKEN_EXPIRED') {
        setMessage({ type: 'error', text: 'Your Zerodha access token has expired. Please reconnect your Zerodha account to continue syncing.' });
        setTimeout(() => setMessage(null), 5000);
        return;
      }

      if (response.ok && result.success) {
        const platformName = platform ? ` for ${platform}` : '';
        setMessage({ type: 'success', text: `Trades synced successfully${platformName}! ${result.message || ''}` });
        setBrokerSettings(prev => ({
          ...prev,
          lastSync: new Date().toISOString()
        }));
        await fetchBrokerSettings();
        setTotpModalOpen(false);
        setPendingTotp(false);
        setTotpModalError(undefined);
      } else {
        setMessage({ type: 'error', text: result.error || result.message || 'Sync failed. Please try again.' });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Sync failed. Please try again.' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSyncing(false);
      setSyncingPlatform(null);
      setTotpSyncLoading(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    setCleaningUp(true)
    try {
      const response = await fetch('/api/trading-platforms/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup-duplicates' })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to cleanup duplicates')
      
      setMessage({ type: 'success', text: data.message || 'Cleaned up duplicate accounts!' })
      setTimeout(() => setMessage(null), 5000)
      
      // Refresh the accounts list
      await fetchBrokerSettings()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to cleanup duplicates' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setCleaningUp(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Connect Your Trading Brokers
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Seamlessly integrate your trading accounts to automatically sync trades, 
            track performance, and analyze your trading patterns.
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-8 p-4 rounded-xl border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Connected Brokers Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Connected Brokers</h2>
            
            {brokerSettings.connectedAccounts.length > 1 && (
              <button
                onClick={handleCleanupDuplicates}
                disabled={cleaningUp}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              >
                {cleaningUp ? 'Cleaning...' : 'Cleanup Duplicates'}
              </button>
            )}
          </div>

          {brokerSettings.connectedAccounts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {brokerSettings.connectedAccounts.map(account => {
                const brokerId = (() => {
                  const platformMap: { [key: string]: string } = {
                    'ZERODHA': 'zerodha',
                    'UPSTOX': 'upstox',
                    'ANGEL_ONE': 'angelone',
                    'GROWW': 'groww',
                    'DHAN': 'dhan',
                    'FYERS': 'fyers',
                    'SAS_ONLINE': 'sasonline',
                    '5PAISA': '5paisa',
                    'ICICI_DIRECT': 'icicidirect'
                  };
                  return platformMap[account.platform] || account.platform.toLowerCase();
                })();
                
                const broker = availableBrokers.find(b => b.id === brokerId)
                
                return (
                  <div key={account.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-3xl">{broker?.logo || '📊'}</div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{broker?.name || account.platform}</h3>
                          <p className="text-sm text-gray-500">{account.accountName || 'Connected Account'}</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        Connected
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Sync Now button logic */}
                      {account.platform === 'ANGEL_ONE' ? (
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              setForceRefreshRequested(false);
                              setTotpModalOpen(true);
                              // Store the platform for TOTP sync
                              setSelectedBroker({ id: 'angelone', name: 'Angel One', logo: '👼', status: 'connected', description: '', features: [], requiresAPI: true });
                            }}
                            disabled={syncing}
                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
                          >
                            {syncing && syncingPlatform === 'ANGEL_ONE' ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Syncing...
                              </>
                            ) : (
                              'Sync Now'
                            )}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSyncNow(account.platform)}
                          disabled={syncing}
                          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
                        >
                          {syncing && syncingPlatform === account.platform ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Syncing...
                            </>
                          ) : (
                            'Sync Now'
                          )}
                        </button>
                      )}
                      {account.platform === 'ANGEL_ONE' && (
                        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
                          💡 <strong>Note:</strong> You'll need to enter a fresh TOTP code each time you sync. This is normal for Angel One accounts.
                        </div>
                      )}
                      {account.platform === 'ZERODHA' && (
                        <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
                          ⚠️ <strong>Note:</strong> Zerodha's API only provides today's trades, not historical data from previous days. This is a known limitation of their Kite Connect API.
                        </div>
                      )}
                      <button
                        onClick={() => handleDisconnectBroker(brokerId)}
                        className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {brokerSettings.connectedAccounts.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="text-6xl mb-4">🔗</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No brokers connected yet</h3>
              <p className="text-gray-600 mb-6">Connect your first trading broker to start syncing trades automatically.</p>
            </div>
          )}
        </div>

        {/* Sync Status */}
        {brokerSettings.lastSync && (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">
              Last synced: {new Date(brokerSettings.lastSync).toLocaleString()}
            </p>
          </div>
        )}

        {/* Available Brokers Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Indian Brokers</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableBrokers
              .filter(broker => !brokerSettings.connectedBrokers.includes(broker.id))
              .map(broker => (
                <div key={broker.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl">{broker.logo}</div>
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                      Available
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{broker.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{broker.description}</p>
                  
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Features:</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {broker.features.slice(0, 3).map((feature, index) => (
                        <li key={index} className="flex items-center">
                          <span className="w-1 h-1 bg-indigo-500 rounded-full mr-2"></span>
                          {feature}
                        </li>
                      ))}
                      {broker.features.length > 3 && (
                        <li className="text-gray-500">+{broker.features.length - 3} more features</li>
                      )}
                    </ul>
                  </div>
                  
                  {broker.limitations && (
                    <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs text-orange-800 font-medium">{broker.limitations}</p>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleConnectBroker(broker.id)}
                    disabled={connectingBroker === broker.id}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200"
                  >
                    {connectingBroker === broker.id ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* TOTP Modal */}
      <TotpModal
        open={totpModalOpen}
        onClose={() => {
          setTotpModalOpen(false);
          setPendingTotp(false);
          setTotpModalError(undefined);
          setForceRefreshRequested(false);
        }}
        onSubmit={(totp, forceRefresh) => {
          setTotpSyncLoading(true);
          // Use the selected broker's platform for TOTP sync
          const platform = selectedBroker?.id === 'angelone' ? 'ANGEL_ONE' : undefined;
          handleSyncNow(platform, totp, forceRefresh);
        }}
        loading={totpSyncLoading}
        error={totpModalError}
        forceRefresh={forceRefreshRequested}
      />

      {/* Credential Modal */}
      <BrokerCredentialModal
        isOpen={credentialModalOpen}
        onClose={() => setCredentialModalOpen(false)}
        onSubmit={handleCredentialSubmit}
        title={selectedBroker ? `Connect to ${selectedBroker.name}` : 'Connect Broker'}
        loading={credentialLoading}
        error={credentialError}
        fields={credentialFields}
        helper={credentialHelper}
      />
    </div>
  )
} 