import { NextResponse } from 'next/server';
import { performanceMonitor } from '../../lib/performance';
import { prisma } from '../../lib/db';

export async function GET() {
  try {
    // Get performance statistics from the monitor
    const performanceStats = performanceMonitor.getStats();
    const healthStatus = performanceMonitor.getHealthStatus();

    // Test database connectivity and performance
    const dbStartTime = performance.now();
    let dbConnected = false;
    let dbResponseTime = 0;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
      dbResponseTime = performance.now() - dbStartTime;
    } catch (error) {
      console.error('Database connectivity test failed:', error);
      dbResponseTime = performance.now() - dbStartTime;
    }

    // System health indicators
    const healthData = {
      status: healthStatus.status,
      score: healthStatus.score,
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        responseTime: Math.round(dbResponseTime * 100) / 100,
        status: dbConnected ? (dbResponseTime < 100 ? 'excellent' : dbResponseTime < 500 ? 'good' : 'slow') : 'error'
      },
      performance: {
        totalOperations: performanceStats.totalOperations,
        averageResponseTime: Math.round(performanceStats.averageDuration * 100) / 100,
        slowOperations: performanceStats.slowOperationsCount,
        slowOperationRatio: performanceStats.totalOperations > 0 
          ? Math.round((performanceStats.slowOperationsCount / performanceStats.totalOperations) * 10000) / 100
          : 0
      },
      issues: healthStatus.issues,
      recommendations: healthStatus.recommendations,
      slowestOperations: performanceStats.slowestOperations.map(op => ({
        name: op.name,
        duration: Math.round(op.duration * 100) / 100,
        timestamp: new Date(op.timestamp).toISOString()
      })),
      recentActivity: performanceStats.recentMetrics.map(metric => ({
        operation: metric.name,
        duration: Math.round(metric.duration * 100) / 100,
        timestamp: new Date(metric.timestamp).toISOString()
      })),
      operationBreakdown: Object.entries(performanceStats.operationStats).map(([name, stats]) => ({
        operation: name,
        count: stats.count,
        avgDuration: Math.round(stats.avgDuration * 100) / 100,
        minDuration: Math.round(stats.minDuration * 100) / 100,
        maxDuration: Math.round(stats.maxDuration * 100) / 100
      }))
    };

    return NextResponse.json(healthData);

  } catch (error) {
    console.error('Performance API error:', error);
    return NextResponse.json(
      {
        status: 'error',
        score: 0,
        timestamp: new Date().toISOString(),
        error: 'Failed to retrieve performance data',
        database: {
          connected: false,
          responseTime: 0,
          status: 'error'
        },
        performance: {
          totalOperations: 0,
          averageResponseTime: 0,
          slowOperations: 0,
          slowOperationRatio: 0
        },
        issues: ['Failed to retrieve performance data'],
        recommendations: ['Check system health and database connectivity']
      },
      { status: 500 }
    );
  }
} 