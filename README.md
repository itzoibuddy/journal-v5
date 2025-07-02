# Trading Journal 

A comprehensive, production-ready trading journal application for tracking and analyzing your trades.

## 🚀 Production Updates

This application has been updated with critical production-ready features:

### Security Enhancements
- ✅ API rate limiting (100 requests/minute)
- ✅ CORS configuration and security headers
- ✅ Input sanitization with DOMPurify
- ✅ Environment variable validation
- ✅ Centralized error handling

### Performance Improvements
- ✅ Fixed database connection pooling with singleton pattern
- ✅ Added pagination for all API endpoints (max 100 records per page)
- ✅ Database indexes for faster queries
- ✅ Optimized Docker build with health checks

### Infrastructure & Quality
- ✅ PostgreSQL configuration for production
- ✅ Health check endpoint with database connectivity test
- ✅ Jest test configuration with basic unit tests
- ✅ TypeScript strict mode
- ✅ Production-ready middleware

## Features

- **Trade Tracking**: Log your trades with detailed information including entry/exit prices, P&L, and more
- **Advanced Journal Features**: Record emotions, confidence levels, lessons learned, and trade setups
- **Calendar View**: Visualize your trading activity and P&L on a calendar
- **Analytics Dashboard**: View performance metrics and charts
- **Risk Management**: Track your risk-reward ratios and analyze your trading patterns

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: Prisma ORM with SQLite (development) or PostgreSQL (production)
- **Form Handling**: React Hook Form with Zod validation

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/trading-journal.git
   cd trading-journal
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/trading_journal"
   
   # Authentication
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here"
   
   # API Security
   ALLOWED_ORIGINS="http://localhost:3000"
   
   # Optional: Broker Integrations
   ZERODHA_CLIENT_ID="your-zerodha-api-key"
   ZERODHA_CLIENT_SECRET="your-zerodha-api-secret"
   UPSTOX_CLIENT_ID="your-upstox-client-id"
   UPSTOX_CLIENT_SECRET="your-upstox-client-secret"
   ```

4. Set up the database
   ```bash
   npx prisma migrate dev
   ```

5. Start the development server
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Broker Integration Setup

For detailed instructions on setting up broker integrations (Zerodha, Upstox, Angel One, etc.), see [BROKER_SETUP.md](./BROKER_SETUP.md).

## Database Configuration

The application is configured to use PostgreSQL by default. The schema includes:
- Optimized indexes for query performance
- Support for options and futures trading
- Comprehensive trade tracking fields

To switch between databases:
- **PostgreSQL** (recommended for production): Set `DATABASE_URL` in your `.env` file
- **SQLite** (for local development only): Update `prisma/schema.prisma` datasource

## Production Deployment

### Build for Production

```bash
# Install production dependencies
npm ci --production

# Run database migrations
npm run db:migrate

# Build the application
npm run build:prod
```

### Start the Production Server

```bash
npm run start:prod
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Deployment Options

- **Netlify**: Connect your GitHub repository for automatic deployments
- **Docker**: A Dockerfile is provided for containerized deployments
- **Traditional Hosting**: Deploy the built application to any Node.js hosting service

## Project Maintenance

### Cleaning Build Artifacts

To keep your project directory size manageable, you can clean up build artifacts:

```bash
# Clean the Next.js build directory
npm run clean
```

For a more thorough cleanup before deployment or committing to version control:

```bash
# Remove node_modules (will need to run npm install again after)
rm -rf node_modules
npm run clean
```

This helps reduce the project size significantly when sharing or deploying.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Next.js, Prisma, and TailwindCSS
- Chart visualizations powered by Chart.js

# Updated for deployment