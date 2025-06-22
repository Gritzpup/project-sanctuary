from app.strategies.base_strategy import BaseStrategy, Signal
from typing import Dict, Any, Optional
import pandas as pd
import numpy as np
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class RSIMomentumStrategy(BaseStrategy):
    """
    RSI Momentum Strategy
    
    Entry Logic: Buy when RSI < 30 (oversold)
    Exit Logic: Sell when RSI > 70 (overbought)
    Risk Management: Stop loss at 5% below entry
    
    Philosophy: Capitalize on short-term momentum reversals using RSI indicator
    """
    
    def __init__(self, parameters: Optional[Dict[str, Any]] = None):
        default_params = self.get_default_parameters()
        if parameters:
            default_params.update(parameters)
        super().__init__("RSI Momentum", default_params)
        self.last_rsi = None
    
    def get_default_parameters(self) -> Dict[str, Any]:
        return {
            "rsi_period": 14,                 # RSI calculation period
            "rsi_oversold": 30,               # RSI oversold threshold
            "rsi_overbought": 70,             # RSI overbought threshold
            "stop_loss_pct": 0.05,            # 5% stop loss
            "position_size_pct": 0.95,        # Use 95% of available cash
            "maker_fee_rate": 0.006,          # 0.6% maker fee
            "taker_fee_rate": 0.012,          # 1.2% taker fee
            "min_trade_size": 0.001,          # Minimum BTC position size
            "max_daily_trades": 3,            # Maximum trades per day
            "confirmation_periods": 2         # Periods to confirm signal
        }
    
    def calculate_rsi(self, data: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate RSI (Relative Strength Index)"""
        if len(data) < period + 1:
            return pd.Series([50] * len(data), index=data.index)
        
        # Ensure 'close' prices are float for numeric operations
        prices = pd.to_numeric(data['close'], errors='coerce').fillna(0.0)
        delta = prices.diff()
        
        gain = delta.where(delta.gt(0), 0)
        loss = -delta.where(delta.lt(0), 0)
        
        avg_gain = gain.rolling(window=period).mean()
        avg_loss = loss.rolling(window=period).mean()
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi.fillna(50)
    
    def should_enter_position(self, data: pd.DataFrame, current_price: float) -> bool:
        """Check if we should enter a position"""
        # Don't enter if we already have a position
        if "BTC/USD" in self.positions:
            return False
        
        # Calculate RSI
        rsi_values = self.calculate_rsi(data, self.parameters["rsi_period"])
        
        if len(rsi_values) < self.parameters["confirmation_periods"]:
            return False
        
        current_rsi = rsi_values.iloc[-1]
        self.last_rsi = current_rsi
        
        # Check for oversold condition
        if current_rsi <= self.parameters["rsi_oversold"]:
            # Confirm signal with previous periods
            confirmation_count = 0
            for i in range(1, self.parameters["confirmation_periods"] + 1):
                if len(rsi_values) > i and rsi_values.iloc[-i] <= self.parameters["rsi_oversold"]:
                    confirmation_count += 1
            
            if confirmation_count >= self.parameters["confirmation_periods"] - 1:
                logger.info(f"Entry condition met: RSI {current_rsi:.2f} <= {self.parameters['rsi_oversold']}")
                return True
        
        return False
    
    def should_exit_position(self, data: pd.DataFrame, current_price: float) -> bool:
        """Check if we should exit the current position"""
        if "BTC/USD" not in self.positions:
            return False
        
        position = self.positions["BTC/USD"]
        
        # Check stop loss
        price_change = (current_price - position.entry_price) / position.entry_price
        if price_change <= -self.parameters["stop_loss_pct"]:
            logger.info(f"Stop loss triggered: Loss {price_change:.2%} >= {self.parameters['stop_loss_pct']:.2%}")
            return True
        
        # Calculate RSI
        rsi_values = self.calculate_rsi(data, self.parameters["rsi_period"])
        
        if len(rsi_values) == 0:
            return False
        
        current_rsi = rsi_values.iloc[-1]
        self.last_rsi = current_rsi
        
        # Check for overbought condition
        if current_rsi >= self.parameters["rsi_overbought"]:
            logger.info(f"Exit condition met: RSI {current_rsi:.2f} >= {self.parameters['rsi_overbought']}")
            return True
        
        return False
    
    def generate_signal(self, data: pd.DataFrame, current_price: float) -> Signal:
        """Generate trading signals based on RSI momentum"""
        
        # Update current position price if we have one
        if "BTC/USD" in self.positions:
            self.update_position("BTC/USD", current_price)
        
        # Check for exit signal first
        if self.should_exit_position(data, current_price):
            position = self.positions["BTC/USD"]
            return Signal(
                action="sell",
                quantity=position.quantity,
                price=current_price,
                timestamp=datetime.now(),
                confidence=0.8,
                reason=f"RSI exit signal: RSI={self.last_rsi:.2f}"
            )
        
        # Check for entry signal
        if self.should_enter_position(data, current_price):
            # Calculate position size based on available cash
            available_cash = self.vault_balance
            if available_cash > 0:
                quantity = self.calculate_position_size(available_cash, current_price)
                
                if quantity >= self.parameters["min_trade_size"]:
                    return Signal(
                        action="buy",
                        quantity=quantity,
                        price=current_price,
                        timestamp=datetime.now(),
                        confidence=0.7,
                        reason=f"RSI entry signal: RSI={self.last_rsi:.2f}"
                    )
        
        # No signal
        return Signal(
            action="hold",
            timestamp=datetime.now(),
            confidence=0.5,
            reason=f"No signal: RSI={self.last_rsi:.2f}" if self.last_rsi else "Insufficient data"
        )
    
    def update_position_prices(self, symbol: str, current_price: float):
        """Update position with current market price"""
        if symbol in self.positions:
            position = self.positions[symbol]
            position.current_price = current_price
            position.unrealized_pnl = (current_price - position.entry_price) * position.quantity
    
    def get_strategy_info(self) -> Dict[str, Any]:
        """Get current strategy information"""
        info = self.get_status()
        info.update({
            "last_rsi": self.last_rsi,
            "rsi_oversold_threshold": self.parameters["rsi_oversold"],
            "rsi_overbought_threshold": self.parameters["rsi_overbought"],
            "stop_loss_pct": self.parameters["stop_loss_pct"],
            "strategy_type": "momentum",
            "indicator": "RSI"
        })
        return info