"""
API Routes for Alpaca Orders Management
Handles Alpaca order tracking and lifecycle management
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, func, asc, or_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.models.alpaca_order import AlpacaOrder, OrderStatus, OrderSide, OrderType

def safe_float(value: Any, default: float = 0.0) -> float:
    """Safely convert any value to float, handling None and SQLAlchemy objects"""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int(value: Any, default: int = 0) -> int:
    """Safely convert any value to int, handling None and SQLAlchemy objects"""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_str(value: Any, default: str = "") -> str:
    """Safely convert any value to string, handling None and SQLAlchemy objects"""
    if value is None:
        return default
    try:
        return str(value)
    except (ValueError, TypeError):
        return default

router = APIRouter(prefix="/api/alpaca-orders", tags=["alpaca-orders"])

class AlpacaOrderCreate(BaseModel):
    order_id: str
    client_order_id: Optional[str] = None
    account_id: Optional[str] = None
    symbol: str
    side: OrderSide
    order_type: OrderType = OrderType.MARKET
    time_in_force: str = "day"
    qty: float
    filled_qty: float = 0.0
    remaining_qty: Optional[float] = None
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    filled_avg_price: Optional[float] = None
    filled_at: Optional[datetime] = None
    notional_value: float = 0.0
    status: OrderStatus = OrderStatus.PENDING
    strategy_name: Optional[str] = None
    trading_mode: str = "paper"
    user_session: Optional[str] = None
    is_backtest: bool = False
    commission: float = 0.0
    fee: float = 0.0
    notes: Optional[str] = None

class AlpacaOrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    filled_qty: Optional[float] = None
    remaining_qty: Optional[float] = None
    filled_avg_price: Optional[float] = None
    filled_at: Optional[datetime] = None
    notional_value: Optional[float] = None
    commission: Optional[float] = None
    fee: Optional[float] = None
    notes: Optional[str] = None

@router.get("/")
async def get_alpaca_orders(
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    side: Optional[OrderSide] = Query(None, description="Filter by order side"),
    status: Optional[OrderStatus] = Query(None, description="Filter by order status"),
    strategy: Optional[str] = Query(None, description="Filter by strategy"),
    trading_mode: Optional[str] = Query(None, description="Filter by trading mode"),
    user_session: Optional[str] = Query(None, description="Filter by user session"),
    account_id: Optional[str] = Query(None, description="Filter by account ID"),
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    active_only: bool = Query(False, description="Only return active orders"),
    backtest_only: bool = Query(False, description="Only return backtest orders"),
    limit: int = Query(100, description="Number of records to return"),
    offset: int = Query(0, description="Number of records to skip"),
    order_by: str = Query("created_at", description="Field to order by"),
    order_desc: bool = Query(True, description="Order descending"),
    db: Session = Depends(get_db)
):
    """Get Alpaca orders with comprehensive filtering options"""
    try:
        query = db.query(AlpacaOrder)
        
        # Apply filters
        if symbol:
            query = query.filter(AlpacaOrder.symbol == symbol.upper())
        
        if side:
            query = query.filter(AlpacaOrder.side == side)
        
        if status:
            query = query.filter(AlpacaOrder.status == status)
        
        if strategy:
            query = query.filter(AlpacaOrder.strategy_name == strategy)
        
        if trading_mode:
            query = query.filter(AlpacaOrder.trading_mode == trading_mode)
        
        if user_session:
            query = query.filter(AlpacaOrder.user_session == user_session)
        
        if account_id:
            query = query.filter(AlpacaOrder.account_id == account_id)
        
        if start_date:
            query = query.filter(AlpacaOrder.created_at >= start_date)
        
        if end_date:
            query = query.filter(AlpacaOrder.created_at <= end_date)
        
        if active_only:
            active_statuses = [OrderStatus.PENDING, OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED, 
                             OrderStatus.ACCEPTED, OrderStatus.PENDING_NEW, OrderStatus.PENDING_CANCEL]
            query = query.filter(AlpacaOrder.status.in_(active_statuses))
        
        if backtest_only:
            query = query.filter(AlpacaOrder.is_backtest == True)
        
        # Apply ordering
        order_field = getattr(AlpacaOrder, order_by, AlpacaOrder.created_at)
        if order_desc:
            query = query.order_by(desc(order_field))
        else:
            query = query.order_by(asc(order_field))
        
        # Apply pagination
        query = query.offset(offset).limit(limit)
        
        orders = query.all()
        
        return {
            "orders": orders,
            "count": len(orders),
            "offset": offset,
            "limit": limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching orders: {str(e)}")

@router.post("/")
async def create_alpaca_order(
    order: AlpacaOrderCreate,
    db: Session = Depends(get_db)
):
    """Create a new Alpaca order record"""
    try:
        # Set remaining_qty if not provided
        if order.remaining_qty is None:
            order.remaining_qty = order.qty - order.filled_qty
        
        # Calculate notional value if not provided
        if order.notional_value == 0.0 and order.filled_avg_price:
            order.notional_value = order.filled_qty * order.filled_avg_price
        elif order.notional_value == 0.0 and order.limit_price:
            order.notional_value = order.qty * order.limit_price
        
        db_order = AlpacaOrder(**order.dict())
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        return {
            "message": "Alpaca order created successfully",
            "order": db_order
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating order: {str(e)}")

@router.get("/{order_id}")
async def get_alpaca_order(
    order_id: str,
    db: Session = Depends(get_db)
):
    """Get specific Alpaca order by order_id"""
    try:
        order = db.query(AlpacaOrder).filter(AlpacaOrder.order_id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        return order
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching order: {str(e)}")

@router.put("/{order_id}")
async def update_alpaca_order(
    order_id: str,
    updates: AlpacaOrderUpdate,
    db: Session = Depends(get_db)
):
    """Update Alpaca order"""
    try:
        order = db.query(AlpacaOrder).filter(AlpacaOrder.order_id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
          # Use SQL update to avoid Column assignment issues
        update_data = updates.dict(exclude_unset=True)
        
        if update_data:
            # Convert dict keys to Column objects for SQLAlchemy update
            column_update_data = {}
            for key, value in update_data.items():
                if hasattr(AlpacaOrder, key):
                    column_update_data[getattr(AlpacaOrder, key)] = value
            
            db.query(AlpacaOrder).filter(AlpacaOrder.order_id == order_id).update(column_update_data)
            
            # Calculate remaining quantity if needed
            if 'filled_qty' in update_data:
                remaining = safe_float(order.qty) - safe_float(update_data.get('filled_qty', order.filled_qty))
                db.query(AlpacaOrder).filter(AlpacaOrder.order_id == order_id).update(
                    {AlpacaOrder.remaining_qty: remaining}
                )
            
            # Calculate notional value if filled_avg_price is updated
            if 'filled_avg_price' in update_data and safe_float(order.filled_qty) > 0:
                notional = safe_float(order.filled_qty) * safe_float(update_data.get('filled_avg_price', order.filled_avg_price))
                db.query(AlpacaOrder).filter(AlpacaOrder.order_id == order_id).update(
                    {AlpacaOrder.notional_value: notional}
                )
        
        db.commit()
        db.refresh(order)
        
        return {
            "message": "Order updated successfully",
            "order": order
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating order: {str(e)}")

@router.delete("/{order_id}")
async def delete_alpaca_order(
    order_id: str,
    db: Session = Depends(get_db)
):
    """Delete Alpaca order"""
    try:
        order = db.query(AlpacaOrder).filter(AlpacaOrder.order_id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        db.delete(order)
        db.commit()
        
        return {"message": "Order deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting order: {str(e)}")

@router.get("/analytics/summary")
async def get_order_analytics_summary(
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    strategy: Optional[str] = Query(None, description="Filter by strategy"),
    trading_mode: Optional[str] = Query(None, description="Filter by trading mode"),
    user_session: Optional[str] = Query(None, description="Filter by user session"),
    days: int = Query(30, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """Get comprehensive order analytics and statistics"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        query = db.query(AlpacaOrder).filter(
            AlpacaOrder.created_at >= start_date,
            AlpacaOrder.created_at <= end_date
        )
        
        # Apply filters
        if symbol:
            query = query.filter(AlpacaOrder.symbol == symbol.upper())
        
        if strategy:
            query = query.filter(AlpacaOrder.strategy_name == strategy)
        
        if trading_mode:
            query = query.filter(AlpacaOrder.trading_mode == trading_mode)
        
        if user_session:
            query = query.filter(AlpacaOrder.user_session == user_session)
        
        orders = query.all()
        
        if not orders:
            return {
                "message": "No orders found for the specified period",
                "period_days": days,
                "analytics": {}
            }
        
        # Calculate basic metrics using safe conversion functions
        total_qty = sum(safe_float(o.qty) for o in orders)
        filled_qty = sum(safe_float(o.filled_qty) for o in orders)
        total_notional = sum(safe_float(o.notional_value) for o in orders if o.notional_value is not None and safe_float(o.notional_value) > 0)
        notional_orders = [o for o in orders if o.notional_value is not None and safe_float(o.notional_value) > 0]
        avg_notional = total_notional / len(notional_orders) if notional_orders else 0
        
        # Fee analysis
        total_fees = sum(safe_float(o.fee) for o in orders if o.fee is not None and safe_float(o.fee) > 0)
        total_commissions = sum(safe_float(o.commission) for o in orders if o.commission is not None and safe_float(o.commission) > 0)
        
        # Strategy breakdown
        strategy_stats = {}
        for order in orders:
            strategy = safe_str(order.strategy_name, "unknown")
            if strategy not in strategy_stats:
                strategy_stats[strategy] = {
                    "orders": 0,
                    "total_qty": 0.0,
                    "filled_qty": 0.0,
                    "total_notional": 0.0
                }
            
            strategy_stats[strategy]["orders"] += 1
            strategy_stats[strategy]["total_qty"] += safe_float(order.qty)
            strategy_stats[strategy]["filled_qty"] += safe_float(order.filled_qty)
            strategy_stats[strategy]["total_notional"] += safe_float(order.notional_value)
        
        # Symbol breakdown
        symbol_stats = {}
        for order in orders:
            symbol = safe_str(order.symbol)
            if symbol not in symbol_stats:
                symbol_stats[symbol] = {
                    "orders": 0,
                    "buy_orders": 0,
                    "sell_orders": 0,
                    "total_qty": 0.0,
                    "filled_qty": 0.0                }
            
            symbol_stats[symbol]["orders"] += 1
            if order.side.value == OrderSide.BUY.value:
                symbol_stats[symbol]["buy_orders"] += 1
            else:
                symbol_stats[symbol]["sell_orders"] += 1
            
            symbol_stats[symbol]["total_qty"] += safe_float(order.qty)
            symbol_stats[symbol]["filled_qty"] += safe_float(order.filled_qty)
        
        # Order status distribution
        status_distribution = {}
        for order in orders:
            status = order.status.value if hasattr(order.status, 'value') else str(order.status)
            status_distribution[status] = status_distribution.get(status, 0) + 1
        
        # Side distribution
        buy_orders = [o for o in orders if o.side.value == OrderSide.BUY.value]
        sell_orders = [o for o in orders if o.side.value == OrderSide.SELL.value]
        
        analytics = {
            "period_analysis": {
                "days_analyzed": days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_orders": len(orders)
            },
            "volume_metrics": {
                "total_quantity": round(total_qty, 2),
                "filled_quantity": round(filled_qty, 2),
                "fill_rate_pct": round((filled_qty / total_qty * 100) if total_qty > 0 else 0, 2),
                "total_notional_value": round(total_notional, 2),
                "avg_notional_per_order": round(avg_notional, 2)
            },
            "cost_analysis": {
                "total_fees": round(total_fees, 2),
                "total_commissions": round(total_commissions, 2),
                "avg_fee_per_order": round(total_fees / len(orders), 4) if orders else 0,
                "fee_to_notional_ratio": round((total_fees / total_notional * 100) if total_notional > 0 else 0, 4)
            },
            "distribution": {
                "by_status": status_distribution,
                "by_side": {
                    "buy_orders": len(buy_orders),
                    "sell_orders": len(sell_orders),
                    "total_buy_volume": sum(safe_float(o.filled_qty) for o in buy_orders),
                    "total_sell_volume": sum(safe_float(o.filled_qty) for o in sell_orders),
                    "total_buy_notional": sum(safe_float(o.notional_value) for o in buy_orders if o.notional_value is not None and safe_float(o.notional_value) > 0),
                    "total_sell_notional": sum(safe_float(o.notional_value) for o in sell_orders if o.notional_value is not None and safe_float(o.notional_value) > 0)
                },
                "by_strategy": strategy_stats,
                "by_symbol": symbol_stats
            }
        }
        
        return {
            "analytics": analytics,
            "period_days": days
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating order analytics: {str(e)}")

@router.get("/recent")
async def get_recent_orders(
    limit: int = Query(20, description="Number of recent orders to return"),
    db: Session = Depends(get_db)
):
    """Get most recent orders with key information"""
    try:
        orders = db.query(AlpacaOrder).order_by(desc(AlpacaOrder.created_at)).limit(limit).all()
        
        recent_orders = []
        for order in orders:
            recent_orders.append({
                "order_id": order.order_id,
                "symbol": order.symbol,
                "side": order.side.value if hasattr(order.side, 'value') else str(order.side),
                "order_type": order.order_type.value if hasattr(order.order_type, 'value') else str(order.order_type),
                "status": order.status.value if hasattr(order.status, 'value') else str(order.status),
                "quantity": safe_float(order.qty),
                "filled_quantity": safe_float(order.filled_qty),
                "remaining_quantity": safe_float(order.remaining_qty) if order.remaining_qty is not None else 0,
                "filled_avg_price": safe_float(order.filled_avg_price) if order.filled_avg_price is not None else None,
                "notional_value": safe_float(order.notional_value),
                "strategy": order.strategy_name,
                "trading_mode": order.trading_mode,
                "created_at": order.created_at.isoformat(),
                "filled_at": order.filled_at.isoformat() if order.filled_at is not None else None,
                "is_backtest": bool(order.is_backtest),
                "description": f"Order filled at ${safe_float(order.filled_avg_price)} avg price" if order.filled_avg_price is not None else "Order filled"
            })
        
        return {
            "recent_orders": recent_orders,
            "count": len(recent_orders),
            "limit": limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching recent orders: {str(e)}")