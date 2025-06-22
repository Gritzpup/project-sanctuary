from fastapi import APIRouter, HTTPException
from app.services.alpaca_service import alpaca_service
from typing import Optional, Any
from datetime import datetime, timedelta
import pandas as pd
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/price/{symbol}")
async def get_current_price(symbol: str = "BTC/USD"):
    """Get current price for a symbol"""
    try:
        logger.info(f"API: Getting price for symbol: {symbol}")
        
        # Normalize the symbol first
        normalized_symbol = alpaca_service.normalize_crypto_symbol(symbol)
        logger.info(f"API: Normalized '{symbol}' to '{normalized_symbol}'")
        
        price = alpaca_service.get_current_price(symbol)
        logger.info(f"API: Got price result: {price}")
        
        if price is None:
            raise HTTPException(status_code=404, detail=f"Price not found for {symbol}")
        
        return {
            "symbol": symbol,
            "normalized_symbol": normalized_symbol,
            "price": price,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting price for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/historical/{symbol}")
async def get_historical_data(
    symbol: str = "BTC/USD",
    days: int = 365,
    resolution: str = "1H"
):
    """Get historical price data"""
    try:
        # Calculate start date from days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        data = alpaca_service.get_historical_data(
            symbol=symbol, 
            timeframe="1Min",
            start_date=start_date,
            end_date=end_date,
            limit=days * 1440  # Maximum possible minute bars
        )
        
        if data is None or data.empty:
            raise HTTPException(status_code=404, detail=f"No historical data found for {symbol}")
        
        # Resample data based on resolution
        if resolution == "1H":
            data_resampled = data.resample('1H').agg({
                'open': 'first',
                'high': 'max',
                'low': 'min',
                'close': 'last',
                'volume': 'sum'
            }).dropna()
        elif resolution == "1D":
            data_resampled = data.resample('1D').agg({
                'open': 'first',
                'high': 'max',
                'low': 'min',
                'close': 'last',
                'volume': 'sum'
            }).dropna()
        else:
            # Default to original resolution (1 minute)
            data_resampled = data
        
        # Convert to list of dictionaries
        historical_data = []
        for timestamp, row in data_resampled.iterrows():
            # Handle different timestamp types safely - use string conversion as fallback
            try:
                # Cast to Any to avoid type checker issues with dynamic attributes
                ts_obj: Any = timestamp
                timestamp_str = ts_obj.isoformat() if hasattr(ts_obj, 'isoformat') else str(timestamp)
            except Exception:
                timestamp_str = str(timestamp)
            
            historical_data.append({
                "timestamp": timestamp_str,
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"])
            })
        
        return {
            "symbol": symbol,
            "resolution": resolution,
            "days": days,
            "data_points": len(historical_data),
            "data": historical_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting historical data for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/daily-change/{symbol}")
async def get_daily_change(symbol: str = "BTC/USD"):
    """Get daily price change for a symbol"""
    try:
        # Get data for the last 2 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=2)
        
        data = alpaca_service.get_historical_data(
            symbol=symbol,
            timeframe="1Min",
            start_date=start_date,
            end_date=end_date,
            limit=2880  # 2 days * 1440 minutes
        )
        
        if data is None or data.empty or len(data) < 1440:  # Less than 24 hours of minute data
            raise HTTPException(status_code=404, detail="Insufficient data for daily change calculation")
        
        current_price = data.iloc[-1]["close"].item() if hasattr(data.iloc[-1]["close"], 'item') else float(data.iloc[-1]["close"])
        price_24h_ago = data.iloc[-1440]["close"].item() if hasattr(data.iloc[-1440]["close"], 'item') else float(data.iloc[-1440]["close"])
        
        daily_change = current_price - price_24h_ago
        daily_change_pct = (daily_change / price_24h_ago) * 100
        
        return {
            "symbol": symbol,
            "current_price": float(current_price),
            "price_24h_ago": float(price_24h_ago),
            "daily_change": float(daily_change),
            "daily_change_pct": float(daily_change_pct),
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating daily change for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ohlc/{symbol}")
async def get_ohlc_data(
    symbol: str = "BTC/USD",
    timeframe: str = "1H",
    limit: int = 100
):
    """Get OHLC data optimized for charting"""
    try:
        # Calculate days needed based on timeframe and limit
        if timeframe == "1H":
            days = max(1, (limit // 24) + 1)
        elif timeframe == "1D":
            days = limit
        else:
            days = 1
        
        # Calculate start date from days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        data = alpaca_service.get_historical_data(
            symbol=symbol,
            timeframe="1Min",
            start_date=start_date,
            end_date=end_date,
            limit=days * 1440  # Maximum possible minute bars
        )
        
        if data is None or data.empty:
            raise HTTPException(status_code=404, detail=f"No data found for {symbol}")
        
        # Resample based on timeframe
        if timeframe == "1H":
            ohlc_data = data.resample('1H').agg({
                'open': 'first',
                'high': 'max',
                'low': 'min',
                'close': 'last',
                'volume': 'sum'
            }).dropna().tail(limit)
        elif timeframe == "1D":
            ohlc_data = data.resample('1D').agg({
                'open': 'first',
                'high': 'max',
                'low': 'min',
                'close': 'last',
                'volume': 'sum'
            }).dropna().tail(limit)
        else:
            ohlc_data = data.tail(limit)        # Format for TradingView-style charting
        chart_data = []
        for timestamp, row in ohlc_data.iterrows():
            # Handle different timestamp types safely for epoch conversion
            try:
                # Cast to Any to avoid type checker issues with dynamic attributes
                ts_obj: Any = timestamp
                time_value = int(ts_obj.timestamp()) if hasattr(ts_obj, 'timestamp') else int(datetime.now().timestamp())
            except Exception:
                time_value = int(datetime.now().timestamp())
            
            chart_data.append({
                "time": time_value,
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"])
            })
        
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "data": chart_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting OHLC data for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
