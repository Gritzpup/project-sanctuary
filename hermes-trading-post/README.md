# Hermes Trading Post

A full-stack algorithmic cryptocurrency trading platform with real-time charting, paper trading simulation, and comprehensive backtesting capabilities.

## Overview

Hermes Trading Post is a sophisticated trading platform built for Bitcoin (BTC-USD) cryptocurrency trading. It combines advanced grid trading algorithms with interactive real-time visualization, allowing traders to execute, test, and analyze trading strategies before deploying live capital.

**Key Features:**
- **Live Trading Dashboard**: Real-time market data with interactive price charts powered by Lightweight Charts
- **Paper Trading Engine**: Risk-free strategy testing with simulated balance and realistic trade execution
- **Advanced Backtesting**: Historical simulation with configurable parameters and detailed profit/loss analysis
- **Grid Trading Strategies**: Multiple grid-based trading algorithms optimized for volatile markets
- **Real-time Volume Analysis**: Synchronized volume candles with price action
- **Trade History & Analytics**: Comprehensive trade logging with profit calculations and performance metrics
- **Audio Notifications**: Profit alerts via system audio driver
- **Redis Caching**: High-performance candle data storage for fast chart rendering

## Tech Stack

**Frontend:**
- [Svelte 5](https://svelte.dev) - Reactive component framework
- [TypeScript](https://www.typescriptlang.org) - Type-safe JavaScript
- [Vite](https://vitejs.dev) - Lightning-fast build tool
- [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) - Professional charting library
- [Svelte Routing](https://github.com/navaid-a/svelte-routing) - Client-side routing

**Backend:**
- [Node.js](https://nodejs.org) - JavaScript runtime
- [Express.js](https://expressjs.com) - Web server framework
- [Redis](https://redis.io) - In-memory data store for candle caching
- [Coinbase Advanced API](https://docs.cloud.coinbase.com/advanced-trade/reference) - Market data and trading

**Architecture:**
- Modular component-based frontend with state management via Svelte stores
- RESTful API backend with service-oriented architecture
- Real-time WebSocket streaming for price updates
- Redis-backed caching layer for performance optimization

## Project Structure

```
hermes-trading-post/
├── src/                          # Frontend source code
│   ├── pages/                    # Page components (Trading, Backtesting, Paper Trading)
│   ├── components/               # Reusable UI components
│   │   ├── backtesting/         # Backtesting UI (chart, controls, results)
│   │   ├── trading/             # Live trading UI (chart, order controls)
│   │   └── layout/              # Layout components (sidebar, headers)
│   ├── services/                 # Frontend services (API calls, state management)
│   ├── strategies/               # Trading strategy definitions
│   ├── stores/                   # Svelte reactive stores
│   └── types/                    # TypeScript type definitions
├── backend/                       # Backend source code
│   ├── src/
│   │   ├── routes/              # API endpoints (trading, backtesting)
│   │   ├── services/            # Business logic (trading, data, position management)
│   │   ├── strategies/          # Strategy implementations
│   │   ├── utils/               # Utilities (sound player, helpers)
│   │   └── config/              # Configuration files
│   └── package.json
├── docs/                         # Documentation
├── tools/                        # Utility scripts
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Redis server running locally
- Coinbase Advanced API credentials (for live trading)
- Ubuntu/Linux system (for system audio support)

### Installation

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Configure environment variables:**
   Create `.env` in the backend directory:
   ```
   COINBASE_API_KEY=your_api_key
   COINBASE_API_SECRET=your_api_secret
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```
   This starts both frontend (port 5173) and backend (port 3000) in concurrent mode.

4. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000/api

## Development

### Available Scripts

```bash
# Start development servers (frontend + backend)
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Type checking
npm run check

# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend
```

### Backtesting Features

- **Historical Data**: Load candle data from Coinbase API with configurable granularity (1m, 5m, 15m, 1h, 6h, 1d)
- **Strategy Selection**: Choose from predefined grid trading strategies or create custom strategies
- **Parameter Configuration**: Adjust strategy parameters, fees, starting balance
- **Result Analysis**: View detailed trade history, profit/loss, win rate, drawdown analysis
- **Data Export**: Save and load strategy configurations and backtest results

### Trading Strategies

Built-in strategies:
- **Reverse Descending Grid**: Buy on pullbacks in downtrends, sell on bounces
- **Ascending Grid**: Systematic buying and selling in uptrends
- **Custom Strategies**: Support for user-defined trading logic

## Architecture Decisions

### Grid Trading Approach
Grid trading divides the price range into intervals and executes buy/sell orders at each level. This provides:
- Systematic entry and exit points
- Reduced emotional decision-making
- Profit on volatile price movements
- Clear risk parameters

### Paper Trading Engine
Simulates real trading without risking capital:
- FIFO position accounting for accurate profit calculation
- Realistic fee modeling (maker/taker/rebate fees)
- Trade history and analytics
- Synchronized with backtesting for consistency

### Redis Caching Strategy
Stores historical candle data for performance:
- Reduces Coinbase API calls
- Enables fast chart rendering
- Separates real-time streaming from historical queries
- Metadata tracking for cache hit analysis

### System Audio Notifications
Uses PulseAudio (paplay) for profit alerts:
- Works reliably on headless/server environments
- Automatically selects correct audio device
- Fallback to ALSA (aplay) if PulseAudio unavailable
- Non-blocking async sound playback

## API Endpoints

### Trading Routes
- `GET /api/trading/status` - Current trading status
- `POST /api/trading/start` - Start trading with strategy
- `POST /api/trading/stop` - Stop trading
- `POST /api/trading/pause` - Pause trading
- `POST /api/trading/resume` - Resume trading
- `GET /api/trading/trades` - Get trade history
- `GET /api/trading/positions` - Get open positions
- `GET /api/trading/chart-data` - Get candle data (cached via Redis)
- `POST /api/trading/test-sell` - Test endpoint (triggers fake sell + profit sound)

### Data Routes
- `GET /api/trading/storage-stats` - Redis cache statistics
- `GET /api/trading/total-candles` - Total cached candles across granularities
- `POST /api/trading/populate-historical` - Fetch historical data (background task)

### Bot Management
- `GET /api/trading/bots` - List all bots
- `POST /api/trading/bots` - Create new bot
- `PUT /api/trading/bots/:botId/select` - Select active bot
- `DELETE /api/trading/bots/:botId` - Delete bot

## Debugging & Monitoring

### Using Tilt (Recommended)
```bash
# View frontend/Vite logs
tilt logs hermes-trading-post

# View backend logs
tilt logs paper-trading-backend

# View browser console logs
tilt logs browser-monitor

# View Redis logs
tilt logs hermes-redis-server

# Get service status
tilt get uiresources
```

### Manual Testing
Use the `/api/trading/test-sell` endpoint to test sound playback:
```bash
curl -X POST http://localhost:3000/api/trading/test-sell \
  -H "Content-Type: application/json" \
  -d '{"entryPrice": 40000, "exitPrice": 41000, "amount": 0.01}'
```

## Contributing

1. Create feature branch from `main`
2. Make changes and verify with `npm run check`
3. Test thoroughly with `npm run test`
4. Commit with clear messages
5. Push and create pull request

## Performance Optimizations

- **Parallel metadata fetches**: 70-85% faster with Promise.all vs sequential calls
- **Volume plugin sync**: Real-time subscription to dataStore updates
- **Redis caching**: Reduces API calls and improves chart load times
- **Vite build optimization**: Fast HMR for rapid development iteration

## Known Issues & Workarounds

- Audio playback requires `pulseaudio` or `alsa-utils` on Linux
- Coinbase API rate limiting may affect historical data fetch
- Chart performance degrades with >5000 candles (configure maxCandles appropriately)

## License

Private project - Not licensed for public use

## Support

For issues and feature requests, refer to the project documentation or contact the development team.
