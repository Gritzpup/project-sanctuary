#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class LogViewer {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
  }

  async viewTodaysLogs(botId) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `trading-log-${botId}-${date}.log`);
    
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      console.log(`\n📊 Trading Log for Bot: ${botId} - ${date}`);
      console.log('='.repeat(80));
      
      lines.forEach(line => {
        console.log(line);
      });
      
      console.log(`\nTotal entries: ${lines.length}`);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`No log file found for bot ${botId} on ${date}`);
      } else {
        console.error('Error reading log file:', error);
      }
    }
  }

  async viewRecentActivity(botId, hours = 2) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `trading-log-${botId}-${date}.log`);
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      console.log(`\n📊 Recent Activity for Bot: ${botId} (Last ${hours} hours)`);
      console.log('='.repeat(80));
      
      const recentLines = lines.filter(line => {
        const timeMatch = line.match(/\[(\d{2}:\d{2}:\d{2})\]/);
        if (timeMatch) {
          const logTime = timeMatch[1];
          const today = new Date().toISOString().split('T')[0];
          const logDateTime = new Date(`${today}T${logTime}`);
          return logDateTime >= cutoffTime;
        }
        return false;
      });
      
      recentLines.forEach(line => {
        console.log(line);
      });
      
      console.log(`\nRecent entries: ${recentLines.length}`);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`No log file found for bot ${botId} on ${date}`);
      } else {
        console.error('Error reading log file:', error);
      }
    }
  }

  async getTradesSummary(botId) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `trading-log-${botId}-${date}.log`);
    
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const trades = lines.filter(line => line.includes('TRADE LOG'));
      const buys = trades.filter(line => line.includes('BUY'));
      const sells = trades.filter(line => line.includes('SELL'));
      
      console.log(`\n💰 Trade Summary for Bot: ${botId} - ${date}`);
      console.log('='.repeat(60));
      console.log(`Total Trades: ${trades.length}`);
      console.log(`Buys: ${buys.length}`);
      console.log(`Sells: ${sells.length}`);
      console.log('');
      
      if (trades.length > 0) {
        console.log('Recent Trades:');
        trades.slice(-10).forEach(trade => {
          console.log(trade);
        });
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`No log file found for bot ${botId} on ${date}`);
      } else {
        console.error('Error reading log file:', error);
      }
    }
  }

  async tailLogs(botId) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `trading-log-${botId}-${date}.log`);
    
    console.log(`\n📡 Tailing logs for Bot: ${botId}`);
    console.log('Press Ctrl+C to exit');
    console.log('='.repeat(60));
    
    let lastSize = 0;
    
    const checkForUpdates = async () => {
      try {
        const stats = await fs.stat(logFile);
        if (stats.size > lastSize) {
          const content = await fs.readFile(logFile, 'utf8');
          const newContent = content.slice(lastSize);
          process.stdout.write(newContent);
          lastSize = stats.size;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error('Error checking log file:', error);
        }
      }
    };
    
    // Check for updates every 2 seconds
    const interval = setInterval(checkForUpdates, 2000);
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log('\n\nLog tailing stopped.');
      process.exit(0);
    });
    
    // Initial read
    await checkForUpdates();
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];
const botId = args[1] || 'reverse-descending-grid-bot-1';

const viewer = new LogViewer();

switch (command) {
  case 'today':
    await viewer.viewTodaysLogs(botId);
    break;
    
  case 'recent':
    const hours = parseInt(args[2]) || 2;
    await viewer.viewRecentActivity(botId, hours);
    break;
    
  case 'trades':
    await viewer.getTradesSummary(botId);
    break;
    
  case 'tail':
    await viewer.tailLogs(botId);
    break;
    
  default:
    console.log(`
Trading Log Viewer Usage:

node src/utils/logViewer.js <command> [botId] [options]

Commands:
  today [botId]           - View all logs for today
  recent [botId] [hours]  - View recent activity (default: 2 hours)
  trades [botId]          - View trade summary for today  
  tail [botId]            - Tail live logs (Ctrl+C to exit)

Examples:
  node src/utils/logViewer.js today
  node src/utils/logViewer.js recent reverse-descending-grid-bot-1 4
  node src/utils/logViewer.js trades
  node src/utils/logViewer.js tail
`);
}