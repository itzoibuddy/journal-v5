'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function UpstoxTestPage() {
  const { data: session } = useSession();
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testUpstoxConnection = async () => {
    setLoading(true);
    setError(null);
    setTestResult(null);

    try {
      const response = await fetch('/api/trading-platforms/test-upstox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const checkEnvironment = () => {
    const env = {
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      hasUpstoxClientId: !!process.env.UPSTOX_CLIENT_ID,
      hasUpstoxClientSecret: !!process.env.UPSTOX_CLIENT_SECRET,
      hasUpstoxApiKey: !!process.env.UPSTOX_API_KEY,
      hasUpstoxApiSecret: !!process.env.UPSTOX_API_SECRET,
    };

    return env;
  };

  const env = checkEnvironment();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Upstox Connection Diagnostic Tool
          </h1>

          {!session ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
              <p className="text-yellow-800">
                Please log in to test your Upstox connection.
              </p>
            </div>
          ) : (
            <>
              {/* Environment Check */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Environment Variables Check
                </h2>
                <div className="bg-gray-50 rounded-md p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">NEXTAUTH_URL:</span>
                      <span className={`ml-2 ${env.hasNextAuthUrl ? 'text-green-600' : 'text-red-600'}`}>
                        {env.hasNextAuthUrl ? '✓ Set' : '✗ Missing'}
                      </span>
                      {env.hasNextAuthUrl && (
                        <div className="text-sm text-gray-600 mt-1">{env.nextAuthUrl}</div>
                      )}
                    </div>
                    <div>
                      <span className="font-medium">UPSTOX_CLIENT_ID:</span>
                      <span className={`ml-2 ${env.hasUpstoxClientId ? 'text-green-600' : 'text-red-600'}`}>
                        {env.hasUpstoxClientId ? '✓ Set' : '✗ Missing'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">UPSTOX_CLIENT_SECRET:</span>
                      <span className={`ml-2 ${env.hasUpstoxClientSecret ? 'text-green-600' : 'text-red-600'}`}>
                        {env.hasUpstoxClientSecret ? '✓ Set' : '✗ Missing'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">UPSTOX_API_KEY:</span>
                      <span className={`ml-2 ${env.hasUpstoxApiKey ? 'text-green-600' : 'text-red-600'}`}>
                        {env.hasUpstoxApiKey ? '✓ Set' : '✗ Missing'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">UPSTOX_API_SECRET:</span>
                      <span className={`ml-2 ${env.hasUpstoxApiSecret ? 'text-green-600' : 'text-red-600'}`}>
                        {env.hasUpstoxApiSecret ? '✓ Set' : '✗ Missing'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="mb-6">
                <button
                  onClick={testUpstoxConnection}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  {loading ? 'Testing Connection...' : 'Test Upstox Connection'}
                </button>
              </div>

              {/* Test Results */}
              {testResult && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    Test Results
                  </h2>
                  <div className="bg-gray-50 rounded-md p-4">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    Error
                  </h2>
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-red-800">{error}</p>
                  </div>
                </div>
              )}

              {/* Troubleshooting Guide */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Common Issues & Solutions
                </h2>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h3 className="font-medium text-blue-900 mb-2">404 Not Found Error</h3>
                    <p className="text-blue-800 text-sm mb-2">
                      This usually means your Upstox account needs reactivation or you don't have trading history.
                    </p>
                    <ul className="text-blue-800 text-sm list-disc list-inside space-y-1">
                      <li>Log into your Upstox account and check if it's active</li>
                      <li>Complete any pending KYC verification</li>
                      <li>Enable API access in your account settings</li>
                      <li>Make sure you have trading history in the date range</li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <h3 className="font-medium text-yellow-900 mb-2">401 Unauthorized Error</h3>
                    <p className="text-yellow-800 text-sm mb-2">
                      Your access token has expired or is invalid.
                    </p>
                    <ul className="text-yellow-800 text-sm list-disc list-inside space-y-1">
                      <li>Reconnect your Upstox account through the OAuth flow</li>
                      <li>Check if your Upstox app credentials are correct</li>
                      <li>Verify the redirect URI in your Upstox app settings</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <h3 className="font-medium text-green-900 mb-2">No Trades Found</h3>
                    <p className="text-green-800 text-sm mb-2">
                      This is normal if you haven't made any trades in the selected date range.
                    </p>
                    <ul className="text-green-800 text-sm list-disc list-inside space-y-1">
                      <li>Try syncing with a larger date range</li>
                      <li>Check if you have any trading history in your Upstox account</li>
                      <li>Verify the date range you're syncing</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* OAuth Test */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  OAuth Flow Test
                </h2>
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-gray-700 mb-3">
                    Test the OAuth flow to ensure your Upstox app is configured correctly:
                  </p>
                  <a
                    href="/api/auth/upstox"
                    className="inline-block bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    Test Upstox OAuth
                  </a>
                  <p className="text-sm text-gray-600 mt-2">
                    This will redirect you to Upstox login. Make sure your redirect URI is set to: <code className="bg-gray-200 px-1 rounded">http://localhost:3000/api/auth/upstox/callback</code>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 