// Performance monitoring and optimization utilities

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PerformanceEntry {
  id: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private entries: Map<string, PerformanceEntry> = new Map();
  private slowOperations: PerformanceMetric[] = [];
  private readonly SLOW_THRESHOLD = 1000; // 1 second

  // Start timing an operation
  startTiming(id: string, operation: string, metadata?: Record<string, any>): void {
    const entry: PerformanceEntry = {
      id,
      operation,
      startTime: performance.now(),
      success: false,
      metadata
    };
    this.entries.set(id, entry);
  }

  // End timing an operation
  endTiming(id: string, success: boolean = true, error?: string): number | null {
    const entry = this.entries.get(id);
    if (!entry) {
      console.warn(`Performance entry not found for id: ${id}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - entry.startTime;

    entry.endTime = endTime;
    entry.duration = duration;
    entry.success = success;
    entry.error = error;

    // Store the metric
    const metric: PerformanceMetric = {
      name: entry.operation,
      duration,
      timestamp: Date.now(),
      metadata: entry.metadata
    };

    this.metrics.push(metric);

    // Track slow operations
    if (duration > this.SLOW_THRESHOLD) {
      this.slowOperations.push(metric);
      console.warn(`Slow operation detected: ${entry.operation} took ${duration.toFixed(2)}ms`);
    }

    // Clean up
    this.entries.delete(id);

    return duration;
  }

  // Measure a function execution
  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const id = `${operation}-${Date.now()}-${Math.random()}`;
    this.startTiming(id, operation, metadata);

    try {
      const result = await fn();
      this.endTiming(id, true);
      return result;
    } catch (error) {
      this.endTiming(id, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Measure a synchronous function execution
  measure<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const id = `${operation}-${Date.now()}-${Math.random()}`;
    this.startTiming(id, operation, metadata);

    try {
      const result = fn();
      this.endTiming(id, true);
      return result;
    } catch (error) {
      this.endTiming(id, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Get performance statistics
  getStats() {
    const totalMetrics = this.metrics.length;
    const avgDuration = totalMetrics > 0 
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalMetrics 
      : 0;

    const operationStats: Record<string, { count: number; avgDuration: number; minDuration: number; maxDuration: number }> = {};

    this.metrics.forEach(metric => {
      if (!operationStats[metric.name]) {
        operationStats[metric.name] = {
          count: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0
        };
      }

      const stat = operationStats[metric.name];
      stat.count++;
      stat.minDuration = Math.min(stat.minDuration, metric.duration);
      stat.maxDuration = Math.max(stat.maxDuration, metric.duration);
    });

    // Calculate averages
    Object.keys(operationStats).forEach(operation => {
      const stat = operationStats[operation];
      const operationMetrics = this.metrics.filter(m => m.name === operation);
      stat.avgDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0) / stat.count;
    });

    return {
      totalOperations: totalMetrics,
      averageDuration: avgDuration,
      slowOperationsCount: this.slowOperations.length,
      operationStats,
      slowestOperations: [...this.slowOperations]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10),
      recentMetrics: this.metrics.slice(-20)
    };
  }

  // Clear old metrics (keep last 1000)
  cleanup(): void {
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
    if (this.slowOperations.length > 100) {
      this.slowOperations = this.slowOperations.slice(-100);
    }
  }

  // Get health status
  getHealthStatus() {
    const stats = this.getStats();
    const recentMetrics = this.metrics.slice(-10);
    const recentAvg = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length 
      : 0;

    const health = {
      status: 'healthy' as 'healthy' | 'warning' | 'critical',
      score: 100,
      issues: [] as string[],
      recommendations: [] as string[]
    };

    // Check average response time
    if (recentAvg > 2000) {
      health.status = 'critical';
      health.score -= 50;
      health.issues.push('Very slow average response time');
      health.recommendations.push('Investigate database queries and API performance');
    } else if (recentAvg > 1000) {
      health.status = 'warning';
      health.score -= 25;
      health.issues.push('Slow average response time');
      health.recommendations.push('Consider optimizing slow operations');
    }

    // Check slow operations ratio
    const slowRatio = stats.totalOperations > 0 ? stats.slowOperationsCount / stats.totalOperations : 0;
    if (slowRatio > 0.3) {
      health.status = 'critical';
      health.score -= 30;
      health.issues.push('High ratio of slow operations');
      health.recommendations.push('Review and optimize frequently slow operations');
    } else if (slowRatio > 0.1) {
      if (health.status === 'healthy') health.status = 'warning';
      health.score -= 15;
      health.issues.push('Some slow operations detected');
      health.recommendations.push('Monitor and optimize slow operations');
    }

    return health;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions for common use cases
export const measureDatabaseQuery = async <T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  return performanceMonitor.measureAsync(`db:${queryName}`, queryFn);
};

export const measureApiCall = async <T>(
  apiName: string,
  apiFn: () => Promise<T>
): Promise<T> => {
  return performanceMonitor.measureAsync(`api:${apiName}`, apiFn);
};

export const measureComponentRender = <T>(
  componentName: string,
  renderFn: () => T
): T => {
  return performanceMonitor.measure(`render:${componentName}`, renderFn);
};

// Performance decorator for class methods
export function performanceDecorator(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      if (originalMethod.constructor.name === 'AsyncFunction') {
        return performanceMonitor.measureAsync(operation, () => originalMethod.apply(this, args));
      } else {
        return performanceMonitor.measure(operation, () => originalMethod.apply(this, args));
      }
    };

    return descriptor;
  };
}

// Cleanup function to be called periodically
export const cleanupPerformanceData = () => {
  performanceMonitor.cleanup();
};

// Auto cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(cleanupPerformanceData, 5 * 60 * 1000);
} 