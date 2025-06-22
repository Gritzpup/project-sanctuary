"""
Trading strategy engine for backtesting.
Contains all strategy implementations and trading logic.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from .backtest_utils import simulate_price_data, generate_date_range, calculate_performance_metrics


class BacktestEngine:
    """Main backtesting engine that executes different trading strategies."""
    
    def __init__(self, config, start_date, end_date, initial_capital):
        self.config = config
        self.start_date = start_date
        self.end_date = end_date
        self.initial_capital = initial_capital
        self.strategy_name = config.get('selected_strategy', 'always_gain_btc')
        
        # Generate date range and price data
        self.dates = generate_date_range(start_date, end_date)
        self.prices = simulate_price_data(self.dates, seed=42)
        
        # Initialize tracking arrays
        self.portfolio_values = [initial_capital]
        self.vault_balances = [0]
        self.btc_holdings = [0]
        self.cash_balances = [initial_capital]
        self.trades = []
        
        # Trading state
        self.in_position = False
        self.entry_price = 0.0
        self.position_size = 0.0
    
    def run_backtest(self):
        """Execute the backtest for the configured strategy."""
        if self.strategy_name == "always_gain_btc":
            return self._run_always_gain_strategy()
        elif self.strategy_name == "ma_crossover":
            return self._run_ma_crossover_strategy()
        elif self.strategy_name == "rsi_momentum":
            return self._run_rsi_momentum_strategy()
        elif self.strategy_name == "ladder_down":
            return self._run_ladder_down_strategy()
        else:
            raise ValueError(f"Unknown strategy: {self.strategy_name}")
    
    def _run_always_gain_strategy(self):
        """Execute Always Gain BTC strategy - never sells at a loss."""
        entry_threshold = self.config.get('entry_threshold', 2.0)
        exit_target = self.config.get('exit_target', 5.0)
        vault_allocation = self.config.get('vault_allocation', 1.0)
        max_position_value = self.config.get('max_position_size', 10000)
        
        for i in range(1, len(self.prices)):
            current_price = self.prices[i]
            prev_price = self.prices[i-1]
            daily_change = (current_price - prev_price) / prev_price * 100
            current_date = self.dates[i]
            
            # Buy signal: price drops by entry_threshold
            if not self.in_position and daily_change < -entry_threshold:
                available_cash = self.cash_balances[-1]
                position_value = min(available_cash * 0.95, max_position_value)
                position_size = position_value / current_price
                
                cost = position_size * current_price
                fee = cost * (self.config.get('taker_fee', 1.2) / 100)
                total_cost = cost + fee
                
                if total_cost <= available_cash:
                    self.cash_balances.append(available_cash - total_cost)
                    self.btc_holdings.append(position_size)
                    self.entry_price = current_price
                    self.in_position = True
                    self.position_size = position_size
                    
                    self.trades.append({
                        'date': current_date,
                        'action': 'BUY',
                        'price': current_price,
                        'quantity': position_size,
                        'value': total_cost,
                        'entry_price': current_price
                    })
                else:
                    self.cash_balances.append(self.cash_balances[-1])
                    self.btc_holdings.append(self.btc_holdings[-1])
                    
            # Sell signal: profit target reached (never sell at loss)
            elif self.in_position:
                profit_pct = (current_price - self.entry_price) / self.entry_price * 100
                
                if profit_pct >= exit_target:
                    revenue = self.position_size * current_price
                    fee = revenue * (self.config.get('taker_fee', 1.2) / 100)
                    net_revenue = revenue - fee
                    
                    gross_profit = revenue - (self.position_size * self.entry_price)
                    vault_contribution = gross_profit * (vault_allocation / 100)
                    vault_contribution = max(0, min(vault_contribution, gross_profit * 0.5))
                    
                    self.cash_balances.append(self.cash_balances[-1] + net_revenue - vault_contribution)
                    self.vault_balances.append(self.vault_balances[-1] + vault_contribution)
                    self.btc_holdings.append(0)
                    
                    self.trades.append({
                        'date': current_date,
                        'action': 'SELL',
                        'price': current_price,
                        'quantity': self.position_size,
                        'value': net_revenue,
                        'profit': max(0, gross_profit - fee),
                        'vault_contribution': vault_contribution,
                        'profit_pct': profit_pct,
                        'entry_price': self.entry_price
                    })
                    
                    self.in_position = False
                    self.position_size = 0
                else:
                    # Hold position
                    self.cash_balances.append(self.cash_balances[-1])
                    self.btc_holdings.append(self.btc_holdings[-1])
                    self.vault_balances.append(self.vault_balances[-1])
            else:
                # No trade
                self.cash_balances.append(self.cash_balances[-1])
                self.btc_holdings.append(self.btc_holdings[-1])
                self.vault_balances.append(self.vault_balances[-1])
            
            # Update portfolio value
            current_btc_value = self.btc_holdings[-1] * current_price
            total_value = self.cash_balances[-1] + current_btc_value + self.vault_balances[-1]
            self.portfolio_values.append(total_value)
        
        return self._generate_results()
    
    def _run_ma_crossover_strategy(self):
        """Execute Moving Average Crossover strategy."""
        short_ma = self.config.get('short_ma', 20)
        long_ma = self.config.get('long_ma', 50)
        stop_loss_pct = self.config.get('stop_loss', 4.0)
        position_size_pct = self.config.get('position_size', 80) / 100
        
        short_ma_values = []
        long_ma_values = []
        
        for i in range(1, len(self.prices)):
            current_price = self.prices[i]
            current_date = self.dates[i]
            
            # Calculate moving averages if we have enough data
            if i >= long_ma:
                short_ma_value = np.mean(self.prices[i-short_ma:i])
                long_ma_value = np.mean(self.prices[i-long_ma:i])
                short_ma_values.append(short_ma_value)
                long_ma_values.append(long_ma_value)
                
                # Buy signal: Short MA crosses above Long MA
                if (not self.in_position and len(short_ma_values) >= 2 and 
                    short_ma_values[-1] > long_ma_values[-1] and 
                    short_ma_values[-2] <= long_ma_values[-2]):
                    
                    available_cash = self.cash_balances[-1]
                    position_value = available_cash * position_size_pct
                    position_size = position_value / current_price
                    
                    cost = position_size * current_price
                    fee = cost * (self.config.get('taker_fee', 1.2) / 100)
                    total_cost = cost + fee
                    
                    if total_cost <= available_cash:
                        self.cash_balances.append(available_cash - total_cost)
                        self.btc_holdings.append(position_size)
                        self.entry_price = current_price
                        self.in_position = True
                        self.position_size = position_size
                        
                        self.trades.append({
                            'date': current_date,
                            'action': 'BUY',
                            'price': current_price,
                            'quantity': position_size,
                            'value': total_cost
                        })
                    else:
                        self.cash_balances.append(self.cash_balances[-1])
                        self.btc_holdings.append(self.btc_holdings[-1])
                        
                # Sell signal: Short MA crosses below Long MA OR stop loss
                elif (self.in_position and 
                      ((short_ma_values[-1] < long_ma_values[-1] and 
                        short_ma_values[-2] >= long_ma_values[-2]) or
                       (current_price <= self.entry_price * (1 - stop_loss_pct/100)))):
                    
                    revenue = self.position_size * current_price
                    fee = revenue * (self.config.get('taker_fee', 1.2) / 100)
                    net_revenue = revenue - fee
                    gross_profit = revenue - (self.position_size * self.entry_price)
                    
                    self.cash_balances.append(self.cash_balances[-1] + net_revenue)
                    self.btc_holdings.append(0)
                    self.vault_balances.append(self.vault_balances[-1])
                    
                    self.trades.append({
                        'date': current_date,
                        'action': 'SELL',
                        'price': current_price,
                        'quantity': self.position_size,
                        'value': net_revenue,
                        'profit': gross_profit - fee
                    })
                    
                    self.in_position = False
                    self.position_size = 0
                else:
                    self.cash_balances.append(self.cash_balances[-1])
                    self.btc_holdings.append(self.btc_holdings[-1])
                    self.vault_balances.append(self.vault_balances[-1])
            else:
                self.cash_balances.append(self.cash_balances[-1])
                self.btc_holdings.append(self.btc_holdings[-1])
                self.vault_balances.append(self.vault_balances[-1])
            
            # Update portfolio value
            current_btc_value = self.btc_holdings[-1] * current_price
            total_value = self.cash_balances[-1] + current_btc_value + self.vault_balances[-1]
            self.portfolio_values.append(total_value)
        
        return self._generate_results()
    
    def _run_rsi_momentum_strategy(self):
        """Execute RSI Momentum strategy."""
        rsi_period = self.config.get('rsi_period', 14)
        oversold = self.config.get('oversold', 30)
        overbought = self.config.get('overbought', 70)
        profit_target_pct = self.config.get('profit_target', 6.0)
        position_size_pct = self.config.get('position_size', 60) / 100
        
        price_changes = []
        rsi_values = []
        
        for i in range(1, len(self.prices)):
            current_price = self.prices[i]
            prev_price = self.prices[i-1]
            current_date = self.dates[i]
            
            price_change = current_price - prev_price
            price_changes.append(price_change)
            
            if len(price_changes) > rsi_period:
                price_changes.pop(0)
            
            # Calculate RSI if we have enough data
            if len(price_changes) >= rsi_period:
                gains = [change for change in price_changes if change > 0]
                losses = [-change for change in price_changes if change < 0]
                
                avg_gain = np.mean(gains) if gains else 0
                avg_loss = np.mean(losses) if losses else 0
                
                if avg_loss == 0:
                    rsi = 100
                else:
                    rs = avg_gain / avg_loss
                    rsi = 100 - (100 / (1 + rs))
                
                rsi_values.append(rsi)
                
                # Buy signal: RSI oversold
                if not self.in_position and rsi < oversold:
                    available_cash = self.cash_balances[-1]
                    position_value = available_cash * position_size_pct
                    position_size = position_value / current_price
                    
                    cost = position_size * current_price
                    fee = cost * (self.config.get('taker_fee', 1.2) / 100)
                    total_cost = cost + fee
                    
                    if total_cost <= available_cash:
                        self.cash_balances.append(available_cash - total_cost)
                        self.btc_holdings.append(position_size)
                        self.entry_price = current_price
                        self.in_position = True
                        self.position_size = position_size
                        
                        self.trades.append({
                            'date': current_date,
                            'action': 'BUY',
                            'price': current_price,
                            'quantity': position_size,
                            'value': total_cost
                        })
                    else:
                        self.cash_balances.append(self.cash_balances[-1])
                        self.btc_holdings.append(self.btc_holdings[-1])
                        
                # Sell signal: RSI overbought OR profit target
                elif self.in_position:
                    profit_pct = (current_price - self.entry_price) / self.entry_price * 100
                    
                    if rsi > overbought or profit_pct >= profit_target_pct:
                        revenue = self.position_size * current_price
                        fee = revenue * (self.config.get('taker_fee', 1.2) / 100)
                        net_revenue = revenue - fee
                        gross_profit = revenue - (self.position_size * self.entry_price)
                        
                        self.cash_balances.append(self.cash_balances[-1] + net_revenue)
                        self.btc_holdings.append(0)
                        self.vault_balances.append(self.vault_balances[-1])
                        
                        self.trades.append({
                            'date': current_date,
                            'action': 'SELL',
                            'price': current_price,
                            'quantity': self.position_size,
                            'value': net_revenue,
                            'profit': gross_profit - fee
                        })
                        
                        self.in_position = False
                        self.position_size = 0
                    else:
                        self.cash_balances.append(self.cash_balances[-1])
                        self.btc_holdings.append(self.btc_holdings[-1])
                        self.vault_balances.append(self.vault_balances[-1])
                else:
                    self.cash_balances.append(self.cash_balances[-1])
                    self.btc_holdings.append(self.btc_holdings[-1])
                    self.vault_balances.append(self.vault_balances[-1])
            else:
                self.cash_balances.append(self.cash_balances[-1])
                self.btc_holdings.append(self.btc_holdings[-1])
                self.vault_balances.append(self.vault_balances[-1])
            
            # Update portfolio value
            current_btc_value = self.btc_holdings[-1] * current_price
            total_value = self.cash_balances[-1] + current_btc_value + self.vault_balances[-1]
            self.portfolio_values.append(total_value)
        
        return self._generate_results()
    
    def _run_ladder_down_strategy(self):
        """Execute Ladder Down strategy (placeholder implementation)."""
        # For now, use Always Gain logic as base
        return self._run_always_gain_strategy()
    
    def _generate_results(self):
        """Generate comprehensive backtest results."""
        results = {
            'strategy_name': self.strategy_name,
            'dates': self.dates,
            'prices': self.prices,
            'portfolio_values': self.portfolio_values,
            'vault_balances': self.vault_balances,
            'cash_balances': self.cash_balances,
            'btc_holdings': self.btc_holdings,
            'trades': self.trades,
            'config': self.config
        }
        
        # Calculate performance metrics
        results['performance'] = calculate_performance_metrics(results)
        
        return results


def generate_mock_results(days, initial_capital, config=None, start_date=None, end_date=None):
    """
    Generate mock backtest results (backward compatibility function).
    
    Args:
        days (int): Number of days for backtest
        initial_capital (float): Initial capital amount
        config (dict): Strategy configuration
        start_date (datetime): Start date
        end_date (datetime): End date
        
    Returns:
        dict: Backtest results
    """
    if config is None:
        config = {'selected_strategy': 'always_gain_btc'}
    
    if start_date is None:
        start_date = datetime.now() - timedelta(days=days)
    if end_date is None:
        end_date = datetime.now()
    
    engine = BacktestEngine(config, start_date, end_date, initial_capital)
    return engine.run_backtest()
