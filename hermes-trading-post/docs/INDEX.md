# Hermes Trading Post - Documentation Index

Complete documentation for the Hermes Trading Post cryptocurrency trading platform.

## Quick Navigation

### Getting Started
- **[README.md](../README.md)** - Project overview, setup instructions, feature list, API reference
- **[../tools/README.md](../tools/README.md)** - Development tools and debugging utilities

### Architecture & Design
- **[Backtesting Guide](./backtesting.md)** - Strategy backtesting system (if exists)
- **[Backup System](./backup-system.md)** - Data backup and recovery mechanisms
- **[AI Strategy Integration](./AI_STRATEGY_INTEGRATION.md)** - AI-powered trading strategy integration

### Audit & Analysis

#### Codebase Organization Audit
- **[audit/AUDIT_README.md](./audit/AUDIT_README.md)** - Navigation guide for audit documents
- **[audit/CODEBASE_AUDIT_REPORT.md](./audit/CODEBASE_AUDIT_REPORT.md)** - Comprehensive codebase analysis (18 issues identified)
- **[audit/AUDIT_QUICK_SUMMARY.txt](./audit/AUDIT_QUICK_SUMMARY.txt)** - Executive summary of findings
- **[audit/AUDIT_FILE_REFERENCE.txt](./audit/AUDIT_FILE_REFERENCE.txt)** - File paths and cleanup commands

**Status**: Phase 1 & 2 complete (dead code removed, documentation organized)

#### Performance Audit
- **[audit/AUDIT_INDEX.md](./audit/AUDIT_INDEX.md)** - Performance audit navigation guide
- **[audit/PERFORMANCE_AUDIT.md](./audit/PERFORMANCE_AUDIT.md)** - 8 performance optimization findings
- **[audit/AUDIT_SUMMARY.txt](./audit/AUDIT_SUMMARY.txt)** - Performance findings summary

**Status**: Ready for Phase 1 implementation (expected 40-60% improvement)

## Documentation by Topic

### Frontend Architecture
- Component structure and organization
- State management with Svelte stores
- Chart rendering and data visualization
- Real-time WebSocket updates

### Backend Architecture
- Express.js API routes and endpoints
- Redis caching strategy
- Coinbase API integration
- Paper trading engine (FIFO position accounting)

### Trading Features
- **Grid Trading Strategies**: Reverse descending, ascending grid patterns
- **Paper Trading**: Risk-free strategy testing with simulated balance
- **Backtesting**: Historical simulation with parameter configuration
- **Audio Notifications**: Profit alerts via system audio (PulseAudio)

### Data & Caching
- Redis candle data storage
- Historical data download and caching
- WebSocket real-time price streaming
- Chart data loading pipeline

### Development Tools
- `clean-logging.sh` - Remove verbose console logs
- `download-all-granularities.sh` - Populate Redis cache
- `granularity-test.js` - Test button state logic
- `volume-test.html` - Debug volume data integrity
- See [../tools/README.md](../tools/README.md) for complete tool reference

## Key Metrics & Performance

### Current System Performance
- Chart initialization: 100-300ms
- Real-time updates: 50-70 per minute (see optimization opportunities)
- API response time: <200ms (cached)
- Backend candle storage: ~100K+ OHLCV entries

### Optimization Roadmap
1. **Phase 1**: Redis KEYS → SCAN, parallelize metadata fetches (+40-50% improvement)
2. **Phase 2**: Reduce polling, optimize heartbeat (+30% improvement)
3. **Phase 3**: Stats update logic, data transformation (+15-20% improvement)

**Estimated Total**: 40-60% performance improvement with ~50 min implementation

## API Reference

### Trading Endpoints
- `POST /api/trading/start` - Start trading with strategy
- `POST /api/trading/stop` - Stop active trading
- `GET /api/trading/status` - Current trading status
- `GET /api/trading/trades` - Trade history
- `POST /api/trading/test-sell` - Test sound playback

### Data Endpoints
- `GET /api/trading/chart-data` - Historical candle data (cached)
- `GET /api/trading/total-candles` - Total candles across granularities
- `POST /api/trading/populate-historical` - Download historical data

### Bot Management
- `GET /api/trading/bots` - List all bots
- `POST /api/trading/bots` - Create new bot
- `PUT /api/trading/bots/:botId/select` - Select active bot

Complete API documentation in [../README.md#api-endpoints](../README.md#api-endpoints)

## Troubleshooting

### Common Issues

**Issue**: Chart won't load
- Check browser console logs: `tilt logs browser-monitor`
- Verify backend is running: `tilt logs paper-trading-backend`
- Check Redis connectivity: `tilt logs hermes-redis-server`

**Issue**: Volume data missing
- Run volume test tool: `tools/volume-test.html`
- Verify Redis cache: `tools/download-all-granularities.sh` status
- Check Coinbase API response: See [audit/DATA_FLOW_ANALYSIS.md](./audit/DATA_FLOW_ANALYSIS.md)

**Issue**: Sound not playing
- Check system audio: `paplay --version` or `aplay --version`
- Verify backend route working: `curl -X POST http://localhost:3000/api/trading/test-sell`
- Check browser console for errors

**Issue**: Performance degradation
- Run performance audit findings in [audit/PERFORMANCE_AUDIT.md](./audit/PERFORMANCE_AUDIT.md)
- Monitor polling mechanisms in [audit/DATA_FLOW_ANALYSIS.md](./audit/DATA_FLOW_ANALYSIS.md)
- Check Redis statistics: `/api/trading/storage-stats`

## Build & Deploy

### Development
```bash
npm run dev              # Start frontend + backend
npm run dev:frontend    # Frontend only
npm run dev:backend     # Backend only
```

### Testing
```bash
npm run test            # Run tests
npm run test:ui         # Test UI
npm run check           # Type checking
```

### Production
```bash
npm run build          # Build for production
npm run preview        # Preview production build
```

## Contributing

1. Review relevant documentation above
2. Check [../README.md#contributing](../README.md#contributing) for guidelines
3. Ensure changes pass: `npm run check && npm run test`
4. Reference audit findings: Check [./audit/](./audit/) for known issues

## Repository Structure

```
hermes-trading-post/
├── README.md                    # Main project documentation
├── docs/                        # This documentation
│   ├── INDEX.md               # This file
│   ├── audit/                 # Audit findings
│   │   ├── AUDIT_README.md
│   │   ├── CODEBASE_AUDIT_REPORT.md
│   │   ├── PERFORMANCE_AUDIT.md
│   │   └── ...
│   ├── backtesting.md
│   ├── backup-system.md
│   └── AI_STRATEGY_INTEGRATION.md
├── tools/                       # Development utilities
│   ├── README.md              # Tool documentation
│   ├── clean-logging.sh
│   ├── download-all-granularities.sh
│   └── ...
├── src/                         # Frontend source
├── backend/                     # Backend source
├── archive/documentation/       # Deprecated docs (for reference)
└── [config files...]
```

## Document Maintenance

### Last Updated
- Main README: October 18, 2025
- Tools Documentation: October 18, 2025
- Audit Reports: October 18, 2025
- This Index: October 18, 2025

### Deprecated Documentation
Old documentation from earlier phases is archived in `archive/documentation/` for historical reference:
- Task completion reports (Sept-Oct 2025)
- Status summaries
- Modularization notes
- Project structure iterations

These are kept for reference but should not be relied upon for current development.

## Questions & Support

- **Code questions**: Check component files and inline documentation
- **Architecture questions**: Review `audit/DATA_FLOW_ANALYSIS.md`
- **Performance issues**: See `audit/PERFORMANCE_AUDIT.md`
- **Tool usage**: See `tools/README.md`
- **Build/deploy**: See this file under "Build & Deploy" section
- **General setup**: See main `README.md`

## Related Links

- [GitHub Repository](https://github.com/Gritzpup/project-sanctuary)
- [Coinbase Advanced API Docs](https://docs.cloud.coinbase.com/advanced-trade/reference)
- [Lightweight Charts Docs](https://tradingview.github.io/lightweight-charts/)
- [Svelte Documentation](https://svelte.dev/docs)

---

**Note**: This documentation is continuously updated. For the latest information, always check the main files rather than this index.
