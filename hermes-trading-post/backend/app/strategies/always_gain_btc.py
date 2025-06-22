from app.strategies.base_strategy import BaseStrategy, Signal
from typing import Dict, Any, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class AlwaysGainBTCStrategy(BaseStrategy):
    """
    Always Gain Bitcoin Strategy
    
    Entry Logic: Buy when Bitcoin drops > 2% in a day
    Exit Logic: Sell when price rises 4% above entry point
    Profit Management: 1% to USDC vault, remainder reinvested for compound growth
    
    Philosophy: Capitalize on Bitcoin's long-term upward trend with disciplined profit-taking
    """
    def __init__(self, parameters: Optional[Dict[str, Any]] = None):
        default_params = self.get_default_parameters()
        if parameters:
            default_params.update(parameters)
        super().__init__("Always Gain BTC", default_params)
        self.last_daily_close = None
        self.daily_change_threshold_met = False
    
    def get_default_parameters(self) -> Dict[str, Any]:
        return {
            "entry_threshold_pct": 0.02,      # 2% daily drop to trigger buy
            "exit_target_pct": 0.05,          # 5% profit target (increased from 4%)
            "vault_allocation_pct": 0.01,     # 1% of profit to vault
            "rebalance_threshold_pct": 0.01,  # 1% rebalance threshold
            "position_size_pct": 0.95,        # Use 95% of available cash
            "maker_fee_rate": 0.006,          # 0.6% maker fee (Intro 1 level)
            "taker_fee_rate": 0.012,          # 1.2% taker fee (Intro 1 level)
            "min_trade_size": 0.001,          # Minimum BTC position size
            "max_daily_trades": 1,            # Maximum trades per day
            "lookback_hours": 24              # Hours to look back for daily change
        }
    
    def calculate_daily_change(self, data: pd.DataFrame) -> float:
        """Calculate daily percentage change"""
        if len(data) < self.parameters["lookback_hours"] * 60:  # Not enough data
            return 0.0
        
        # Get current price and price from 24 hours ago
        current_price = data.iloc[-1]["close"]
        hours_ago = self.parameters["lookback_hours"] * 60  # Convert to minutes
        past_price = data.iloc[-hours_ago]["close"]
        
        daily_change = (current_price - past_price) / past_price
        return daily_change
    
    def should_enter_position(self, data: pd.DataFrame, current_price: float) -> bool:
        """Check if we should enter a position"""
        # Don't enter if we already have a position
        if "BTC/USD" in self.positions:
            return False
        
        # Calculate daily change
        daily_change = self.calculate_daily_change(data)
        
        # Check if daily drop exceeds threshold (negative change)
        entry_threshold = -abs(self.parameters["entry_threshold_pct"])
        
        if daily_change <= entry_threshold:
            logger.info(f"Entry condition met: Daily change {daily_change:.2%} <= {entry_threshold:.2%}")
            return True
        
        return False
    
    def should_exit_position(self, current_price: float) -> bool:
        """Check if we should exit the current position"""
        if "BTC/USD" not in self.positions:
            return False
        
        position = self.positions["BTC/USD"]
        price_change = (current_price - position.entry_price) / position.entry_price
        
        # Exit if we've reached our profit target
        if price_change >= self.parameters["exit_target_pct"]:
            logger.info(f"Exit condition met: Profit {price_change:.2%} >= {self.parameters['exit_target_pct']:.2%}")
            return True
        
        return False
    
    def generate_signal(self, data: pd.DataFrame, current_price: float) -> Signal:
        """Generate trading signals based on strategy logic"""
        
        # Update current position price if we have one
        if "BTC/USD" in self.positions:
            self.update_position_prices("BTC/USD", current_price)
        
        # Check for exit signal first
        if self.should_exit_position(current_price):
            position = self.positions["BTC/USD"]
            return Signal(
                action="sell",
                quantity=position.quantity,
                price=current_price,
                timestamp=datetime.now(),
                confidence=1.0,
                reason=f"Profit target reached: {((current_price - position.entry_price) / position.entry_price):.2%}"
            )
        
        # Check for entry signal
        if self.should_enter_position(data, current_price):
            return Signal(
                action="buy",
                quantity=None,  # Will be calculated based on available cash
                price=current_price,
                timestamp=datetime.now(),
                confidence=1.0,
                reason=f"Daily drop > {self.parameters['entry_threshold_pct']:.1%}"
            )
        
        # Default to hold
        return Signal(
            action="hold",
            timestamp=datetime.now(),
            reason="No entry or exit conditions met"
        )
    
    def execute_buy_signal(self, signal: Signal, available_cash: float) -> Dict[str, Any]:
        """Execute a buy signal"""
        if signal.price is None:
            return {"success": False, "error": "No price provided"}
        
        # Calculate position size
        quantity = self.calculate_position_size(available_cash, signal.price)
        
        # Check minimum trade size
        if quantity < self.parameters["min_trade_size"]:
            return {"success": False, "error": "Trade size too small"}
        
        # Add position
        self.add_position("BTC/USD", quantity, signal.price)
        
        logger.info(f"BUY executed: {quantity:.6f} BTC at ${signal.price:.2f}")
        
        return {
            "success": True,
            "action": "buy",
            "symbol": "BTC/USD",
            "quantity": quantity,            "price": signal.price,
            "value": quantity * signal.price,
            "reason": signal.reason
        }
    
    def execute_sell_signal(self, signal: Signal) -> Dict[str, Any]:
        """Execute a sell signal"""
        if "BTC/USD" not in self.positions:
            return {"success": False, "error": "No position to sell"}
        
        if signal.price is None:
            return {"success": False, "error": "No price provided"}
        
        position = self.positions["BTC/USD"]
        net_profit = self.close_position("BTC/USD", float(signal.price))
        
        # Calculate vault allocation
        vault_contribution = 0.0
        if net_profit > 0:
            vault_contribution = net_profit * self.parameters["vault_allocation_pct"]
        
        logger.info(f"SELL executed: {position.quantity:.6f} BTC at ${signal.price:.2f}, Profit: ${net_profit:.2f}")
        
        return {
            "success": True,
            "action": "sell",
            "symbol": "BTC/USD",
            "quantity": position.quantity,
            "price": signal.price,
            "value": position.quantity * float(signal.price),
            "profit": net_profit,
            "vault_contribution": vault_contribution,
            "reason": signal.reason
        }
    
    def get_strategy_status(self) -> Dict[str, Any]:
        """Get current strategy status"""
        status = self.get_performance_metrics()
        
        # Add strategy-specific information
        if "BTC/USD" in self.positions:
            position = self.positions["BTC/USD"]
            unrealized_pct = (position.current_price - position.entry_price) / position.entry_price
            status.update({
                "has_position": True,
                "position_size": position.quantity,
                "entry_price": position.entry_price,
                "current_price": position.current_price,
                "unrealized_pnl": position.unrealized_pnl,
                "unrealized_pct": unrealized_pct,
                "target_exit_price": position.entry_price * (1 + self.parameters["exit_target_pct"])
            })
        else:
            status["has_position"] = False
        
        status["parameters"] = self.parameters
        return status
