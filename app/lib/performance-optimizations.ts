// Performance Optimization Utilities for Trading Journal

/**
 * CRITICAL PERFORMANCE OPTIMIZATIONS FOR DAY TRADERS
 * 
 * Day traders need:
 * - Sub-second response times for trade entry/exit
 * - Real-time data updates without UI lag
 * - Smooth scrolling through large trade datasets
 * - Fast filtering and search capabilities
 */

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';

// 1. MEMOIZATION UTILITIES
export const createMemoizedFormatter = () => {
  const cache = new Map<string, string>();
  
  return (value: number, currency = 'INR'): string => {
    const key = `${value}-${currency}`;
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const formatted = value.toLocaleString('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    cache.set(key, formatted);
    return formatted;
  };
};

// 2. DEBOUNCED SEARCH HOOK
export const useDebounced = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// 3. VIRTUAL SCROLLING FOR LARGE DATASETS
export const useVirtualization = (items: any[], containerHeight: number, itemHeight: number) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  const visibleItems = items.slice(visibleStart, visibleEnd);
  
  return {
    visibleItems,
    visibleStart,
    totalHeight: items.length * itemHeight,
    offsetY: visibleStart * itemHeight,
    setScrollTop
  };
};

// 4. OPTIMIZED API CALLS
export class OptimizedAPIClient {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private pendingRequests = new Map<string, Promise<any>>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async get(url: string, options: RequestInit = {}): Promise<any> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Deduplicate concurrent requests
    if (this.pendingRequests.has(url)) {
      return this.pendingRequests.get(url);
    }

    // Make the request
    const request = fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Cache the result
      this.cache.set(url, { data, timestamp: Date.now() });
      this.pendingRequests.delete(url);
      return data;
    })
    .catch(error => {
      this.pendingRequests.delete(url);
      throw error;
    });

    this.pendingRequests.set(url, request);
    return request;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Cleanup old cache entries
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }
}

// 5. PERFORMANCE MONITORING HOOKS
export const useRenderCount = (componentName: string) => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`${componentName} rendered ${renderCount.current} times`);
  }
};

export const useWhyDidYouUpdate = (name: string, props: Record<string, any>) => {
  const previousProps = useRef<Record<string, any>>();
  
  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, { from: any; to: any }> = {};
      
      allKeys.forEach(key => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key]
          };
        }
      });
      
      if (Object.keys(changedProps).length && process.env.NODE_ENV === 'development') {
        console.log('[why-did-you-update]', name, changedProps);
      }
    }
    
    previousProps.current = props;
  });
};

// 6. INTERSECTION OBSERVER FOR LAZY LOADING
export const useIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
) => {
  const targetRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    
    const observer = new IntersectionObserver(callback, {
      threshold: 0.1,
      ...options
    });
    
    observer.observe(target);
    
    return () => {
      observer.unobserve(target);
    };
  }, [callback, options]);
  
  return targetRef;
};

// 7. OPTIMIZED TRADE FILTERING
export const createTradeFilter = () => {
  let cachedFilters: any = null;
  let cachedResult: any[] = [];
  
  return (trades: any[], filters: any) => {
    // Use shallow comparison for filters
    if (cachedFilters && JSON.stringify(cachedFilters) === JSON.stringify(filters)) {
      return cachedResult;
    }
    
    cachedFilters = filters;
    cachedResult = trades.filter(trade => {
      // Type filter
      if (filters.type && filters.type !== 'ALL' && trade.type !== filters.type) {
        return false;
      }
      
      // Status filter  
      if (filters.status === 'OPEN' && trade.exitPrice !== null) {
        return false;
      }
      if (filters.status === 'CLOSED' && trade.exitPrice === null) {
        return false;
      }
      
      // P&L filter
      if (filters.profitability === 'WINNING' && (trade.profitLoss || 0) <= 0) {
        return false;
      }
      if (filters.profitability === 'LOSING' && (trade.profitLoss || 0) >= 0) {
        return false;
      }
      
      // Search query
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          trade.symbol?.toLowerCase().includes(searchLower) ||
          trade.strategy?.toLowerCase().includes(searchLower) ||
          trade.notes?.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
    
    return cachedResult;
  };
};

// 8. BATCH UPDATE UTILITIES
export class BatchUpdater {
  private updates: (() => void)[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  
  add(updateFn: () => void): void {
    this.updates.push(updateFn);
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = setTimeout(() => {
      this.flush();
    }, 16); // Next frame
  }
  
  flush(): void {
    const updates = this.updates.splice(0);
    updates.forEach(update => update());
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

// 9. MEMORY CLEANUP
export const useMemoryCleanup = (cleanupFn: () => void, deps: any[] = []) => {
  useEffect(() => {
    return cleanupFn;
  }, deps);
};

// 10. PERFORMANCE CONSTANTS
export const PERFORMANCE_THRESHOLDS = {
  SLOW_RENDER: 16, // 16ms = 60fps
  SLOW_API: 1000, // 1 second
  CRITICAL_API: 5000, // 5 seconds
  MAX_ITEMS_PER_PAGE: 50,
  VIRTUAL_SCROLL_THRESHOLD: 100,
  DEBOUNCE_SEARCH: 300,
  CACHE_TTL: 5 * 60 * 1000 // 5 minutes
};

// Performance optimization recommendations
export const OPTIMIZATION_RECOMMENDATIONS = {
  database: [
    'Add indexes on userId, entryDate, symbol, profitLoss columns',
    'Use database-level pagination with LIMIT/OFFSET',
    'Implement read replicas for analytics queries',
    'Cache frequent aggregations (total P&L, win rate)',
    'Use connection pooling with proper limits'
  ],
  
  frontend: [
    'Implement React.memo for TradeRow components',
    'Use useMemo for expensive calculations',
    'Virtualize large trade lists (>100 items)',
    'Debounce search and filter inputs',
    'Lazy load heavy charts and analytics',
    'Use React.Suspense for code splitting'
  ],
  
  api: [
    'Implement response caching with Redis',
    'Use compression (gzip) for large responses',
    'Batch multiple operations into single requests',
    'Implement proper rate limiting',
    'Use WebSockets for real-time updates'
  ],
  
  realtime: [
    'WebSocket connection for live trade updates',
    'Server-sent events for notifications',
    'Optimistic UI updates for better UX',
    'Background sync for offline capability'
  ]
};

export default {
  createMemoizedFormatter,
  useDebounced,
  useVirtualization,
  OptimizedAPIClient,
  useRenderCount,
  useWhyDidYouUpdate,
  useIntersectionObserver,
  createTradeFilter,
  BatchUpdater,
  useMemoryCleanup,
  PERFORMANCE_THRESHOLDS,
  OPTIMIZATION_RECOMMENDATIONS
}; 