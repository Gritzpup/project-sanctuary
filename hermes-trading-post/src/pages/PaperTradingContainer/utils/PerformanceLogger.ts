/**
 * Performance logging utilities for Paper Trading
 */

export class PerformanceLogger {
  public static logTradingPerformance(backendState: any) {
    const { balance, trades, positions, currentPrice, profitLoss, isRunning } = backendState;
    
    if (!isRunning || !balance) return;
    
    console.log('\n' + '='.repeat(80));
    console.log('🚀 HERMES TRADING POST - LIVE PERFORMANCE DASHBOARD');
    console.log('='.repeat(80));
    
    // Account balances
    console.log('\n💰 ACCOUNT BALANCE:');
    console.log(`   💵 USD Balance: $${balance.usd?.toFixed(2) || '0.00'}`);
    console.log(`   ₿  BTC Balance: ${balance.btc?.toFixed(8) || '0.00000000'} BTC`);
    
    if (balance.vault) {
      console.log(`   🏦 USD Vault: $${balance.vault.usd?.toFixed(2) || '0.00'}`);
      console.log(`   🏦 BTC Vault: ${balance.vault.btc?.toFixed(8) || '0.00000000'} BTC`);
    }
    
    const totalValue = (balance.usd || 0) + ((balance.btc || 0) * currentPrice);
    console.log(`   💎 Total Portfolio Value: $${totalValue.toFixed(2)}`);
    
    // P&L Information
    console.log('\n📊 PROFIT & LOSS:');
    const startingBalance = 10000; // Should be configurable
    const totalReturn = profitLoss || 0;
    const returnPercent = (totalReturn / startingBalance) * 100;
    const emoji = totalReturn >= 0 ? '🟢' : '🔴';
    
    console.log(`   ${emoji} Total Return: ${totalReturn >= 0 ? '+' : ''}$${totalReturn.toFixed(2)}`);
    console.log(`   📈 Return %: ${returnPercent >= 0 ? '+' : ''}${returnPercent.toFixed(2)}%`);
    console.log(`   🎯 Current Price: $${currentPrice?.toFixed(2) || '0.00'}`);
    
    // Position information
    this.logPositions(positions, currentPrice);
    
    // Trading history
    this.logTradingHistory(trades);
    
    console.log('\n' + '='.repeat(80));
  }

  private static logPositions(positions: any[], currentPrice: number) {
    console.log('\n📍 OPEN POSITIONS:');
    if (!positions || positions.length === 0) {
      console.log('   No open positions');
    } else {
      positions.forEach((pos: any, i: number) => {
        if (!pos || typeof pos.quantity !== 'number' || typeof pos.entryPrice !== 'number') {
          console.log(`   ${i + 1}. Invalid position data:`, pos);
          return;
        }
        
        const unrealizedPL = (currentPrice - pos.entryPrice) * pos.quantity;
        const unrealizedPLPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
        console.log(`   ${i + 1}. ${pos.quantity.toFixed(8)} BTC @ $${pos.entryPrice.toFixed(2)}`);
        console.log(`      Current P/L: ${unrealizedPL >= 0 ? '+' : ''}$${unrealizedPL.toFixed(2)} (${unrealizedPLPercent >= 0 ? '+' : ''}${unrealizedPLPercent.toFixed(2)}%)`);
        console.log(`      Entry Time: ${new Date(pos.timestamp || Date.now()).toLocaleString()}`);
      });
    }
  }

  private static logTradingHistory(trades: any[]) {
    console.log('\n📈 TRADING HISTORY:');
    if (!trades || trades.length === 0) {
      console.log('   No trades executed');
      return;
    }
    
    console.log(`   Total Trades: ${trades.length}`);
    
    const buyTrades = trades.filter((t: any) => t.side === 'buy');
    const sellTrades = trades.filter((t: any) => t.side === 'sell');
    
    console.log(`   Buy Orders: ${buyTrades.length}`);
    console.log(`   Sell Orders: ${sellTrades.length}`);
    
    const totalFees = trades.reduce((sum: number, trade: any) => sum + (trade.fees || 0), 0);
    console.log(`   Total Fees: $${totalFees.toFixed(2)}`);
    
    // Show last 10 trades
    this.logRecentTrades(trades);
    
    // Price levels analysis
    this.logPriceLevels(buyTrades, sellTrades);
  }

  private static logRecentTrades(trades: any[]) {
    console.log('\n   📋 Recent Trades (last 10):');
    const recentTrades = trades.slice(-10).reverse();
    recentTrades.forEach((trade: any, i: number) => {
      const time = new Date(trade.timestamp).toLocaleString();
      const side = trade.side.toUpperCase();
      const emoji = trade.side === 'buy' ? '🟢' : '🔴';
      const quantity = trade.quantity || trade.amount || 0;
      const price = trade.price || 0;
      const fees = trade.fees || 0;
      console.log(`   ${emoji} ${side} ${(quantity || 0).toFixed(8)} BTC @ $${(price || 0).toFixed(2)} | ${time}`);
      if (fees) console.log(`      Fee: $${(fees || 0).toFixed(2)}`);
    });
  }

  private static logPriceLevels(buyTrades: any[], sellTrades: any[]) {
    const buyPrices = buyTrades.map((t: any) => t.price).sort((a: number, b: number) => b - a);
    const sellPrices = sellTrades.map((t: any) => t.price).sort((a: number, b: number) => a - b);
    
    if (buyPrices.length > 0) {
      console.log(`\n   💰 Buy Price Range: $${Math.min(...buyPrices).toFixed(2)} - $${Math.max(...buyPrices).toFixed(2)}`);
      console.log(`   🎯 Average Buy Price: $${(buyPrices.reduce((a: number, b: number) => a + b, 0) / buyPrices.length).toFixed(2)}`);
    }
    
    if (sellPrices.length > 0) {
      console.log(`\n   💸 Sell Price Range: $${Math.min(...sellPrices).toFixed(2)} - $${Math.max(...sellPrices).toFixed(2)}`);
      console.log(`   🎯 Average Sell Price: $${(sellPrices.reduce((a: number, b: number) => a + b, 0) / sellPrices.length).toFixed(2)}`);
    }
  }
}