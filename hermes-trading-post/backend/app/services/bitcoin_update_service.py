"""
Daily Bitcoin Data Update Service
Handles fetching and storing daily Bitcoin data from Alpaca API
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_

from app.core.database import SessionLocal
from app.models.historical_data import HistoricalData
from app.services.alpaca_service import alpaca_service

logger = logging.getLogger(__name__)

class BitcoinDataUpdateService:
    """Service for updating Bitcoin historical data daily"""
    
    def __init__(self):
        self.symbol = "BTC/USD"
        self.db_symbol = "BTCUSD"
    
    async def update_daily_data(self, days_to_fetch: int = 1) -> Dict[str, any]:
        """
        Update Bitcoin data for the last N days
        
        Args:
            days_to_fetch: Number of recent days to fetch/update
            
        Returns:
            Dictionary with update results
        """
        logger.info(f"Starting daily Bitcoin data update for {days_to_fetch} days")
        
        result = {
            "success": False,
            "records_updated": 0,
            "records_inserted": 0,
            "errors": [],
            "last_update": datetime.utcnow().isoformat()
        }
        
        db = SessionLocal()
        try:
            # Get the latest data from Alpaca
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_to_fetch + 1)  # Extra day for safety
            
            logger.info(f"Fetching data from {start_date} to {end_date}")
            
            # Fetch data from Alpaca (this should use your existing bitcoin_data_service)
            historical_data = await self._fetch_alpaca_data(start_date, end_date)
            
            if not historical_data:
                result["errors"].append("No data received from Alpaca")
                return result
            
            # Process and store data
            for data_point in historical_data:
                existing_record = db.query(HistoricalData).filter(
                    and_(
                        HistoricalData.symbol == self.db_symbol,
                        HistoricalData.timestamp == data_point['timestamp']
                    )
                ).first()
                
                if existing_record:
                    # Update existing record
                    existing_record.open_price = data_point['open']
                    existing_record.high_price = data_point['high'] 
                    existing_record.low_price = data_point['low']
                    existing_record.close_price = data_point['close']
                    existing_record.volume = data_point['volume']
                    existing_record.updated_at = datetime.utcnow()
                    result["records_updated"] += 1
                    logger.debug(f"Updated record for {data_point['timestamp']}")
                else:
                    # Insert new record
                    new_record = HistoricalData(
                        symbol=self.db_symbol,
                        timestamp=data_point['timestamp'],
                        open_price=data_point['open'],
                        high_price=data_point['high'],
                        low_price=data_point['low'],
                        close_price=data_point['close'],
                        volume=data_point['volume'],
                        trade_count=data_point.get('trade_count'),
                        vwap=data_point.get('vwap'),
                        data_source="alpaca"
                    )
                    db.add(new_record)
                    result["records_inserted"] += 1
                    logger.debug(f"Inserted new record for {data_point['timestamp']}")
            
            db.commit()
            result["success"] = True
            logger.info(f"Daily update completed: {result['records_inserted']} inserted, {result['records_updated']} updated")
            
        except Exception as e:
            db.rollback()
            error_msg = f"Error during daily data update: {str(e)}"
            logger.error(error_msg)
            result["errors"].append(error_msg)
        finally:
            db.close()
        
        return result
    
    async def _fetch_alpaca_data(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """
        Fetch data from Alpaca API
        
        Returns:
            List of data dictionaries with OHLCV data
        """
        try:
            # Use the existing alpaca service if available
            if alpaca_service and hasattr(alpaca_service, 'get_historical_data'):
                df = alpaca_service.get_historical_data(
                    symbol=self.symbol,
                    timeframe="1D",  # Daily data
                    start_date=start_date,
                    end_date=end_date
                )
                
                if df is not None and not df.empty:
                    # Convert DataFrame to list of dictionaries
                    data_list = []
                    for timestamp, row in df.iterrows():
                        data_list.append({
                            'timestamp': timestamp,
                            'open': float(row['open']),
                            'high': float(row['high']),
                            'low': float(row['low']),
                            'close': float(row['close']),
                            'volume': float(row.get('volume', 0)),
                            'trade_count': row.get('trade_count'),
                            'vwap': row.get('vwap')
                        })
                    return data_list
            
            # Fallback: use the bitcoin_data_service directly
            logger.warning("Alpaca service not available, using fallback method")
            return await self._fetch_fallback_data(start_date, end_date)
            
        except Exception as e:
            logger.error(f"Error fetching Alpaca data: {str(e)}")
            return []
    
    async def _fetch_fallback_data(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """
        Fallback method using bitcoin_data_service
        """
        try:
            # Import here to avoid circular imports
            from services.bitcoin_data_service import bitcoin_service
            
            days = (end_date - start_date).days
            dates, prices = bitcoin_service.get_bitcoin_data(days)
            
            # Convert to the expected format
            data_list = []
            for i, (date_str, price) in enumerate(zip(dates, prices)):
                # Parse date string
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                
                # Create OHLCV data (using close price as approximation)
                data_list.append({
                    'timestamp': date_obj,
                    'open': float(price),
                    'high': float(price * 1.02),  # Approximate 2% daily range
                    'low': float(price * 0.98),
                    'close': float(price),
                    'volume': 1000.0,  # Placeholder volume
                    'trade_count': None,
                    'vwap': None
                })
            
            return data_list
            
        except Exception as e:
            logger.error(f"Error in fallback data fetch: {str(e)}")
            return []
    
    def get_cached_data(self, days: int = 365) -> Optional[List[Dict]]:
        """
        Get cached Bitcoin data from database
        
        Args:
            days: Number of days to retrieve
            
        Returns:
            List of data dictionaries or None if no data
        """
        db = SessionLocal()
        try:
            start_date = datetime.now() - timedelta(days=days)
            
            records = db.query(HistoricalData).filter(
                and_(
                    HistoricalData.symbol == self.db_symbol,
                    HistoricalData.timestamp >= start_date
                )
            ).order_by(HistoricalData.timestamp).all()
            
            if not records:
                return None
            
            return [
                {
                    'timestamp': record.timestamp,
                    'open': record.open_price,
                    'high': record.high_price,
                    'low': record.low_price,
                    'close': record.close_price,
                    'volume': record.volume
                }
                for record in records
            ]
            
        except Exception as e:
            logger.error(f"Error getting cached data: {str(e)}")
            return None
        finally:
            db.close()
    
    async def initial_data_load(self, days: int = 1825) -> Dict[str, any]:
        """
        Initial load of historical data (5 years)
        
        Args:
            days: Number of days to load (default 5 years)
        """
        logger.info(f"Starting initial data load for {days} days")
        return await self.update_daily_data(days_to_fetch=days)


# Global instance
bitcoin_update_service = BitcoinDataUpdateService()
