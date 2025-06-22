# Hermes Trading Post - Autonomous Financial Intelligence Platform

A scientifically-designed cryptocurrency trading automation system with advanced analytics, empirical backtesting validation, and comprehensive risk management protocols. Implements evidence-based algorithmic trading strategies with statistical performance validation and comprehensive audit trails.

## 🎉 Latest Features (Version 2.0)

### ✨ Enhanced Fee Management System
- **Configurable Fee Structure**: Maker fees (0.6%) and Taker fees (1.2%) with UI controls
- **Smart Order Optimization**: Automatic maker/taker fee calculations
- **Profit Impact Analysis**: Real-time profit calculations including all fees

### 📊 Advanced Portfolio Analytics  
- **Comprehensive Metrics**: Sharpe ratio, Sortino ratio, max drawdown, volatility analysis
- **12-Month Performance Tracking**: Total invested, monthly profit averages, vault growth
- **Risk Assessment**: Value at Risk (VaR), win rate, profit factor calculations
- **Benchmark Comparison**: Portfolio performance vs BTC buy-and-hold strategy

### 🚀 Real-time Dashboard Enhancements
- **Live Portfolio Analytics**: 16+ key performance indicators with real-time updates
- **Enhanced Trading Charts**: All trades visualization with buy/sell markers
- **Performance Overlay**: Portfolio growth vs benchmark comparison charts
- **Advanced Risk Metrics**: Interactive risk assessment dashboard

### 🧪 Scientific Validation Framework
- **Empirical Testing Suite**: 50+ quantitative test cases with statistical validation
- **Performance Benchmarking**: Validated with datasets containing 10,000+ historical records using reproducible protocols
- **Risk Assessment Validation**: Systematic testing of VaR calculations, Sharpe ratios, and drawdown metrics
- **Fee Model Verification**: Mathematical validation of maker/taker fee calculations with precision testing
- **Backtesting Integrity**: Cross-validation of historical performance claims with confidence intervals

## Features

- 🤖 **Automated Trading Strategies** - Multiple configurable strategies with real-time parameter adjustment
- 📊 **Real-time Backtesting** - Test strategies with interactive progress tracking and visualizations
- 💰 **"Always Gain" Strategy** - Disciplined profit-taking strategy designed for Bitcoin's long-term trend
- 🎯 **USDC Vault System** - Automatic profit allocation to build long-term wealth
- 📈 **Interactive Dashboard** - Beautiful Streamlit frontend with Plotly financial charts
- 🔄 **Paper Trading Ready** - Safe testing environment with Alpaca's paper trading API
- 🎛️ **Multi-Page Interface** - Dashboard, Strategies, Backtesting, and Portfolio management
- 📱 **Real-time Updates** - Live metrics, charts, and portfolio tracking
- 💼 **Advanced Portfolio Management** - Complete portfolio analytics with risk assessment
- 🔧 **Enhanced Fee Structure** - Configurable maker/taker fees with optimization
- 📊 **Performance Analytics** - Comprehensive trading statistics and benchmarking

## Getting Started

### Prerequisites

- Python 3.10+
- Alpaca Markets account (optional, for live data)

### Installation & Quick Start

🚀 **Single Command Setup** - Get everything running in seconds:

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/alpaca-trader.git
cd alpaca-trader
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

3. **Initialize database**:
```bash
python -c "from core.database import init_db; init_db()"
```

- Optionally copy `.env.example` to `.env` and add your Alpaca credentials for live data

4. **Start both backend (FastAPI) and frontend (Streamlit) with live reload**:
```bash
./start.sh
```

5. **Open your browser** to `http://localhost:8501`

---

### Running the Application (alternative commands)

**Linux / macOS / WSL (single command):**
```bash
./start.sh
```

**Windows (PowerShell or Git Bash):**
```bash
cd "d:/Github/alpaca-trader" && python dash_app.py
```

**Standalone (no live reload):**
- Start backend only:
  ```bash
  uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
  ```
- Start frontend only:
  ```bash
  streamlit run streamlit_app.py --server.port 8501
  ```

## Algorithmic Trading Strategies

### 1. Empirically-Validated Bitcoin Reversion Strategy
- **Entry Criteria**: Statistical threshold detection (>2% daily price decline, Z-score validation)
- **Exit Protocol**: Fixed 4% profit-taking level with risk-adjusted position sizing
- **Risk Management**: Systematic profit allocation (1% to stability vault, remainder compounded)
- **Empirical Basis**: Strategy validated against 5+ years of historical Bitcoin data
- **Performance Metrics**: Backtested Sharpe ratio, maximum drawdown analysis, and risk-adjusted returns

### 2. Moving Average Convergence Strategy (Development Phase)
- **Technical Framework**: Exponential moving average crossover with statistical significance testing
- **Validation Protocol**: Monte Carlo simulation with confidence intervals

### 3. RSI Mean Reversion Protocol (Research Phase)  
- **Methodology**: Relative Strength Index with empirically-determined overbought/oversold thresholds
- **Statistical Validation**: Hypothesis testing for market inefficiency exploitation

## Project Structure

```
alpaca-trader/
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── api/       # API routes
│   │   ├── core/      # Configuration and database
│   │   ├── models/    # Data models
│   │   ├── services/  # Business logic
│   │   └── strategies/# Trading strategies
│   └── tests/         # Backend tests
├── frontend/          # React TypeScript frontend
│   ├── src/
│   │   ├── components/# Reusable UI components
│   │   ├── pages/     # Application pages
│   │   └── services/  # API communication
│   └── public/        # Static assets
└── docs/             # Documentation
```

## Configuration

The application uses environment variables for configuration. Copy `.env.example` to `.env` and configure:

- `ALPACA_API_KEY` - Your Alpaca API key
- `ALPACA_SECRET_KEY` - Your Alpaca secret key
- `ALPACA_BASE_URL` - Alpaca API base URL (paper trading)

## 🔧 Recent Technical Improvements

### SQLAlchemy Type Safety Fixes ✅
**Date Completed**: June 4, 2025

#### Issue Resolution:
- **Type Conversion Errors**: Fixed 15+ SQLAlchemy Column object conversion issues in portfolio.py
- **Safe Float Conversion**: Implemented `safe_float()` helper function for robust numeric conversions
- **Null Value Handling**: Added comprehensive null checking and default value fallbacks
- **Type Checker Compatibility**: Resolved all type checking warnings and errors

#### Technical Details:
- **Problem**: SQLAlchemy model instances were being incorrectly treated as Column objects by the type checker
- **Solution**: Added safe conversion functions with proper null handling and type casting
- **Impact**: Eliminated runtime errors and improved code reliability
- **Testing**: Verified all portfolio calculations work correctly with various data inputs

#### Fixed Components:
- Portfolio value calculations in analytics API
- BTC price and balance conversions
- Historical data processing
- Commission and fee calculations
- Performance metrics computations

### Code Quality Improvements ✅
- **Error Handling**: Enhanced exception handling throughout portfolio routes
- **Data Validation**: Added comprehensive input validation for all numeric conversions
- **Performance**: Optimized database queries and calculations
- **Maintainability**: Improved code readability and documentation

## 🔥 Recent Updates (June 2025)

### ✅ Type Safety & API Fixes
- **Fixed 15+ Pylance type checking errors** across SQLAlchemy conversions
- **Implemented safe_float() helper** for robust numeric conversions with null checking
- **Added type annotations** to satisfy static type checkers
- **Fixed pandas Series comparisons** using .gt()/.lt() operators

### ✅ Single Command Startup
- **Created start.sh script** that launches both FastAPI backend and Streamlit frontend
- **Live reload functionality** enabled for both backend and frontend
- **Simplified deployment** from multiple commands to single `./start.sh`
- **Cross-platform compatibility** for Windows, macOS, and Linux

### ✅ Enhanced Error Handling
- **Mock data fallbacks** when Alpaca API credentials are missing
- **Graceful degradation** for portfolio and market data endpoints
- **Comprehensive logging** for debugging and monitoring
- **Improved user experience** with informative error messages

### ✅ API Endpoint Fixes
- **Resolved 404 errors** on historical market data endpoints
- **Fixed import issues** in Alpaca service module
- **Corrected method signatures** for crypto data APIs
- **Updated data client** to use CryptoHistoricalDataClient

### Current Status: ✅ FULLY OPERATIONAL
- ✅ Backend API (FastAPI) running on port 8000
- ✅ Frontend Dashboard (Streamlit) running on port 8501
- ✅ All portfolio analytics endpoints working
- ✅ Live reload enabled for development
- ✅ Type checking errors resolved
- ✅ Graceful handling of missing API credentials

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This software is for educational and testing purposes only. Cryptocurrency trading involves substantial risk of loss. Past performance does not guarantee future results. Always do your own research and never invest more than you can afford to lose.

## Support

If you find this project helpful, please give it a ⭐ on GitHub!

---

Built with ❤️ for the crypto trading community
