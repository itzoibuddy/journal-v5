'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AngelOneSetupPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [credentials, setCredentials] = useState({
    apiKey: '',
    clientCode: '',
    password: '',
    totp: '',
    state: ''
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCredentialChange = (field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConnect = async () => {
    if (!credentials.apiKey || !credentials.clientCode || !credentials.password || !credentials.totp || !credentials.state) {
      setError('API Key, Client Code, PIN, TOTP and State are all required');
      return;
    }

    setIsConnecting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/trading-platforms/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'ANGEL_ONE',
          apiKey: credentials.apiKey,
          clientcode: credentials.clientCode,
          apiSecret: credentials.password, // Using apiSecret field for password
          totp: credentials.totp,
          state: credentials.state
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('Successfully connected to Angel One!');
        setTimeout(() => {
          router.push('/brokers?success=angel_one_connected');
        }, 2000);
      } else {
        setError(result.error || 'Failed to connect to Angel One');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const states = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
    'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal'
  ];

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to continue</h1>
          <p className="text-gray-600">You need to be signed in to connect your Angel One account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🕊️</div>
          <h1 className="text-2xl font-bold text-gray-900">Connect Angel One Account</h1>
          <p className="text-gray-600 mt-2">
            Enter your Angel One credentials to connect your trading account
          </p>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-800 font-medium">{success}</span>
            </div>
          </div>
        )}

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

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key *
            </label>
            <input
              type="text"
              value={credentials.apiKey}
              onChange={(e) => handleCredentialChange('apiKey', e.target.value)}
              placeholder="Enter your Angel One API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Your Angel One SmartAPI API key from smartapi.angelbroking.com
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Code *
            </label>
            <input
              type="text"
              value={credentials.clientCode}
              onChange={(e) => handleCredentialChange('clientCode', e.target.value)}
              placeholder="Enter your Angel One client code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Your Angel One login/client code (not API key)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PIN *
            </label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => handleCredentialChange('password', e.target.value)}
              placeholder="Enter your Angel One PIN"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Your Angel One trading PIN (not your login password)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              TOTP (Required) *
            </label>
            <input
              type="text"
              value={credentials.totp}
              onChange={(e) => handleCredentialChange('totp', e.target.value)}
              placeholder="Enter 6-digit TOTP code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Time-based One-Time Password. Enable TOTP at smartapi.angelbroking.com/enable-totp
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State *
            </label>
            <select
              value={credentials.state}
              onChange={(e) => handleCredentialChange('state', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Select your state</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Select the state where your Angel One account is registered
            </p>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              onClick={() => router.push('/trading-platforms')}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={isConnecting || !credentials.apiKey || !credentials.clientCode || !credentials.password || !credentials.totp || !credentials.state}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Connect Account'}
            </button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Security Note</h3>
          <p className="text-sm text-blue-700">
            Your credentials are encrypted and stored securely. We only use them to authenticate with Angel One's API and never share them with third parties.
          </p>
        </div>
      </div>
    </div>
  );
} 