'use client';

import { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
}

interface GlobalToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// Global Toast Manager Component
export function GlobalToastManager() {
  const [toast, setToast] = useState<GlobalToastState>({
    show: false,
    message: '',
    type: 'info'
  });

  useEffect(() => {
    const handleToastEvent = (event: CustomEvent) => {
      const { message, type } = event.detail;
      setToast({
        show: true,
        message,
        type: type || 'info'
      });

      // Auto-hide after 5 seconds
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 5000);
    };

    window.addEventListener('showToast', handleToastEvent as EventListener);

    return () => {
      window.removeEventListener('showToast', handleToastEvent as EventListener);
    };
  }, []);

  if (!toast.show) return null;

  return (
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={() => setToast(prev => ({ ...prev, show: false }))}
    />
  );
}

export default function Toast({ message, type, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 border-green-600';
      case 'error':
        return 'bg-red-500 border-red-600';
      case 'warning':
        return 'bg-yellow-500 border-yellow-600';
      case 'info':
      default:
        return 'bg-blue-500 border-blue-600';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const bgColor = getToastStyle();
  const icon = getIcon();

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 animate-fade-in-up"
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg border-l-4 flex items-center min-w-[300px] max-w-[500px]`}>
        <div className="mr-3 text-xl" aria-hidden="true">{icon}</div>
        <div className="flex-1">
          <p className="font-medium">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            if (onClose) onClose();
          }}
          className="ml-4 text-white hover:text-gray-200 transition-colors"
          aria-label="Close notification"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastProps['type'] } | null>(null);

  const showToast = (message: string, type: ToastProps['type']) => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  return {
    toast,
    showToast,
    hideToast,
  };
} 