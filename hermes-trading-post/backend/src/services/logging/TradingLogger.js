import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TradingLogger {
  constructor(botId) {
    this.botId = botId;
    this.logDir = path.join(__dirname, '../../../logs');
    this.currentLogFile = null;
    this.lastLogTime = 0;
    this.logInterval = 30000; // Log every 30 seconds
    this.maxLogAge = 7 * 24 * 60 * 60 * 1000; // Keep logs for 7 days
    
    this.ensureLogDirectory();
    this.startPeriodicLogging();
  }

  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        // PERF: Disabled - console.error('Error creating log directory:', error);
      }
    }
  }

  getLogFileName() {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `trading-log-${this.botId}-${date}.log`);
  }

  async logTradingStatus(orchestrator) {
    const now = Date.now();
    
    // Skip if not enough time has passed
    if (now - this.lastLogTime < this.logInterval) {
      return;
    }
    
    try {
      const status = orchestrator.getStatus();
      const positions = orchestrator.positionManager.getPositions();
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        botId: this.botId,
        currentPrice: orchestrator.currentPrice,
        isRunning: orchestrator.isRunning,
        isPaused: orchestrator.isPaused,
        balance: {
          usd: orchestrator.balance.usd,
          btc: orchestrator.balance.btc,
          vault: orchestrator.balance.vault,
          btcVault: orchestrator.balance.btcVault
        },
        positions: {
          count: positions.length,
          totalBtc: positions.reduce((sum, p) => sum + p.size, 0),
          avgEntryPrice: positions.length > 0 ? 
            positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0) / 
            positions.reduce((sum, p) => sum + p.size, 0) : 0,
          details: positions.map(p => ({
            id: p.id,
            entryPrice: p.entryPrice,
            size: p.size,
            currentProfit: ((orchestrator.currentPrice - p.entryPrice) / p.entryPrice * 100).toFixed(2) + '%',
            sellTrigger: (p.entryPrice * 1.004).toFixed(2) // 0.4% profit target
          }))
        },
        triggers: {
          nextBuyPrice: status.nextBuyPrice,
          nextSellPrice: status.nextSellPrice,
          nextBuyDistance: status.nextBuyDistance,
          nextSellDistance: status.nextSellDistance
        },
        performance: {
          totalTrades: orchestrator.trades.length,
          totalValue: status.totalValue,
          unrealizedPnL: positions.length > 0 ? orchestrator.positionManager.calculateUnrealizedPnL(orchestrator.currentPrice) : 0,
          unrealizedPnLPercent: positions.length > 0 ? orchestrator.positionManager.calculateUnrealizedPnLPercent(orchestrator.currentPrice) : 0
        }
      };

      // Create human-readable log entry
      const logText = this.formatLogEntry(logEntry);
      
      // Write to file
      const logFile = this.getLogFileName();
      await fs.appendFile(logFile, logText + '\n');
      
      // Also log to console every 5 minutes for monitoring
      if (now - this.lastLogTime > 300000 || this.lastLogTime === 0) {
        // PERF: Disabled - console.log(`📊 TRADING LOG [${this.botId}]: ${logText}`);
      }
      
      this.lastLogTime = now;
      
    } catch (error) {
      // PERF: Disabled - console.error(`Error logging trading status for bot ${this.botId}:`, error);
    }
  }

  formatLogEntry(entry) {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const price = `$${entry.currentPrice.toLocaleString()}`;
    const status = entry.isRunning ? (entry.isPaused ? 'PAUSED' : 'RUNNING') : 'STOPPED';
    
    const balanceInfo = `USD:$${entry.balance.usd.toFixed(0)} BTC:${entry.balance.btc.toFixed(6)}`;
    const positionInfo = `${entry.positions.count}pos`;
    
    let triggerInfo = '';
    if (entry.triggers.nextBuyPrice) {
      triggerInfo += ` NextBuy:$${entry.triggers.nextBuyPrice.toFixed(0)}`;
    }
    if (entry.triggers.nextSellPrice) {
      triggerInfo += ` NextSell:$${entry.triggers.nextSellPrice.toFixed(0)}`;
    }
    
    let profitInfo = '';
    if (entry.performance.unrealizedPnL !== 0) {
      profitInfo = ` PnL:$${entry.performance.unrealizedPnL.toFixed(2)}(${entry.performance.unrealizedPnLPercent.toFixed(2)}%)`;
    }

    return `[${timestamp}] ${status} ${price} ${balanceInfo} ${positionInfo}${triggerInfo}${profitInfo}`;
  }

  async logTradeExecution(trade, action, position = null) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        botId: this.botId,
        action: action, // 'BUY', 'SELL', 'PROFIT_TARGET_HIT', etc.
        trade: {
          side: trade.side,
          amount: trade.amount,
          price: trade.price,
          value: trade.value,
          reason: trade.reason
        }
      };

      if (position) {
        logEntry.position = {
          id: position.id,
          entryPrice: position.entryPrice,
          size: position.size
        };
      }

      const logText = this.formatTradeLog(logEntry);
      
      // Write to file
      const logFile = this.getLogFileName();
      await fs.appendFile(logFile, logText + '\n');
      
      // Always log trades to console
      // PERF: Disabled - console.log(`🎯 TRADE LOG [${this.botId}]: ${logText}`);
      
    } catch (error) {
      // PERF: Disabled - console.error(`Error logging trade execution for bot ${this.botId}:`, error);
    }
  }

  formatTradeLog(entry) {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const trade = entry.trade;
    const action = entry.action;
    
    let message = `[${timestamp}] ${action} ${trade.side.toUpperCase()} ${trade.amount.toFixed(6)}BTC @ $${trade.price.toFixed(2)} = $${trade.value.toFixed(2)}`;
    
    if (trade.reason) {
      message += ` (${trade.reason})`;
    }
    
    return message;
  }

  startPeriodicLogging() {
    // This will be called by the orchestrator
    this.logInterval = 30000; // 30 seconds
  }

  async cleanOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const now = Date.now();
      
      for (const file of files) {
        if (file.startsWith(`trading-log-${this.botId}-`) && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > this.maxLogAge) {
            await fs.unlink(filePath);
            // PERF: Disabled - console.log(`🗑️ Cleaned old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      // PERF: Disabled - console.error(`Error cleaning old logs for bot ${this.botId}:`, error);
    }
  }

  async getRecentLogs(hours = 24) {
    try {
      const files = await fs.readdir(this.logDir);
      const recentLogs = [];
      const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
      
      for (const file of files) {
        if (file.startsWith(`trading-log-${this.botId}-`) && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() > cutoffTime) {
            const content = await fs.readFile(filePath, 'utf8');
            recentLogs.push({
              filename: file,
              content: content,
              lastModified: stats.mtime
            });
          }
        }
      }
      
      return recentLogs.sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
      // PERF: Disabled - console.error(`Error getting recent logs for bot ${this.botId}:`, error);
      return [];
    }
  }

  async getTodaysActivity() {
    try {
      const todayLogFile = this.getLogFileName();
      const content = await fs.readFile(todayLogFile, 'utf8');
      return content.split('\n').filter(line => line.trim());
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []; // No log file for today yet
      }
      // PERF: Disabled - console.error(`Error reading today's activity for bot ${this.botId}:`, error);
      return [];
    }
  }
}