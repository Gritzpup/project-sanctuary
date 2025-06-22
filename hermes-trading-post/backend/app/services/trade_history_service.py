from datetime import datetime, timedelta
from typing import List, Any
from app.core.database import SessionLocal
from app.models.trade import Trade as TradeModel
from alpaca.trading.client import TradingClient
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

async def sync_trade_history(days: int = 30) -> int:
    """Fetch executed trades from Alpaca and upsert into database."""
    # Initialize Alpaca client
    client = TradingClient(
        api_key=settings.ALPACA_API_KEY,
        secret_key=settings.ALPACA_SECRET_KEY,        paper=True
    )
    
    # Calculate start date
    start_date = datetime.now() - timedelta(days=days)
    
    # Fetch all orders within date range
    try:
        orders = client.get_orders()  # Fetch all orders
        # Filter only filled orders manually with safe attribute access
        orders = [o for o in orders if getattr(o, 'status', None) == "filled"]
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        return 0
    
    db = SessionLocal()
    count = 0
    try:
        for o in orders:
            # Determine price with safe attribute access
            filled_avg_price = getattr(o, 'filled_avg_price', None)
            limit_price = getattr(o, 'limit_price', None)
            price = float(filled_avg_price or limit_price or 0)
            
            # Determine quantity with safe attribute access
            filled_qty = getattr(o, 'filled_qty', None)
            qty = getattr(o, 'qty', None)
            quantity = float(filled_qty or qty or 0)            # Determine commission (simplified) - use hardcoded rates since settings don't have these
            fee_rate = 0.012  # 1.2% taker fee rate
            commission = price * quantity * fee_rate
            
            record = TradeModel(
                symbol=getattr(o, 'symbol', ''),
                strategy_name=getattr(o, 'client_order_id', '') or "",
                side=getattr(o, 'side', ''),
                quantity=quantity,
                price=price,
                executed_at=getattr(o, 'filled_at', None) or getattr(o, 'submitted_at', None),
                commission=commission,
                maker_fee_rate=0.006,  # 0.6% maker fee
                taker_fee_rate=0.012,  # 1.2% taker fee
                timestamp=getattr(o, 'submitted_at', None),
                order_id=getattr(o, 'id', ''),
                status=getattr(o, 'status', ''),
                is_maker_order=False,
                rebalance_triggered=False
            )
            db.merge(record)
            count += 1
        db.commit()
        logger.info(f"Synced {count} trades into database.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error syncing trade history: {e}")
        raise
    finally:
        db.close()
    return count
