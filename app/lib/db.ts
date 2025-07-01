import { PrismaClient } from '@prisma/client';
import { performanceMonitor } from './performance';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = global as unknown as { 
  prisma: PrismaClient;
  userCache: Map<string, { user: any; timestamp: number }>;
};

// User cache for frequently accessed user data (10 minute TTL)
const USER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
export const userCache = globalForPrisma.userCache || new Map();
if (process.env.NODE_ENV !== 'production') globalForPrisma.userCache = userCache;

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 100, // 100ms base delay
  maxDelay: 1000, // 1s max delay
};

// Exponential backoff retry utility
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  retries = RETRY_CONFIG.maxRetries
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && isRetryableError(error)) {
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, RETRY_CONFIG.maxRetries - retries),
        RETRY_CONFIG.maxDelay
      );
      
      console.warn(`Database operation failed for ${context}, retrying in ${delay}ms... (${retries} retries left)`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, context, retries - 1);
    }
    throw error;
  }
}

// Check if error is retryable
function isRetryableError(error: any): boolean {
  const retryableErrors = [
    'P1001', // Can't reach database server
    'P1002', // The database server was reached but timed out
    'P1003', // Database does not exist
    'P1008', // Operations timed out
    'P1017', // Server has closed the connection
  ];
  
  return retryableErrors.some(code => error.code === code) ||
         error.message?.includes('Connection refused') ||
         error.message?.includes('timeout') ||
         error.message?.includes('ECONNRESET');
}

// Configure Prisma client with production optimizations
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        const operationName = `db:${model}.${operation}`;
        
        return performanceMonitor.measureAsync(operationName, async () => {
          return withRetry(
            () => query(args),
            `${model}.${operation}`,
            RETRY_CONFIG.maxRetries
          );
        });
      },
    },
  });
};

export const prisma = globalForPrisma.prisma || prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Enhanced user cache utilities
export async function getCachedUser(email: string) {
  const cacheKey = `user:${email}`;
  const cached = userCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.user;
  }
  
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      image: true,
    },
  });
  
  if (user) {
    userCache.set(cacheKey, { user, timestamp: Date.now() });
  }
  
  return user;
}

export function invalidateUserCache(email: string) {
  const cacheKey = `user:${email}`;
  userCache.delete(cacheKey);
}

export function clearUserCache() {
  userCache.clear();
}

// Graceful shutdown handling with improved signal handling
if (typeof window === 'undefined') {
  // Set max listeners to prevent memory leak warnings
  process.setMaxListeners(15);
  
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}. Gracefully shutting down...`);
    try {
      await prisma.$disconnect();
      console.log('Database connections closed.');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };
  
  // Use 'once' to prevent multiple listeners
  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon
}

// Health check utility
export async function checkDatabaseHealth(): Promise<{ connected: boolean; responseTime: number }> {
  const startTime = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = performance.now() - startTime;
    return { connected: true, responseTime };
  } catch (error) {
    const responseTime = performance.now() - startTime;
    console.error('Database health check failed:', error);
    return { connected: false, responseTime };
  }
} 