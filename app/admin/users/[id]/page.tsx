'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'

interface Trade {
  id: number
  symbol: string
  quantity: number
  entryPrice: number
  exitPrice: number | null
  entryDate: string
  exitDate: string | null
  profitLoss: number | null
  isDemo: boolean
  type: string
  strategy: string | null
}

interface UserStats {
  totalTrades: number
  completedTrades: number
  winningTrades: number
  totalPnL: number
  winRate: number
}

interface UserDetail {
  id: string
  name: string | null
  email: string
  mobile: string | null
  role: string
  status: string
  createdAt: string
  lastLoginAt: string | null
  _count: {
    trades: number
  }
  trades: Trade[]
  stats: UserStats
}

export default function UserDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [tempPasswordModal, setTempPasswordModal] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [passwordResetModal, setPasswordResetModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    
    if (status === 'unauthenticated') {
      router.push('/signin')
    } else if (session?.user) {
      const userRole = (session.user as any).role
      if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        router.push('/')
      } else {
        fetchUserDetails()
      }
    }
  }, [session, status, router, params.id])

  const fetchUserDetails = async () => {
    try {
      const response = await fetch(`/api/admin/users/${params.id}`)
      
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        setMessage({ type: 'error', text: errorData.error || 'Failed to fetch user details' })
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
      setMessage({ type: 'error', text: 'Failed to fetch user details' })
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (newRole: string) => {
    if (!user) return
    
    try {
      const response = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'User role updated successfully' })
        fetchUserDetails()
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to update role' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  const handleStatusToggle = async () => {
    if (!user) return
    
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    
    try {
      const response = await fetch(`/api/admin/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: `User ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'} successfully` })
        fetchUserDetails()
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to update status' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  const handleGenerateTempPassword = async () => {
    if (!user) return
    
    try {
      const response = await fetch(`/api/admin/users/${user.id}/generate-temp-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedPassword(data.temporaryPassword)
        setTempPasswordModal(true)
        setMessage({ type: 'success', text: 'Temporary password generated successfully' })
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to generate temporary password' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  const handlePasswordReset = async () => {
    if (!user || !newPassword) return
    
    try {
      const response = await fetch(`/api/admin/users/${user.id}/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Password reset successfully' })
        setPasswordResetModal(false)
        setNewPassword('')
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to reset password' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">User Not Found</h1>
          <button
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Users
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">User Details</h1>
              <p className="text-gray-600 mt-1">Manage user information and settings</p>
            </div>
            <button
              onClick={() => router.push('/admin/users')}
              className="px-4 py-2 bg-white/80 backdrop-blur-sm text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-white/90 transition-all duration-200"
            >
              Back to Users
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* User Information Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {user.name || 'Unnamed User'}
              </h2>
              <p className="text-gray-600 mb-4">{user.email}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number
                  </label>
                  <p className="text-gray-900">
                    {user.mobile ? `+91 ${user.mobile}` : 'Not provided'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Member Since
                  </label>
                  <p className="text-gray-900">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Login
                  </label>
                  <p className="text-gray-900">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User ID
                  </label>
                  <p className="text-gray-900 font-mono text-sm">{user.id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Role and Status Management */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Management</h3>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={(session?.user as any)?.role !== 'SUPER_ADMIN' && user.role === 'SUPER_ADMIN'}
                >
                  <option value="TRADER">Trader</option>
                  <option value="ADMIN">Admin</option>
                  {(session?.user as any)?.role === 'SUPER_ADMIN' && (
                    <option value="SUPER_ADMIN">Super Admin</option>
                  )}
                </select>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <button
                  onClick={handleStatusToggle}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                    user.status === 'ACTIVE' 
                      ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                      : 'bg-red-100 text-red-800 hover:bg-red-200'
                  }`}
                >
                  {user.status} - Click to {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                </button>
              </div>
            </div>

            {/* Password Management */}
            <div className="border-t pt-4">
              <h4 className="text-md font-semibold text-gray-900 mb-3">🔐 Password Management</h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Security Notice</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>For security reasons, user passwords cannot be retrieved from the database. They are securely hashed and cannot be reversed. Use the options below to help users with password issues.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleGenerateTempPassword}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Generate Temporary Password
                </button>
                <button
                  onClick={() => setPasswordResetModal(true)}
                  className="px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Set Custom Password
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Trading Statistics */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trading Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{user.stats.totalTrades}</p>
              <p className="text-sm text-gray-600">Total Trades</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{user.stats.completedTrades}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{user.stats.winningTrades}</p>
              <p className="text-sm text-gray-600">Winning</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${user.stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{user.stats.totalPnL.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">Total P&L</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{user.stats.winRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Win Rate</p>
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Trades (Last 20)</h3>
          </div>
          
          {user.trades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entry Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exit Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P&L
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Demo
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {user.trades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{trade.symbol}</div>
                        {trade.strategy && (
                          <div className="text-xs text-gray-500">{trade.strategy}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          trade.type === 'BUY' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {trade.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{trade.entryPrice.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.exitPrice ? `₹${trade.exitPrice.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {trade.profitLoss !== null ? (
                          <span className={trade.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                            ₹{trade.profitLoss.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(trade.entryDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {trade.isDemo ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Demo
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            Live
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              No trades found for this user.
            </div>
          )}
        </div>

        {/* Temporary Password Modal */}
        {tempPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🔑 Temporary Password Generated</h3>
              <div className="bg-gray-50 border rounded-lg p-4 mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temporary Password for {user.email}:
                </label>
                <div className="bg-white border rounded px-3 py-2 font-mono text-lg">
                  {generatedPassword}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedPassword)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  📋 Copy to Clipboard
                </button>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800">
                  ⚠️ <strong>Important:</strong> Share this password securely with the user. 
                  They should change it immediately after logging in.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setTempPasswordModal(false)
                    setGeneratedPassword('')
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Reset Modal */}
        {passwordResetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🔐 Set Custom Password</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password for {user.email}:
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter new password (min 6 characters)"
                  minLength={6}
                />
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">
                  ⚠️ <strong>Security Warning:</strong> This will immediately change the user's password. 
                  Make sure to inform them about the new password securely.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setPasswordResetModal(false)
                    setNewPassword('')
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordReset}
                  disabled={newPassword.length < 6}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 