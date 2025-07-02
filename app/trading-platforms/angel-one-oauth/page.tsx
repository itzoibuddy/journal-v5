'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal"
];

export default function AngelOneOAuthPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<'loading' | 'form' | 'success'>('loading');
  const [showGuide, setShowGuide] = useState(false);
  const [credentials, setCredentials] = useState({
    apiKey: '',
    clientCode: '',
    password: '',
    totp: '',
    state: 'Maharashtra',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/signin');
    } else {
      setStep('form');
    }
  }, [session, status, router]);

  const handleConnect = async () => {
    if (!credentials.apiKey || !credentials.clientCode || !credentials.password || !credentials.totp || !credentials.state) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/trading-platforms/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'ANGEL_ONE',
          apiKey: credentials.apiKey,
          clientcode: credentials.clientCode,
          apiSecret: credentials.password,
          totp: credentials.totp,
          state: credentials.state
        })
      });
      const result = await response.json();
      if (response.ok) {
        setStep('success');
        setTimeout(() => {
          router.push('/brokers?success=angel_one_connected');
        }, 2000);
      } else {
        setError(result.error || 'Failed to connect. Please check your credentials.');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to Angel One...</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Successfully Connected!</h1>
          <p className="text-gray-600">Your Angel One account has been connected successfully.</p>
          <p className="text-sm text-gray-500 mt-2">Redirecting to brokers page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="max-w-4xl w-full mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">👼</div>
            <h1 className="text-2xl font-bold text-gray-900">Connect Angel One</h1>
            <p className="text-gray-600 mt-2">
              Enter your Angel One SmartAPI credentials to connect your account
            </p>
          </div>

          {/* Setup Guide Section */}
          <div className="mb-8">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-blue-900">How to get your API Key and set up TOTP</span>
              </div>
              <svg className={`h-5 w-5 text-blue-600 transition-transform ${showGuide ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showGuide && (
              <div className="mt-4 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-4">Step-by-Step Guide</h3>
                
                <div className="space-y-6">
                  {/* Step 1: API Key */}
                  <div>
                    <h4 className="font-medium text-blue-800 mb-2">Step 1: Get your SmartAPI API Key</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700 ml-4">
                      <li>Visit <a href="https://smartapi.angelbroking.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">smartapi.angelbroking.com</a></li>
                      <li>Click on "Login" and sign in with your Angel One credentials</li>
                      <li>Go to "My Apps" section in the dashboard</li>
                      <li>Click "Create New App" or use an existing app</li>
                      <li>Copy the "API Key" (it looks like: <code className="bg-blue-100 px-1 rounded">your_api_key_here</code>)</li>
                      <li>Note down your "Client Code" (your Angel One login ID)</li>
                    </ol>
                  </div>

                  {/* Step 2: TOTP Setup */}
                  <div>
                    <h4 className="font-medium text-blue-800 mb-2">Step 2: Enable TOTP (2FA)</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700 ml-4">
                      <li>Visit <a href="https://smartapi.angelbroking.com/enable-totp" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">smartapi.angelbroking.com/enable-totp</a></li>
                      <li>Log in with your Client Code and password</li>
                      <li>Click "Enable TOTP" or "Setup 2FA"</li>
                      <li>Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)</li>
                      <li>Enter the 6-digit code from your authenticator app to verify</li>
                      <li>Your TOTP is now enabled!</li>
                    </ol>
                  </div>

                  {/* Step 3: PIN */}
                  <div>
                    <h4 className="font-medium text-blue-800 mb-2">Step 3: Get your Trading PIN</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700 ml-4">
                      <li>Log in to your Angel One trading account</li>
                      <li>Go to Profile or Settings section</li>
                      <li>Look for "Trading PIN" or "Transaction PIN"</li>
                      <li>This is different from your login password</li>
                      <li>If you don't remember it, you may need to reset it</li>
                    </ol>
                  </div>

                  {/* Important Notes */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">⚠️ Important Notes:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                      <li>API Key is different from your Client Code</li>
                      <li>TOTP codes expire every 30 seconds - enter them quickly</li>
                      <li>Make sure your device time is synchronized with internet time</li>
                      <li>Use the same authenticator app you set up with Angel One</li>
                      <li>If TOTP doesn't work, try refreshing your authenticator app</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-800 font-medium">{error}</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SmartAPI API Key *</label>
              <input
                type="text"
                value={credentials.apiKey}
                onChange={e => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Enter your SmartAPI API Key (from smartapi.angelbroking.com)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Get this from smartapi.angelbroking.com → My Apps</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Client Code *</label>
              <input
                type="text"
                value={credentials.clientCode}
                onChange={e => setCredentials(prev => ({ ...prev, clientCode: e.target.value }))}
                placeholder="Enter your Angel One client code"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Your Angel One login ID (same as your client code)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trading PIN *</label>
              <input
                type="password"
                value={credentials.password}
                onChange={e => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Enter your Angel One trading PIN"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Your trading PIN (different from login password)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">TOTP Code *</label>
              <input
                type="text"
                value={credentials.totp}
                onChange={e => setCredentials(prev => ({ ...prev, totp: e.target.value }))}
                placeholder="Enter 6-digit TOTP code from your authenticator app"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">6-digit code from Google Authenticator, Authy, etc.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
              <select
                value={credentials.state}
                onChange={e => setCredentials(prev => ({ ...prev, state: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                {STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Select the state where your Angel One account is registered</p>
            </div>

            <button
              onClick={handleConnect}
              disabled={loading || !credentials.apiKey || !credentials.clientCode || !credentials.password || !credentials.totp || !credentials.state}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : 'Connect Account'}
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/brokers')}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              Cancel
            </button>
          </div>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Security Note</h3>
            <p className="text-sm text-blue-700">
              Your credentials are encrypted and stored securely. We only use them to authenticate with Angel One's API and never share them with third parties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 