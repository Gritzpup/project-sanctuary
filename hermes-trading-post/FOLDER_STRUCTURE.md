# Hermes Trading Post - Project Structure

## Root Directory
- **AI/** - Claude AI integration and documentation
- **backend/** - Node.js backend services
- **docs/** - Project documentation
- **public/** - Static assets (sounds, scripts)
- **src/** - Main frontend source code

## Backend Structure (`/backend/`)
- **data/** - Trading state files and backups
- **src/**
  - **routes/** - API route handlers
  - **services/** - Business logic (bot management, trading)

## Frontend Structure (`/src/`)

### Main Application Files
- **App.svelte** - Main application component
- **main.ts** - Application entry point
- **app.css** - Global styles

### Components (`/components/`)
- **backtesting/** - Backtesting interface components
- **chart/** - Chart-related components (controls, core, data, overlays)
- **charts/** - Specialized chart types (BTC growth, fee analysis, etc.)
- **layout/** - UI layout components (sidebar, collapsible elements)
- **news/** - News-related components
- **papertrading/** - Paper trading interface components
- **trading/** - Trading-specific components
- **vault/** - Vault management components

### Pages (`/pages/`)
- **Backtesting.svelte** - Backtesting page
- **Chart.svelte** - Chart page
- **Dashboard.svelte** - Main dashboard
- **PaperTrading.svelte** - Paper trading page
- **Trading.svelte** - Live trading page
- **Vault.svelte** - Vault management page
- **trading/chart/** - Advanced chart components with modular architecture

### Services (`/services/`)
- **api/** - External API integrations (Coinbase, WebSocket, news)
- **backtesting/** - Backtesting engine and metrics
- **cache/** - Data caching and IndexedDB management
- **chart/** - Chart data management and WebSocket handling
- **data/** - Historical data loading and real-time aggregation
- **state/** - Application state management (paper trading, persistence)
- **trading/** - Trading engines and opportunity detection

### Strategies (`/strategies/`)
- **base/** - Base strategy classes and types
- **implementations/** - Concrete strategy implementations
  - DCA, Grid Trading, Micro Scalping, Proper Scalping
  - RSI Mean Reversion, Reverse Ratio, VWAP Bounce

### Stores (`/stores/`)
- Global state management using Svelte stores
- Chart preferences, navigation, sidebar, strategy stores

### Styles (`/styles/`)
- Modular CSS files for different sections
- Base styles, components, utilities

### Types (`/types/`)
- TypeScript type definitions
- Coinbase API types, general application types

### Utils (`/utils/`)
- Utility functions and helpers
- Performance testing, error handling

## Key Architecture Features
- **Modular Design** - Clear separation of concerns
- **Service Layer** - Business logic abstracted from UI
- **Plugin System** - Chart plugins for indicators and overlays
- **State Management** - Centralized stores with persistence
- **Real-time Data** - WebSocket integration for live updates
- **Caching** - Multi-layer caching for performance
- **Strategy Pattern** - Pluggable trading strategies