from typing import Optional
from app.services.alpaca_service import alpaca_service
from app.core.database import SessionLocal
from app.models.price_history import PriceHistory
import asyncio
import pandas as pd

async def sync_price_history(symbol: str = "BTC/USD", days: int = 365) -> int:
    """Fetch historical data from Alpaca and store into the database."""
    # Fetch historical data (not async, and pass timeframe as string)
    df = alpaca_service.get_historical_data(symbol, timeframe="1Min", limit=days*1440)
    if df is None or df.empty:
        return 0

    # Open DB session
    db = SessionLocal()
    synced_count = 0
    try:
        for timestamp, row in df.iterrows():
            record = PriceHistory(
                symbol=symbol,
                timestamp=timestamp,
                open=row['open'],
                high=row['high'],
                low=row['low'],
                close=row['close'],
                volume=row['volume'],
                vwap=row.get('vwap', None)
            )
            # Upsert record
            db.merge(record)
            synced_count += 1
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return synced_count
