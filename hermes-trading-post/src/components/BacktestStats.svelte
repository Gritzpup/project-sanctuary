<script lang="ts">
  import { onMount } from 'svelte';
  import VaultGrowthChart from './charts/VaultGrowthChart.svelte';
  import BTCGrowthChart from './charts/BTCGrowthChart.svelte';
  import FeeAnalysisChart from './charts/FeeAnalysisChart.svelte';
  import TradeDistributionChart from './charts/TradeDistributionChart.svelte';
  import type { BacktestResult } from '../strategies/base/StrategyTypes';
  
  export let results: BacktestResult;
  
  // Format numbers
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };
  
  const formatNumber = (value: number, decimals = 2) => {
    return value.toFixed(decimals);
  };
</script>

<div class="backtest-stats">
  <!-- Performance Overview Section -->
  <div class="stats-section">
    <h3 class="section-title">Performance Overview</h3>
    <div class="charts-grid">
      <div class="chart-container">
        <h4>Vault Growth</h4>
        <VaultGrowthChart data={results.chartData.vaultGrowth} />
        <div class="chart-stats">
          <span>Total: {formatMoney(results.metrics.vaultBalance)}</span>
          <span>CAGR: {formatPercent(results.metrics.vaultCAGR)}</span>
        </div>
      </div>
      
      <div class="chart-container">
        <h4>BTC Growth</h4>
        <BTCGrowthChart data={results.chartData.btcGrowth} />
        <div class="chart-stats">
          <span>Total: {formatNumber(results.metrics.btcGrowth, 8)} BTC</span>
          <span>Growth: +∞%</span>
        </div>
      </div>
      
      <div class="chart-container">
        <h4>Fee Analysis</h4>
        <FeeAnalysisChart 
          totalFees={results.metrics.totalFees}
          netProfit={results.metrics.totalReturn}
        />
        <div class="chart-stats">
          <span>Total Fees: {formatMoney(results.metrics.totalFees)}</span>
          <span>{formatNumber(results.metrics.feesAsPercentOfProfit)}% of profit</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Balance Growth Section -->
  <div class="stats-section">
    <h3 class="section-title">Compounded Balance Growth</h3>
    <div class="balance-grid">
      <div class="balance-card highlight">
        <h4>Initial Balance Growth</h4>
        <div class="balance-value">{formatMoney(results.metrics.initialBalanceGrowth || 0)}</div>
        <div class="balance-percent">{formatPercent(results.metrics.initialBalanceGrowthPercent || 0)}</div>
        <div class="balance-desc">Growth from 1/7 profit reinvestment</div>
      </div>
      
      <div class="balance-card">
        <h4>Final Trading Balance</h4>
        <div class="balance-value">{formatMoney(results.metrics.finalTradingBalance || 0)}</div>
        <div class="balance-desc">Available for trading</div>
      </div>
      
      <div class="balance-card">
        <h4>Fee Rebates</h4>
        <div class="balance-value">{formatMoney(results.metrics.totalFeeRebates || 0)}</div>
        <div class="balance-desc">25% of fees returned</div>
      </div>
      
      <div class="balance-card">
        <h4>Net Fees Paid</h4>
        <div class="balance-value">{formatMoney(results.metrics.netFeesAfterRebates || 0)}</div>
        <div class="balance-desc">After rebates</div>
      </div>
    </div>
  </div>
  
  <!-- Trading Activity Section -->
  <div class="stats-section">
    <h3 class="section-title">Trading Activity</h3>
    <div class="activity-grid">
      <div class="activity-card">
        <h4>Trade Distribution</h4>
        <TradeDistributionChart distribution={results.chartData.tradeDistribution} />
      </div>
      
      <div class="activity-stats">
        <div class="stat-row">
          <span class="stat-label">Daily Average</span>
          <span class="stat-value">{formatNumber(results.metrics.tradesPerDay, 1)} trades</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Weekly Average</span>
          <span class="stat-value">{formatNumber(results.metrics.tradesPerWeek, 1)} trades</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Monthly Average</span>
          <span class="stat-value">{formatNumber(results.metrics.tradesPerMonth, 0)} trades</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Detailed Metrics Section -->
  <div class="stats-section">
    <h3 class="section-title">Detailed Metrics</h3>
    <div class="metrics-grid">
      <div class="metric-card">
        <h4>Position Metrics</h4>
        <div class="metric-row">
          <span>Avg Position Size</span>
          <span>{formatMoney(results.metrics.avgPositionSize)}</span>
        </div>
        <div class="metric-row">
          <span>Avg Hold Time</span>
          <span>{formatNumber(results.metrics.averageHoldTime, 1)} hours</span>
        </div>
        <div class="metric-row">
          <span>Risk/Reward Ratio</span>
          <span>{formatNumber(results.metrics.riskRewardRatio, 2)}</span>
        </div>
      </div>
      
      <div class="metric-card">
        <h4>Performance Metrics</h4>
        <div class="metric-row">
          <span>Best Trade</span>
          <span class="positive">{formatMoney(results.metrics.averageWin)}</span>
        </div>
        <div class="metric-row">
          <span>Worst Trade</span>
          <span class="negative">{formatMoney(-results.metrics.averageLoss)}</span>
        </div>
        <div class="metric-row">
          <span>Max Consecutive Losses</span>
          <span>{results.metrics.maxConsecutiveLosses}</span>
        </div>
      </div>
      
      <div class="metric-card">
        <h4>Risk Metrics</h4>
        <div class="metric-row">
          <span>Max Drawdown</span>
          <span class="negative">{formatPercent(results.metrics.maxDrawdown)}</span>
        </div>
        <div class="metric-row">
          <span>Sharpe Ratio</span>
          <span>{formatNumber(results.metrics.sharpeRatio, 2)}</span>
        </div>
        <div class="metric-row">
          <span>Profit Factor</span>
          <span>{formatNumber(results.metrics.profitFactor, 2)}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .backtest-stats {
    width: 100%;
    padding: 20px 0;
  }
  
  .stats-section {
    margin-bottom: 40px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 12px;
    padding: 20px;
  }
  
  .section-title {
    font-size: 20px;
    font-weight: 600;
    color: #a78bfa;
    margin-bottom: 20px;
  }
  
  .charts-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  
  .chart-container {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 15px;
  }
  
  .chart-container h4 {
    font-size: 16px;
    color: #d1d4dc;
    margin-bottom: 15px;
  }
  
  .chart-stats {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    font-size: 14px;
    color: #9ca3af;
  }
  
  .activity-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
  }
  
  .activity-card {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 15px;
  }
  
  .activity-card h4 {
    font-size: 16px;
    color: #d1d4dc;
    margin-bottom: 15px;
  }
  
  .activity-stats {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .stat-row {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
  }
  
  .stat-label {
    color: #9ca3af;
    font-size: 14px;
  }
  
  .stat-value {
    color: #d1d4dc;
    font-weight: 600;
  }
  
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  
  .metric-card {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 15px;
  }
  
  .metric-card h4 {
    font-size: 16px;
    color: #d1d4dc;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .metric-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
  }
  
  .metric-row span:first-child {
    color: #9ca3af;
  }
  
  .metric-row span:last-child {
    color: #d1d4dc;
    font-weight: 500;
  }
  
  .positive {
    color: #26a69a !important;
  }
  
  .negative {
    color: #ef5350 !important;
  }
  
  .balance-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }
  
  .balance-card {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
  }
  
  .balance-card.highlight {
    background: rgba(167, 139, 250, 0.1);
    border-color: rgba(167, 139, 250, 0.3);
  }
  
  .balance-card h4 {
    font-size: 14px;
    color: #9ca3af;
    margin-bottom: 10px;
  }
  
  .balance-value {
    font-size: 24px;
    font-weight: 600;
    color: #d1d4dc;
    margin-bottom: 5px;
  }
  
  .balance-percent {
    font-size: 18px;
    font-weight: 500;
    color: #26a69a;
    margin-bottom: 10px;
  }
  
  .balance-desc {
    font-size: 12px;
    color: #6b7280;
  }
  
  @media (max-width: 1200px) {
    .charts-grid,
    .metrics-grid,
    .balance-grid {
      grid-template-columns: 1fr;
    }
    
    .activity-grid {
      grid-template-columns: 1fr;
    }
  }
</style>