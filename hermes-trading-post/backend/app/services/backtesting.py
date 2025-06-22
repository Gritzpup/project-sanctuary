import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from app.strategies.base_strategy import BaseStrategy
from app.strategies.always_gain_btc import AlwaysGainBTCStrategy
from app.strategies.ma_crossover import MovingAverageCrossoverStrategy
from app.strategies.rsi_momentum import RSIMomentumStrategy
import logging

logger = logging.getLogger(__name__)

class BacktestingService:
    """Service for backtesting trading strategies"""
    
    def __init__(self):
        self.available_strategies = {
            "always_gain_btc": AlwaysGainBTCStrategy,
            "ma_crossover": MovingAverageCrossoverStrategy,
            "rsi_momentum": RSIMomentumStrategy
            }
    
    def create_strategy(self, strategy_name: str, parameters: Optional[Dict[str, Any]] = None) -> Optional[BaseStrategy]:
        """Create a strategy instance"""
        if strategy_name not in self.available_strategies:
            logger.error(f"Unknown strategy: {strategy_name}")
            return None
        
        strategy_class = self.available_strategies[strategy_name]
        return strategy_class(parameters or {})
    
    def run_backtest(
        self, 
        strategy_name: str, 
        data: pd.DataFrame, 
        initial_balance: float = 10000.0,
        parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Run a backtest on historical data"""
        
        strategy = self.create_strategy(strategy_name, parameters or {})
        if strategy is None:
            return {"error": "Invalid strategy"}
        
        if data.empty:
            return {"error": "No data provided"}
        
        # Initialize backtest state
        balance = initial_balance
        positions = {}
        trade_history = []
        portfolio_history = []
        vault_balance = 0.0
        
        logger.info(f"Starting backtest for {strategy_name} with ${initial_balance}")
        
        # Process each data point
        for idx, (timestamp, row) in enumerate(data.iterrows()):
            current_price = row["close"]
            
            # Get data slice up to current point (for indicators)
            data_slice = data.iloc[:idx+1]
            
            # Generate signal
            signal = strategy.generate_signal(data_slice, current_price)
            
            # Execute signal
            if signal.action == "buy" and balance > 100:  # Minimum balance check
                # Calculate position size
                position_size = strategy.calculate_position_size(balance, current_price)
                trade_value = position_size * current_price
                fees = strategy.calculate_fees(trade_value)
                
                if balance >= trade_value + fees:
                    # Execute buy
                    balance -= (trade_value + fees)
                    strategy.add_position("BTC/USD", position_size, current_price)
                    
                    trade_history.append({
                        "timestamp": timestamp,
                        "action": "buy",
                        "price": current_price,
                        "quantity": position_size,
                        "value": trade_value,
                        "fees": fees,
                        "reason": signal.reason
                    })
                    
            elif signal.action == "sell" and "BTC/USD" in strategy.positions:
                # Execute sell
                position = strategy.positions["BTC/USD"]
                trade_value = position.quantity * current_price
                fees = strategy.calculate_fees(trade_value)
                net_proceeds = trade_value - fees
                
                # Calculate profit and vault allocation
                entry_value = position.quantity * position.entry_price
                gross_profit = trade_value - entry_value
                net_profit = gross_profit - fees - strategy.calculate_fees(entry_value)
                
                balance += net_proceeds
                
                # Handle vault allocation for profitable trades
                vault_contribution = 0.0
                if net_profit > 0:
                    vault_contribution = net_profit * strategy.parameters.get("vault_allocation_pct", 0.01)
                    vault_balance += vault_contribution
                    balance -= vault_contribution  # Remove vault allocation from trading balance
                
                # Close position
                strategy.close_position("BTC/USD", current_price)
                
                trade_history.append({
                    "timestamp": timestamp,
                    "action": "sell",
                    "price": current_price,
                    "quantity": position.quantity,
                    "value": trade_value,
                    "fees": fees,
                    "profit": net_profit,
                    "vault_contribution": vault_contribution,
                    "reason": signal.reason
                })
            
            # Update portfolio history (sample every hour to reduce data size)
            if idx % 60 == 0 or idx == len(data) - 1:  # Every hour or last point
                position_value = 0.0
                if "BTC/USD" in strategy.positions:
                    position_value = strategy.positions["BTC/USD"].quantity * current_price
                
                total_value = balance + position_value + vault_balance
                
                portfolio_history.append({
                    "timestamp": timestamp,
                    "total_value": total_value,
                    "cash_balance": balance,
                    "position_value": position_value,
                    "vault_balance": vault_balance,
                    "btc_price": current_price
                })
        
        # Calculate final metrics
        final_metrics = self.calculate_backtest_metrics(
            initial_balance, balance, vault_balance, trade_history, portfolio_history
        )
        
        # Add strategy performance metrics
        strategy_metrics = strategy.get_performance_metrics()
        final_metrics.update(strategy_metrics)
        
        logger.info(f"Backtest completed. Final value: ${final_metrics['final_total_value']:.2f}")
        
        return {
            "strategy_name": strategy_name,
            "parameters": strategy.parameters,
            "initial_balance": initial_balance,
            "final_balance": balance,
            "vault_balance": vault_balance,
            "metrics": final_metrics,
            "trade_history": trade_history,
            "portfolio_history": portfolio_history
        }
    
    def calculate_backtest_metrics(
        self, 
        initial_balance: float, 
        final_balance: float, 
        vault_balance: float,
        trade_history: List[Dict],
        portfolio_history: List[Dict]
    ) -> Dict[str, Any]:
        """Calculate comprehensive backtest metrics"""
        
        final_total_value = final_balance + vault_balance
        total_return = (final_total_value - initial_balance) / initial_balance
        
        # Trade statistics
        total_trades = len([t for t in trade_history if t["action"] == "sell"])
        winning_trades = len([t for t in trade_history if t["action"] == "sell" and t.get("profit", 0) > 0])
        
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        # Profit calculations
        total_profit = sum([t.get("profit", 0) for t in trade_history if t["action"] == "sell"])
        total_fees = sum([t.get("fees", 0) for t in trade_history])
        avg_profit_per_trade = total_profit / total_trades if total_trades > 0 else 0
        
        # Portfolio value series for additional metrics
        portfolio_values = [p["total_value"] for p in portfolio_history]
        
        # Calculate maximum drawdown
        max_drawdown = 0.0
        peak_value = initial_balance
        
        for value in portfolio_values:
            if value > peak_value:
                peak_value = value
            
            drawdown = (peak_value - value) / peak_value
            max_drawdown = max(max_drawdown, drawdown)
        
        # Calculate Sharpe ratio (simplified)
        if len(portfolio_values) > 1:
            returns = np.diff(portfolio_values) / portfolio_values[:-1]
            sharpe_ratio = np.mean(returns) / np.std(returns) * np.sqrt(365 * 24) if np.std(returns) > 0 else 0
        else:
            sharpe_ratio = 0.0
        
        return {
            "final_total_value": final_total_value,
            "total_return": total_return,
            "total_return_pct": total_return * 100,
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "losing_trades": total_trades - winning_trades,
            "win_rate": win_rate,
            "total_profit": total_profit,
            "total_fees": total_fees,
            "vault_balance": vault_balance,
            "avg_profit_per_trade": avg_profit_per_trade,
            "max_drawdown": max_drawdown,
            "max_drawdown_pct": max_drawdown * 100,
            "sharpe_ratio": sharpe_ratio
        }
    
    def get_available_strategies(self) -> List[Dict[str, Any]]:
        """Get list of available strategies with their default parameters"""
        strategies = []
        
        for name, strategy_class in self.available_strategies.items():
            # Create temporary instance to get default parameters
            temp_strategy = strategy_class()
            strategies.append({
                "name": name,
                "display_name": temp_strategy.name,
                "parameters": temp_strategy.get_default_parameters(),
                "description": strategy_class.__doc__ or "No description available"
            })
        
        return strategies

# Create singleton instance
backtesting_service = BacktestingService()
