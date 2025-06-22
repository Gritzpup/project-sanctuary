from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.trade import Trade, TradeSession
from datetime import datetime, timedelta
from typing import Optional, List
import logging
from app.services.trade_history_service import sync_trade_history

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/history")
async def get_trades_history(
    days: int = Query(30, description="Number of days to look back"),
    strategy_name: Optional[str] = Query(None, description="Filter by strategy name"),
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    limit: int = Query(100, description="Maximum number of trades to return"),
    db: Session = Depends(get_db)
):
    """Get trading history with optional filters"""
    try:
        # Calculate start date
        start_date = datetime.now() - timedelta(days=days)
        
        # Build query
        query = db.query(Trade).filter(Trade.timestamp >= start_date)
        
        # Apply filters
        if strategy_name:
            query = query.filter(Trade.strategy_name == strategy_name)
        if symbol:
            query = query.filter(Trade.symbol == symbol)
        
        # Order by timestamp descending and limit
        trades = query.order_by(Trade.timestamp.desc()).limit(limit).all()        # Format response
        trades_data = []
        for trade in trades:
            # Calculate effective fee based on maker/taker status
            is_maker = bool(trade.is_maker_order)
            effective_fee_rate = trade.maker_fee_rate if is_maker else trade.taker_fee_rate
            trade_value = trade.quantity * trade.price
            calculated_fee = trade_value * effective_fee_rate
            
            trades_data.append({
                "id": trade.id,
                "symbol": trade.symbol,
                "strategy_name": trade.strategy_name,
                "side": trade.side,
                "quantity": trade.quantity,
                "price": trade.price,
                "timestamp": trade.timestamp.isoformat(),
                "order_id": trade.order_id,
                "status": trade.status,
                "commission": trade.commission,
                "maker_fee_rate": trade.maker_fee_rate,
                "taker_fee_rate": trade.taker_fee_rate,
                "is_maker_order": trade.is_maker_order,
                "rebalance_triggered": trade.rebalance_triggered,
                "effective_fee_rate": effective_fee_rate,
                "calculated_fee": calculated_fee,
                "trade_value": trade_value
            })
        
        return {
            "trades": trades_data,
            "total_count": len(trades_data),
            "days_requested": days,
            "filters_applied": {
                "strategy_name": strategy_name,
                "symbol": symbol
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting trades history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary")
async def get_trades_summary(
    days: int = Query(30, description="Number of days to analyze"),
    strategy_name: Optional[str] = Query(None, description="Filter by strategy name"),
    db: Session = Depends(get_db)
):
    """Get trading summary statistics"""
    try:
        # Calculate start date
        start_date = datetime.now() - timedelta(days=days)
        
        # Build query
        query = db.query(Trade).filter(Trade.timestamp >= start_date)
        
        if strategy_name:
            query = query.filter(Trade.strategy_name == strategy_name)
        
        trades = query.all()
        
        if not trades:
            return {
                "total_trades": 0,
                "buy_trades": 0,
                "sell_trades": 0,
                "total_volume": 0.0,
                "total_fees": 0.0,
                "average_trade_size": 0.0,
                "days_analyzed": days,
                "strategy_name": strategy_name
            }
        
        # Calculate statistics
        buy_trades = [t for t in trades if t.side.lower() == 'buy']
        sell_trades = [t for t in trades if t.side.lower() == 'sell']
        
        total_volume = sum(t.quantity * t.price for t in trades)
        total_fees = sum(t.commission for t in trades)
        
        # Calculate average trade size
        average_trade_size = sum(t.quantity for t in trades) / len(trades) if trades else 0.0
        
        return {
            "total_trades": len(trades),
            "buy_trades": len(buy_trades),
            "sell_trades": len(sell_trades),
            "total_volume": total_volume,
            "total_fees": total_fees,
            "average_trade_size": average_trade_size,
            "days_analyzed": days,
            "strategy_name": strategy_name,
            "date_range": {
                "start": start_date.isoformat(),
                "end": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting trades summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions")
async def get_trade_sessions(
    days: int = Query(30, description="Number of days to look back"),
    strategy_name: Optional[str] = Query(None, description="Filter by strategy name"),
    status: Optional[str] = Query(None, description="Filter by session status (open/closed)"),
    db: Session = Depends(get_db)
):
    """Get trade sessions (entry/exit pairs)"""
    try:
        # Calculate start date
        start_date = datetime.now() - timedelta(days=days)
        
        # Build query
        query = db.query(TradeSession).filter(TradeSession.entry_time >= start_date)
        
        # Apply filters
        if strategy_name:
            query = query.filter(TradeSession.strategy_name == strategy_name)
        if status:
            query = query.filter(TradeSession.status == status)
        
        # Order by entry time descending
        sessions = query.order_by(TradeSession.entry_time.desc()).all()
          # Format response
        sessions_data = []
        for session in sessions:
            exit_time_iso = session.exit_time.isoformat() if session.exit_time is not None else None
            duration_hours = None
            if session.exit_time is not None:
                duration_hours = (session.exit_time - session.entry_time).total_seconds() / 3600
            
            profit_percentage = None
            if session.exit_price is not None and session.entry_price is not None:
                profit_percentage = ((session.exit_price - session.entry_price) / session.entry_price * 100)
            
            sessions_data.append({
                "id": session.id,
                "strategy_name": session.strategy_name,
                "entry_price": session.entry_price,
                "exit_price": session.exit_price,
                "entry_time": session.entry_time.isoformat(),
                "exit_time": exit_time_iso,
                "quantity": session.quantity,
                "profit_loss": session.profit_loss,
                "vault_allocation": session.vault_allocation,
                "status": session.status,
                "is_backtest": session.is_backtest,
                "duration_hours": duration_hours,
                "profit_percentage": profit_percentage
            })
        
        return {
            "sessions": sessions_data,
            "total_count": len(sessions_data),
            "days_requested": days,
            "filters_applied": {
                "strategy_name": strategy_name,
                "status": status
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting trade sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{trade_id}")
async def get_trade_by_id(trade_id: int, db: Session = Depends(get_db)):
    """Get a specific trade by ID"""
    try:
        trade = db.query(Trade).filter(Trade.id == trade_id).first()
        
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")
          # Calculate effective fee
        is_maker = bool(trade.is_maker_order)
        effective_fee_rate = trade.maker_fee_rate if is_maker else trade.taker_fee_rate
        trade_value = trade.quantity * trade.price
        calculated_fee = trade_value * effective_fee_rate
        
        return {
            "id": trade.id,
            "symbol": trade.symbol,
            "strategy_name": trade.strategy_name,
            "side": trade.side,
            "quantity": trade.quantity,
            "price": trade.price,
            "timestamp": trade.timestamp.isoformat(),
            "order_id": trade.order_id,
            "status": trade.status,
            "commission": trade.commission,
            "maker_fee_rate": trade.maker_fee_rate,
            "taker_fee_rate": trade.taker_fee_rate,
            "is_maker_order": trade.is_maker_order,
            "rebalance_triggered": trade.rebalance_triggered,
            "effective_fee_rate": effective_fee_rate,
            "calculated_fee": calculated_fee,
            "trade_value": trade_value
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting trade {trade_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
async def create_trade(
    symbol: str,
    strategy_name: str,
    side: str,
    quantity: float,
    price: float,
    order_id: Optional[str] = None,
    status: str = "pending",
    commission: float = 0.0,
    maker_fee_rate: float = 0.006,
    taker_fee_rate: float = 0.012,
    is_maker_order: bool = False,
    rebalance_triggered: bool = False,
    db: Session = Depends(get_db)
):
    """Create a new trade record"""
    try:
        trade = Trade(
            symbol=symbol,
            strategy_name=strategy_name,
            side=side.lower(),
            quantity=quantity,
            price=price,
            order_id=order_id,
            status=status,
            commission=commission,
            maker_fee_rate=maker_fee_rate,
            taker_fee_rate=taker_fee_rate,
            is_maker_order=is_maker_order,
            rebalance_triggered=rebalance_triggered
        )
        
        db.add(trade)
        db.commit()
        db.refresh(trade)
        
        logger.info(f"Created trade {trade.id}: {side} {quantity} {symbol} at {price}")
        
        return {
            "id": trade.id,
            "message": "Trade created successfully",
            "trade": {
                "id": trade.id,
                "symbol": trade.symbol,
                "strategy_name": trade.strategy_name,
                "side": trade.side,
                "quantity": trade.quantity,
                "price": trade.price,
                "timestamp": trade.timestamp.isoformat()
            }
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating trade: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync")
async def sync_trades(days: int = Query(30, description="Number of days of trades to sync")):
    """Sync trade history from Alpaca into database"""
    synced_count = await sync_trade_history(days)
    return {"synced": synced_count}
