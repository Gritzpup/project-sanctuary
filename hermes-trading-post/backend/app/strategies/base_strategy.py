from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime
import pandas as pd

@dataclass
class Signal:
    """Trading signal"""
    action: str  # "buy", "sell", "hold"
    quantity: Optional[float] = None
    price: Optional[float] = None
    timestamp: Optional[datetime] = None
    confidence: float = 1.0
    reason: str = ""

@dataclass
class Position:
    """Current position information"""
    symbol: str
    quantity: float
    entry_price: float
    entry_time: datetime
    current_price: float
    unrealized_pnl: float

class BaseStrategy(ABC):
    """Base class for all trading strategies"""

    def __init__(self, name: str, parameters: Optional[Dict[str, Any]] = None):
        self.name = name
        self.parameters = parameters or {}
        self.positions: Dict[str, Position] = {}
        self.vault_balance = 0.0
        self.total_trades = 0
        self.winning_trades = 0
        self.total_profit = 0.0
        self.is_active = False

    @abstractmethod
    def generate_signal(self, data: pd.DataFrame, current_price: float) -> Signal:
        """Generate trading signal based on market data"""
        pass

    @abstractmethod
    def get_default_parameters(self) -> Dict[str, Any]:
        """Get default strategy parameters"""
        pass

    def update_parameters(self, new_parameters: Dict[str, Any]):
        """Update strategy parameters"""
        self.parameters.update(new_parameters)

    def calculate_position_size(self, available_cash: float, price: float) -> float:
        """Calculate position size based on available cash and strategy rules"""
        max_position_value = available_cash * self.parameters.get("position_size_pct", 0.95)
        return max_position_value / price

    def calculate_fees(self, trade_value: float, is_maker: bool = False) -> float:
        """Calculate trading fees with support for maker/taker differentiation"""
        if is_maker:
            fee_rate = self.parameters.get("maker_fee_rate", 0.006)
        else:
            fee_rate = self.parameters.get("taker_fee_rate", 0.012)
        if "maker_fee_rate" not in self.parameters and "taker_fee_rate" not in self.parameters:
            fee_rate = self.parameters.get("fee_rate", 0.0015)
        return trade_value * fee_rate

    def add_position(self, symbol: str, quantity: float, price: float):
        """Add a new position"""
        self.positions[symbol] = Position(
            symbol=symbol,
            quantity=quantity,
            entry_price=price,
            entry_time=datetime.now(),
            current_price=price,
            unrealized_pnl=0.0
        )

    def update_position(self, symbol: str, current_price: float):
        """Update position with current market price"""
        if symbol in self.positions:
            position = self.positions[symbol]
            position.current_price = current_price
            position.unrealized_pnl = (current_price - position.entry_price) * position.quantity

    def close_position(self, symbol: str, exit_price: float) -> float:
        """Close a position and return realized P&L"""
        if symbol not in self.positions:
            return 0.0
        position = self.positions[symbol]
        realized_pnl = (exit_price - position.entry_price) * position.quantity
        self.total_trades += 1
        if realized_pnl > 0:
            self.winning_trades += 1
        self.total_profit += realized_pnl
        del self.positions[symbol]
        return realized_pnl

    def get_position(self, symbol: str) -> Optional[Position]:
        """Get current position for a symbol"""
        return self.positions.get(symbol)

    def get_all_positions(self) -> Dict[str, Position]:
        """Get all current positions"""
        return self.positions.copy()

    def get_win_rate(self) -> float:
        """Calculate win rate percentage"""
        if self.total_trades == 0:
            return 0.0
        return (self.winning_trades / self.total_trades) * 100

    def get_total_unrealized_pnl(self) -> float:
        """Calculate total unrealized P&L across all positions"""
        return sum(position.unrealized_pnl for position in self.positions.values())

    def reset_statistics(self):
        """Reset strategy statistics"""
        self.total_trades = 0
        self.winning_trades = 0
        self.total_profit = 0.0

    def update_position_prices(self, symbol: str, current_price: float):
        """Update position prices - alias for update_position"""
        self.update_position(symbol, current_price)

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get comprehensive performance metrics"""
        return {
            "name": self.name,
            "is_active": self.is_active,
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "win_rate": self.get_win_rate(),
            "total_profit": self.total_profit,
            "unrealized_pnl": self.get_total_unrealized_pnl(),
            "positions_count": len(self.positions),
            "vault_balance": self.vault_balance
        }

    def activate(self):
        """Activate the strategy"""
        self.is_active = True

    def deactivate(self):
        """Deactivate the strategy"""
        self.is_active = False

    def get_status(self) -> Dict[str, Any]:
        """Get strategy status information"""
        return {
            "name": self.name,
            "is_active": self.is_active,
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "win_rate": self.get_win_rate(),
            "total_profit": self.total_profit,
            "unrealized_pnl": self.get_total_unrealized_pnl(),
            "positions_count": len(self.positions),
            "vault_balance": self.vault_balance,
            "parameters": self.parameters
        }
