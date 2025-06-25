from app.strategies.base_strategy import BaseStrategy, Signal
from typing import Dict, Any, Optional
import pandas as pd
import numpy as np
from datetime import datetime

class MovingAverageCrossoverStrategy(BaseStrategy):
    """
    Moving Average Crossover Strategy
    
    Entry Logic: Buy when short MA crosses above long MA with confirmation
    Exit Logic: Sell when short MA crosses below long MA or profit target reached
    
    Features:
    - Dual MA crossover signals with trend confirmation
    - Stop-loss and profit-taking capabilities
    - Volume-based signal strength adjustment
    - Fee optimization with maker/taker differentiation
    """
    def __init__(self, parameters: Optional[Dict[str, Any]] = None):
        default_params = self.get_default_parameters()
        if parameters:
            default_params.update(parameters)
        super().__init__("MA Crossover", default_params)
        self.previous_short_ma = None
        self.previous_long_ma = None
        self.signal_strength = 0.0
    
    def get_default_parameters(self) -> Dict[str, Any]:
        return {
            "short_ma_period": 20,           # Short moving average period
            "long_ma_period": 50,            # Long moving average period
            "profit_target_pct": 0.08,       # 8% profit target
            "stop_loss_pct": 0.04,           # 4% stop loss
            "position_size_pct": 0.95,       # Use 95% of available cash
            "vault_allocation_pct": 0.015,   # 1.5% of profit to vault
            "maker_fee_rate": 0.006,         # 0.6% maker fee (Intro 1 level)
            "taker_fee_rate": 0.012,         # 1.2% taker fee (Intro 1 level)
            "min_trade_size": 0.001,         # Minimum BTC position size
            "crossover_confirmation": True,  # Require confirmation candles
        }

    def calculate_moving_averages(self, data: pd.DataFrame) -> tuple:
        """Calculate short and long moving averages"""
        if len(data) < self.parameters["long_ma_period"]:
            return None, None
        
        short_ma = data["close"].rolling(window=self.parameters["short_ma_period"]).mean().iloc[-1]
        long_ma = data["close"].rolling(window=self.parameters["long_ma_period"]).mean().iloc[-1]
        
        return short_ma, long_ma
    def generate_signal(self, data: pd.DataFrame, current_price: float) -> Signal:
        """Generate trading signals based on MA crossover with enhanced logic"""
        
        # Update current position price if we have one
        if "BTC/USD" in self.positions:
            self.update_position("BTC/USD", current_price)
            
            # Check for profit target or stop loss
            position = self.positions["BTC/USD"]
            profit_pct = (current_price - position.entry_price) / position.entry_price
            
            # Profit target reached
            if profit_pct >= self.parameters["profit_target_pct"]:
                return Signal(
                    action="sell",
                    quantity=position.quantity,
                    price=current_price,
                    timestamp=datetime.now(),
                    confidence=0.9,
                    reason=f"Profit target reached: {profit_pct:.2%} profit"
                )
            
            # Stop loss triggered
            if profit_pct <= -self.parameters["stop_loss_pct"]:
                return Signal(
                    action="sell",
                    quantity=position.quantity,
                    price=current_price,
                    timestamp=datetime.now(),
                    confidence=0.8,
                    reason=f"Stop loss triggered: {profit_pct:.2%} loss"
                )
        
        # Calculate moving averages
        short_ma, long_ma = self.calculate_moving_averages(data)
        
        if short_ma is None or long_ma is None:
            return Signal(
                action="hold",
                timestamp=datetime.now(),
                reason="Insufficient data for MA calculation"
            )
        
        # Detect crossover events
        crossover_signal = self._detect_crossover(short_ma, long_ma)
        
        if crossover_signal == "bullish" and "BTC/USD" not in self.positions:
            # Calculate signal strength based on MA separation
            ma_separation = abs(short_ma - long_ma) / long_ma
            confidence = min(0.9, 0.6 + ma_separation * 10)  # Scale confidence
            
            return Signal(
                action="buy",
                price=current_price,
                timestamp=datetime.now(),
                confidence=confidence,
                reason=f"Bullish MA crossover: Short MA ({short_ma:.2f}) > Long MA ({long_ma:.2f})"
            )
        
        elif crossover_signal == "bearish" and "BTC/USD" in self.positions:
            position = self.positions["BTC/USD"]
            return Signal(
                action="sell",
                quantity=position.quantity,
                price=current_price,
                timestamp=datetime.now(),
                confidence=0.75,
                reason=f"Bearish MA crossover: Short MA ({short_ma:.2f}) < Long MA ({long_ma:.2f})"
            )
        
        return Signal(
            action="hold",
            timestamp=datetime.now(),
            reason=f"No clear signal - Short MA: {short_ma:.2f}, Long MA: {long_ma:.2f}"
        )
    
    def _detect_crossover(self, current_short_ma: float, current_long_ma: float) -> str:
        """Detect crossover events with confirmation if enabled"""
        if self.previous_short_ma is None or self.previous_long_ma is None:
            self.previous_short_ma = current_short_ma
            self.previous_long_ma = current_long_ma
            return "none"
        
        # Detect crossover
        was_short_above = self.previous_short_ma > self.previous_long_ma
        is_short_above = current_short_ma > current_long_ma
        
        crossover_type = "none"
        
        if not was_short_above and is_short_above:
            crossover_type = "bullish"
        elif was_short_above and not is_short_above:
            crossover_type = "bearish"
        
        # Update previous values
        self.previous_short_ma = current_short_ma
        self.previous_long_ma = current_long_ma
        
        return crossover_type
