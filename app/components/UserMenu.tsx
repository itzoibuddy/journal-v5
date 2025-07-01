'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function UserMenu() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscapeKey)
      }
    }
  }, [isOpen])

  if (!session) {
    return (
      <div className="flex items-center space-x-3">
        <Link
          href="/signin"
          className="px-4 py-2.5 rounded-xl text-gray-700 hover:text-indigo-600 font-semibold transition-all duration-300 hover:bg-white/60 hover:backdrop-blur-sm hover:shadow-lg border border-transparent hover:border-white/50"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-semibold hover:from-indigo-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-105"
        >
          Sign Up
        </Link>
      </div>
    )
  }

  const userInitial = session.user?.name?.charAt(0)?.toUpperCase() || 
                     session.user?.email?.charAt(0)?.toUpperCase() || 'U'
  const userName = session.user?.name || session.user?.email?.split('@')[0] || 'User'
  const userRole = (session.user as any)?.role || 'TRADER'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 px-4 py-2.5 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-white/80 transition-all duration-300 hover:shadow-lg shadow-md group"
      >
        {/* User Avatar */}
        <div className="relative">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-sm font-bold shadow-lg group-hover:shadow-indigo-500/30 transition-all duration-300">
            {userInitial}
          </div>
          {/* Online Status Indicator */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
        </div>
        
        {/* User Info */}
        <div className="hidden md:block text-left">
          <div className="text-sm font-semibold text-gray-900 leading-tight">{userName}</div>
          <div className="text-xs text-gray-500 font-medium">{userRole.toLowerCase()}</div>
        </div>
        
        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-3 w-64 bg-white/95 backdrop-blur-xl rounded-2xl border border-white/40 shadow-2xl shadow-black/10 z-50 overflow-hidden">
            
            {/* User Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200/50">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-lg">
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{session.user?.name}</p>
                  <p className="text-xs text-gray-600 truncate">{session.user?.email}</p>
                  <span className="inline-block mt-1.5 px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-xs font-semibold rounded-full shadow-sm">
                    {userRole}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <Link
                href="/profile"
                className="flex items-center px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 hover:text-indigo-600 transition-all duration-200 group"
                onClick={() => setIsOpen(false)}
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-indigo-100 transition-colors duration-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">Profile</div>
                  <div className="text-xs text-gray-500">Manage your account</div>
                </div>
              </Link>

              <Link
                href="/settings"
                className="flex items-center px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 hover:text-gray-800 transition-all duration-200 group"
                onClick={() => setIsOpen(false)}
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-gray-200 transition-colors duration-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">Settings</div>
                  <div className="text-xs text-gray-500">Preferences & more</div>
                </div>
              </Link>

              <Link
                href="/brokers"
                className="flex items-center px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 hover:text-orange-600 transition-all duration-200 group"
                onClick={() => setIsOpen(false)}
              >
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-orange-200 transition-colors duration-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">Brokers</div>
                  <div className="text-xs text-gray-500">Connect trading accounts</div>
                </div>
              </Link>

              {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
                <Link
                  href="/admin"
                  className="flex items-center px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:text-purple-600 transition-all duration-200 group"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-purple-200 transition-colors duration-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold">Admin Panel</div>
                    <div className="text-xs text-gray-500">System management</div>
                  </div>
                </Link>
              )}

              <div className="border-t border-gray-200/50 my-2"></div>

              <button
                onClick={() => {
                  setIsOpen(false)
                  signOut({ callbackUrl: '/' })
                }}
                className="flex items-center w-full px-5 py-3 text-sm font-medium text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:text-red-700 transition-all duration-200 group"
              >
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-red-200 transition-colors duration-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">Sign Out</div>
                  <div className="text-xs text-gray-500">End your session</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
