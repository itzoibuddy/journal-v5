'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  className?: string;
}

export default function LoadingSpinner({
  size = 'md',
  message = 'Loading...',
  className = '',
}: LoadingSpinnerProps) {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-6 w-6 border-2';
      case 'md':
        return 'h-8 w-8 border-2';
      case 'lg':
        return 'h-12 w-12 border-3';
      case 'xl':
        return 'h-16 w-16 border-4';
      default:
        return 'h-8 w-8 border-2';
    }
  };

  return (
    <div 
      className={`flex items-center justify-center space-x-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className={`animate-spin rounded-full border-b-indigo-600 border-gray-200 ${getSizeClasses()}`}></div>
      {message && (
        <span className="text-gray-600 font-medium" aria-hidden="true">
          {message}
        </span>
      )}
      <span className="sr-only">{message}</span>
    </div>
  );
} 