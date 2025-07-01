'use client';

import { useState } from 'react';

export default function UpdateAngelOneTrades() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setMessage(null);

    try {
      const response = await fetch('/api/trading-platforms/update-angel-one-trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: result.message || 'Trades updated successfully!'
        });
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to update trades'
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Network error. Please try again.'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Update Angel One Trades
      </h3>
      
      <p className="text-gray-600 mb-4">
        This will update your existing Angel One trades with the correct P&L calculations by re-fetching and pairing BUY/SELL trades.
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <button
        onClick={handleUpdate}
        disabled={isUpdating}
        className={`px-4 py-2 rounded-md font-medium transition-colors ${
          isUpdating
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isUpdating ? 'Updating...' : 'Update Angel One Trades'}
      </button>
    </div>
  );
} 