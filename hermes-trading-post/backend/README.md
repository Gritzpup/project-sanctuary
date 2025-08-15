# Hermes Trading Backend

This is the backend service for Hermes Trading Post that enables continuous trading execution even during frontend page refreshes.

## Architecture

The backend service provides:
- Continuous trading execution independent of the frontend
- WebSocket for real-time updates to connected clients
- REST API for control operations
- Automatic state persistence in memory

## Features

- **Continuous Operation**: Trading continues running even when the frontend is closed or refreshed
- **Real-time Updates**: WebSocket connection provides instant updates on trades, prices, and status
- **State Recovery**: Automatically resumes trading after backend restart
- **Multiple Client Support**: Multiple frontend instances can connect and monitor the same trading session

## API Endpoints

### REST API
- `GET /api/trading/status` - Get current trading status
- `POST /api/trading/start` - Start trading with strategy config
- `POST /api/trading/stop` - Stop trading
- `POST /api/trading/pause` - Pause trading
- `POST /api/trading/resume` - Resume trading
- `PUT /api/trading/strategy` - Update trading strategy
- `GET /api/trading/trades` - Get all trades
- `GET /api/trading/positions` - Get open positions
- `POST /api/trading/reset` - Reset trading state

### WebSocket Events

**Client -> Server:**
- `start` - Start trading
- `stop` - Stop trading
- `pause` - Pause trading
- `resume` - Resume trading
- `getStatus` - Request current status
- `updateStrategy` - Update strategy

**Server -> Client:**
- `connected` - Initial connection confirmation
- `status` - Trading status update
- `priceUpdate` - Price and chart data update
- `trade` - New trade executed
- `tradingStarted/Stopped/Paused/Resumed` - State change notifications
- `error` - Error messages

## Running the Backend

The backend runs automatically when you execute `npm run dev` in the main project directory.

To run the backend separately:
```bash
cd backend
npm install
npm run dev
```

## Configuration

- Default port: 4827
- Set custom port with `PORT` environment variable
- CORS enabled for frontend communication

## Trading Logic

The backend:
1. Fetches BTC prices from Coinbase API every 5 seconds
2. Executes trading logic based on configured strategy
3. Manages positions and tracks trades
4. Broadcasts updates to all connected clients
5. Persists state in memory (survives page refreshes, not server restarts)

## Future Enhancements

- Persistent storage (database) for state
- Multiple asset support
- Advanced order types
- Strategy backtesting integration
- Authentication and user sessions