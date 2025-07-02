/**
 * Environment variable validation
 * This file validates all required environment variables at startup
 */

export const validateEnv = () => {
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      `Please check your .env file or environment configuration.`
    );
  }

  // Validate DATABASE_URL format
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    console.warn(
      'WARNING: DATABASE_URL should start with postgresql:// or postgres:// for production use. ' +
      'SQLite is not recommended for production.'
    );
  }

  // Check for optional broker configurations
  const optionalBrokerVars = {
    'ZERODHA_CLIENT_ID': 'Zerodha API Key (for Zerodha integration)',
    'ZERODHA_CLIENT_SECRET': 'Zerodha API Secret (for Zerodha integration)',
    'UPSTOX_CLIENT_ID': 'Upstox Client ID (for Upstox integration)',
    'UPSTOX_CLIENT_SECRET': 'Upstox Client Secret (for Upstox integration)',
    'DHAN_CLIENT_ID': 'Dhan Client ID (for Dhan integration)',
    'DHAN_CLIENT_SECRET': 'Dhan Client Secret (for Dhan integration)',
  };

  const missingBrokerVars = Object.entries(optionalBrokerVars)
    .filter(([varName]) => !process.env[varName])
    .map(([varName, description]) => `${varName} - ${description}`);

  if (missingBrokerVars.length > 0) {
    console.warn(
      'WARNING: Some broker integrations are not configured:\n' +
      missingBrokerVars.map(v => `  - ${v}`).join('\n') + '\n' +
      'These integrations will not be available until configured.'
    );
  }

  return {
    databaseUrl: process.env.DATABASE_URL!,
    nextAuthSecret: process.env.NEXTAUTH_SECRET!,
    nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
    // Broker configurations
    zerodha: {
      clientId: process.env.ZERODHA_CLIENT_ID,
      clientSecret: process.env.ZERODHA_CLIENT_SECRET,
    },
    upstox: {
      clientId: process.env.UPSTOX_CLIENT_ID,
      clientSecret: process.env.UPSTOX_CLIENT_SECRET,
    },
    dhan: {
      clientId: process.env.DHAN_CLIENT_ID,
      clientSecret: process.env.DHAN_CLIENT_SECRET,
    },
    // Helper function to get redirect URI
    getRedirectUri: (broker: string) => {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return `${baseUrl}/api/auth/${broker}/callback`;
    }
  };
};

// Validate environment variables on module load
if (typeof window === 'undefined') {
  try {
    validateEnv();
  } catch (error) {
    console.error('Environment validation failed:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
} 