# Options Analyzer

A sophisticated options strategy analysis tool that helps traders evaluate risk and reward profiles for various options strategies. Built with React, TypeScript, tRPC, and PostgreSQL, integrated with Polygon.io (Massive) for real-time options market data.

![Options Analyzer](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

### Core Functionality
- **Real-time Options Data**: Integration with Polygon.io API for live options chain data
- **Stock Symbol Search**: Autocomplete search for stock tickers
- **Multiple Strategy Support**:
  - Long Call / Long Put
  - Short Call / Short Put
  - Bull Put Credit Spread
  - Bear Call Credit Spread

### Advanced Analytics
- **Profit/Loss Calculations**: Accurate P&L calculations at expiration
- **Break-even Analysis**: Automatic break-even point calculation
- **Risk Metrics**: Max profit, max loss, and return on risk
- **Probability Analysis**: Profit probability based on implied volatility
- **Interactive P&L Charts**: Visual representation of strategy performance

### User Features
- **Save Strategies**: Store favorite strategy configurations
- **Analysis History**: Track past analyses for quick reference
- **User Preferences**: Customizable display settings
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling
- **shadcn/ui** component library
- **Recharts** for data visualization
- **tRPC** for type-safe API calls
- **Wouter** for routing

### Backend
- **Express 4** server
- **tRPC 11** for API layer
- **Drizzle ORM** for database operations
- **PostgreSQL** database
- **Polygon.io API** for market data

## Prerequisites

- **Node.js** 22.x or higher
- **pnpm** 10.x or higher
- **PostgreSQL** 14.x or higher
- **Polygon.io API Key** (with Options subscription)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/schiang418/options-analyzer.git
cd options-analyzer
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/options_analyzer

# Polygon.io API
POLYGON_API_KEY=your_polygon_api_key_here

# Application
NODE_ENV=development
```

### 4. Run database migrations

```bash
pnpm db:push
```

### 5. Start the development server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

## Deployment

### Railway Deployment

This project is optimized for deployment on Railway with PostgreSQL.

1. **Create a Railway project** and connect your GitHub repository
2. **Add PostgreSQL database** service
3. **Set environment variables**:
   - `POLYGON_API_KEY` - Your Polygon.io API key
   - `DATABASE_URL` - Automatically provided by Railway PostgreSQL
4. **Run database migrations**:
   ```bash
   railway run pnpm db:push
   ```

For detailed deployment instructions, see [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

## Project Structure

```
options-analyzer/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   ├── lib/           # Utilities and tRPC client
│   │   └── index.css      # Global styles
│   └── public/            # Static assets
├── server/                # Backend Express + tRPC server
│   ├── _core/             # Core server infrastructure
│   ├── routers.ts         # tRPC router definitions
│   ├── db.ts              # Database query helpers
│   ├── polygonClient.ts   # Polygon.io API client
│   ├── strategyCalculator.ts  # Options strategy calculations
│   └── optionsRouter.ts   # Options-related API endpoints
├── drizzle/               # Database schema and migrations
│   └── schema.ts          # PostgreSQL table definitions
└── shared/                # Shared types and constants
```

## API Documentation

### Options Endpoints

#### Search Tickers
```typescript
trpc.options.searchTickers.useQuery({ query: "AAPL", limit: 10 })
```

#### Get Stock Price
```typescript
trpc.options.getStockPrice.useQuery({ ticker: "AAPL" })
```

#### Get Option Chain
```typescript
trpc.options.getOptionChain.useQuery({
  underlyingTicker: "AAPL",
  contractType: "call",
  expirationDate: "2024-03-15"
})
```

#### Calculate Strategy
```typescript
trpc.options.calculateStrategy.useQuery({
  strategyType: "bull_put_spread",
  currentPrice: 150,
  shortStrike: 145,
  shortPremium: 2.5,
  longStrike: 140,
  longPremium: 1.0,
  quantity: 1
})
```

## Strategy Calculations

### Bull Put Credit Spread
- **Structure**: Sell higher strike put + Buy lower strike put
- **Market Outlook**: Bullish (expect stock to stay above short put strike)
- **Max Profit**: Net credit received
- **Max Loss**: (Short strike - Long strike) × 100 - Net credit
- **Break-even**: Short strike - Net credit

### Bear Call Credit Spread
- **Structure**: Sell lower strike call + Buy higher strike call
- **Market Outlook**: Bearish (expect stock to stay below short call strike)
- **Max Profit**: Net credit received
- **Max Loss**: (Long strike - Short strike) × 100 - Net credit
- **Break-even**: Short strike + Net credit

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Polygon.io](https://polygon.io/) for market data API
- [OptionStrat](https://optionstrat.com/) for inspiration
- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components

## Support

For issues and questions:
- Open an issue on GitHub
- Check the [Railway Deployment Guide](./RAILWAY_DEPLOYMENT.md)
- Review [Polygon.io API Documentation](https://polygon.io/docs/)

## Disclaimer

This tool is for educational and informational purposes only. It should not be considered financial advice. Options trading involves substantial risk and is not suitable for every investor. Always conduct your own research and consult with a qualified financial advisor before making investment decisions.
