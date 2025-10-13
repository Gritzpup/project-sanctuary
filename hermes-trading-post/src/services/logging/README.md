# Structured Logging Service

A production-ready logging service with environment-based filtering, colored output, and log history.

## Usage

### Basic Logging

```typescript
import { logger } from '@/services/logging';

// Debug level - detailed diagnostic information
logger.debug('Processing candle data', { candleCount: 100, pair: 'BTC-USD' });

// Info level - general informational messages
logger.info('Strategy initialized', { strategy: 'MicroScalping', balance: 10000 });

// Warning level - potentially harmful situations
logger.warn('High memory usage detected', { usage: '85%' });

// Error level - error events
logger.error('Failed to connect to WebSocket', {
  error: error.message,
  url: 'wss://example.com'
});
```

### With Source Context

```typescript
// Add source identifier for easier debugging
logger.info('Trade executed', {
  price: 50000,
  size: 0.01
}, 'TradeExecutor');
```

### Migration from console.log

```typescript
// Before:
console.log('Strategy Store: Updated strategy:', type);

// After:
logger.info('Strategy updated', { type }, 'StrategyStore');
```

```typescript
// Before:
console.error('❌ Failed to load historical data:', error);

// After:
logger.error('Failed to load historical data', { error: error.message });
```

## Configuration

### Environment-Based Log Levels

- **Development**: `DEBUG` and above (all logs)
- **Production**: `INFO` and above (no debug logs)

### Override Log Level

Set `VITE_LOG_LEVEL` in your `.env` file:

```
VITE_LOG_LEVEL=WARN   # Only warnings and errors
VITE_LOG_LEVEL=ERROR  # Only errors
VITE_LOG_LEVEL=NONE   # Disable all logging
```

### Programmatic Configuration

```typescript
import { logger, LogLevel } from '@/services/logging';

// Set minimum log level
logger.setLevel(LogLevel.WARN);

// Disable colored output
logger.setColors(false);

// Disable timestamps
logger.setTimestamps(false);
```

## Features

### Log History

Access recent logs for debugging:

```typescript
// Get last 50 logs
const recentLogs = logger.getHistory(50);

// Get all logs
const allLogs = logger.getHistory();

// Clear history
logger.clearHistory();
```

### Log Statistics

```typescript
const stats = logger.getStats();
console.log(stats);
// {
//   total: 1250,
//   byLevel: { DEBUG: 500, INFO: 600, WARN: 100, ERROR: 50 }
// }
```

### Browser Console Access

In development mode, access the logger from the browser console:

```javascript
// View recent logs
window.logger.getHistory(10);

// View statistics
window.logger.getStats();

// Change log level on the fly
window.logger.setLevel(1); // INFO and above
```

## Log Levels

| Level | Value | Description | Use Case |
|-------|-------|-------------|----------|
| DEBUG | 0 | Detailed diagnostic information | Development debugging, tracing execution flow |
| INFO | 1 | General informational messages | Application events, user actions, state changes |
| WARN | 2 | Potentially harmful situations | Recoverable errors, deprecated usage, performance issues |
| ERROR | 3 | Error events | Exceptions, failed operations, critical issues |
| NONE | 4 | Disable all logging | Testing, performance benchmarking |

## Best Practices

### 1. Choose the Right Level

```typescript
// ❌ Bad: Using info for debugging details
logger.info('Entering function updateCandle with params', { params });

// ✅ Good: Use debug for detailed diagnostics
logger.debug('Updating candle', { params });

// ❌ Bad: Using error for expected conditions
logger.error('No trades found');

// ✅ Good: Use info or warn for expected situations
logger.info('No trades found');
```

### 2. Include Relevant Context

```typescript
// ❌ Bad: No context
logger.error('Trade failed');

// ✅ Good: Include helpful context
logger.error('Trade failed', {
  reason: 'Insufficient balance',
  requiredAmount: 100,
  availableAmount: 50,
  tradeId: 'trade-123'
});
```

### 3. Use Source Identifiers

```typescript
// ✅ Good: Easy to identify log source
logger.info('Bot started', { botId: 'bot-1' }, 'BotManager');
logger.warn('Rate limit approaching', { remaining: 10 }, 'CoinbaseAPI');
```

### 4. Avoid Logging Sensitive Data

```typescript
// ❌ Bad: Logging passwords, API keys, private keys
logger.debug('User credentials', { password: 'secret123' });

// ✅ Good: Redact or omit sensitive data
logger.debug('User authenticated', { userId: 123, email: 'user@example.com' });
```

## Migration Guide

### Replacing console.log

Use this pattern to migrate existing console.log statements:

```typescript
// Pattern 1: Simple log
console.log('Message');
// →
logger.info('Message');

// Pattern 2: Log with data
console.log('Message:', data);
// →
logger.info('Message', { data });

// Pattern 3: Log with emoji/prefix
console.log('📈 Loaded data:', count);
// →
logger.info('Loaded data', { count }, 'DataLoader');

// Pattern 4: Debug logs
console.log('[DEBUG] Processing...');
// →
logger.debug('Processing...');

// Pattern 5: Error logs
console.error('Error:', error);
// →
logger.error('Error occurred', { error: error.message });
```

### Bulk Migration Script

Create a script to help migrate console statements:

```bash
# Find all console.log statements
grep -r "console\\.log" src/ --include="*.ts" --include="*.svelte"

# Find all console.error statements
grep -r "console\\.error" src/ --include="*.ts" --include="*.svelte"
```

## Performance Considerations

- Log filtering happens at the logger level (minimal overhead)
- Context objects are only formatted if the log level is active
- Log history is capped at 1000 entries (configurable)
- Colors and timestamps can be disabled for production builds

## Future Enhancements

Potential features to add:

- Remote logging (send logs to backend/monitoring service)
- Log file persistence (localStorage)
- Log grouping/categorization
- Performance metrics (timing, memory usage)
- Integration with error tracking services (Sentry, etc.)
