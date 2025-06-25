"""
API Routes for Vault History Management
Handles vault performance tracking and historical analysis
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, func, asc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.models.vault_history import VaultHistory

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

router = APIRouter(prefix="/api/vault-history", tags=["vault-history"])

class VaultHistoryCreate(BaseModel):
    btc_price: float
    btc_price_source: str = "alpaca"
    vault_value_usd: float
    vault_btc_amount: float = 0.0
    vault_allocation_pct: float = 20.0
    performance_vs_hold: float = 0.0
    trading_balance_usd: float = 0.0
    total_portfolio_value: float = 0.0
    monthly_growth_rate: float = 0.0
    annualized_return: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    active_strategy: Optional[str] = None
    trading_mode: str = "backtest"
    total_trades_count: int = 0
    successful_trades_count: int = 0
    rebalance_triggered: bool = False
    profit_allocation_event: bool = False
    manual_adjustment: bool = False
    user_session: Optional[str] = None
    notes: Optional[str] = None
    data_quality: str = "good"

class VaultHistoryUpdate(BaseModel):
    btc_price: Optional[float] = None
    vault_value_usd: Optional[float] = None
    vault_btc_amount: Optional[float] = None
    performance_vs_hold: Optional[float] = None
    trading_balance_usd: Optional[float] = None
    total_portfolio_value: Optional[float] = None
    monthly_growth_rate: Optional[float] = None
    annualized_return: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    max_drawdown: Optional[float] = None
    active_strategy: Optional[str] = None
    trading_mode: Optional[str] = None
    total_trades_count: Optional[int] = None
    successful_trades_count: Optional[int] = None
    rebalance_triggered: Optional[bool] = None
    profit_allocation_event: Optional[bool] = None
    manual_adjustment: Optional[bool] = None
    notes: Optional[str] = None
    data_quality: Optional[str] = None

@router.get("/")
async def get_vault_history(
    user_session: Optional[str] = Query(None, description="Filter by user session"),
    trading_mode: Optional[str] = Query(None, description="Filter by trading mode"),
    strategy: Optional[str] = Query(None, description="Filter by strategy"),
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    limit: int = Query(100, description="Number of records to return"),
    offset: int = Query(0, description="Number of records to skip"),
    order_by: str = Query("timestamp", description="Field to order by"),
    order_desc: bool = Query(True, description="Order descending"),
    db: Session = Depends(get_db)
):
    """Get vault history with filtering options"""
    try:
        query = db.query(VaultHistory)
        
        # Apply filters
        if user_session:
            query = query.filter(VaultHistory.user_session == user_session)
        
        if trading_mode:
            query = query.filter(VaultHistory.trading_mode == trading_mode)
        
        if strategy:
            query = query.filter(VaultHistory.active_strategy == strategy)
        
        if start_date:
            query = query.filter(VaultHistory.timestamp >= start_date)
        
        if end_date:
            query = query.filter(VaultHistory.timestamp <= end_date)
        
        # Apply ordering
        order_field = getattr(VaultHistory, order_by, VaultHistory.timestamp)
        if order_desc:
            query = query.order_by(desc(order_field))
        else:
            query = query.order_by(asc(order_field))
        
        # Apply pagination
        query = query.offset(offset).limit(limit)
        
        records = query.all()
        
        return {
            "records": records,
            "count": len(records),
            "offset": offset,
            "limit": limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching vault history: {str(e)}")

@router.post("/")
async def create_vault_history_record(
    record: VaultHistoryCreate,
    db: Session = Depends(get_db)
):
    """Create a new vault history record"""
    try:
        db_record = VaultHistory(**record.dict())
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        
        return {
            "message": "Vault history record created successfully",
            "record": db_record
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating vault history record: {str(e)}")

@router.get("/{record_id}")
async def get_vault_history_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    """Get specific vault history record by ID"""
    try:
        record = db.query(VaultHistory).filter(VaultHistory.id == record_id).first()
        
        if not record:
            raise HTTPException(status_code=404, detail="Vault history record not found")
        
        return record
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching vault history record: {str(e)}")

@router.put("/{record_id}")
async def update_vault_history_record(
    record_id: int,
    updates: VaultHistoryUpdate,
    db: Session = Depends(get_db)
):
    """Update vault history record"""
    try:
        record = db.query(VaultHistory).filter(VaultHistory.id == record_id).first()
        
        if not record:
            raise HTTPException(status_code=404, detail="Vault history record not found")
        
        # Update only provided fields
        update_data = updates.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(record, field, value)
        
        db.commit()
        db.refresh(record)
        
        return {
            "message": "Vault history record updated successfully",
            "record": record
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating vault history record: {str(e)}")

@router.delete("/{record_id}")
async def delete_vault_history_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    """Delete vault history record"""
    try:
        record = db.query(VaultHistory).filter(VaultHistory.id == record_id).first()
        
        if not record:
            raise HTTPException(status_code=404, detail="Vault history record not found")
        
        db.delete(record)
        db.commit()
        
        return {"message": "Vault history record deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting vault history record: {str(e)}")

@router.get("/analytics/performance")
async def get_vault_performance_analytics(
    user_session: Optional[str] = Query(None, description="Filter by user session"),
    trading_mode: Optional[str] = Query(None, description="Filter by trading mode"),
    days: int = Query(30, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """Get vault performance analytics and metrics"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        query = db.query(VaultHistory).filter(
            VaultHistory.timestamp >= start_date,
            VaultHistory.timestamp <= end_date
        )
        
        if user_session:
            query = query.filter(VaultHistory.user_session == user_session)
        
        if trading_mode:
            query = query.filter(VaultHistory.trading_mode == trading_mode)
        
        records = query.order_by(asc(VaultHistory.timestamp)).all()
        
        if not records:
            return {
                "message": "No data available for the specified period",
                "period_days": days,
                "analytics": {}
            }        # Calculate analytics
        initial_value = safe_float(records[0].vault_value_usd)
        final_value = safe_float(records[-1].vault_value_usd)
        
        total_return = ((final_value - initial_value) / initial_value * 100) if initial_value > 0 else 0
        
        # Performance vs hold calculation
        performance_vs_hold_values = [safe_float(r.performance_vs_hold) for r in records if r.performance_vs_hold is not None]
        avg_performance_vs_hold = sum(performance_vs_hold_values) / len(performance_vs_hold_values) if performance_vs_hold_values else 0
        
        # BTC correlation
        btc_prices = [safe_float(r.btc_price) for r in records]
        vault_values = [safe_float(r.vault_value_usd) for r in records]
        
        # Simple correlation calculation (Pearson)
        if len(btc_prices) > 1:
            mean_btc = sum(btc_prices) / len(btc_prices)
            mean_vault = sum(vault_values) / len(vault_values)
            
            numerator = sum((btc_prices[i] - mean_btc) * (vault_values[i] - mean_vault) for i in range(len(btc_prices)))
            btc_variance = sum((price - mean_btc) ** 2 for price in btc_prices)
            vault_variance = sum((value - mean_vault) ** 2 for value in vault_values)
            
            btc_correlation = numerator / (btc_variance * vault_variance) ** 0.5 if btc_variance > 0 and vault_variance > 0 else 0
        else:
            btc_correlation = 0        # Max drawdown calculation
        peak = safe_float(records[0].vault_value_usd)
        max_drawdown = 0.0
        for record in records:
            current_value = safe_float(record.vault_value_usd)
            if current_value > peak:
                peak = current_value
            drawdown = (peak - current_value) / peak * 100 if peak > 0 else 0
            max_drawdown = max(max_drawdown, drawdown)
        
        # Trading activity stats
        total_trades = sum(safe_int(r.total_trades_count) for r in records)
        successful_trades = sum(safe_int(r.successful_trades_count) for r in records)
        win_rate = (successful_trades / total_trades * 100) if total_trades > 0 else 0
          # Recent performance metrics
        latest_record = records[-1]
        
        analytics = {
            "period_analysis": {
                "days_analyzed": days,
                "records_count": len(records),
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },            "value_metrics": {
                "initial_vault_value": initial_value,
                "final_vault_value": final_value,
                "total_return_pct": round(total_return, 2),
                "current_btc_price": safe_float(latest_record.btc_price),
                "vault_allocation_pct": safe_float(latest_record.vault_allocation_pct)
            },
            "performance_metrics": {
                "avg_performance_vs_hold": round(avg_performance_vs_hold, 2),
                "btc_correlation": round(btc_correlation, 3),
                "max_drawdown_pct": round(max_drawdown, 2),
                "current_sharpe_ratio": safe_float(latest_record.sharpe_ratio),
                "annualized_return": safe_float(latest_record.annualized_return)
            },
            "trading_activity": {
                "total_trades": total_trades,
                "successful_trades": successful_trades,
                "win_rate_pct": round(win_rate, 2),
                "current_strategy": latest_record.active_strategy,
                "trading_mode": latest_record.trading_mode
            },
            "recent_events": {
                "rebalance_triggered": bool(latest_record.rebalance_triggered),
                "profit_allocation_event": bool(latest_record.profit_allocation_event),
                "manual_adjustment": bool(latest_record.manual_adjustment)
            }
        }
        
        return {
            "analytics": analytics,
            "period_days": days,
            "last_updated": latest_record.timestamp.isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating vault analytics: {str(e)}")

@router.get("/analytics/correlation")
async def get_btc_correlation_analysis(
    user_session: Optional[str] = Query(None, description="Filter by user session"),
    days: int = Query(30, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """Get detailed BTC correlation analysis"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        query = db.query(VaultHistory).filter(
            VaultHistory.timestamp >= start_date,
            VaultHistory.timestamp <= end_date
        )
        
        if user_session:
            query = query.filter(VaultHistory.user_session == user_session)
        
        records = query.order_by(asc(VaultHistory.timestamp)).all()
        
        if len(records) < 2:
            return {
                "message": "Insufficient data for correlation analysis",
                "required_records": 2,
                "available_records": len(records)
            }        # Prepare data for analysis
        correlation_data = []
        for record in records:
            correlation_data.append({
                "timestamp": record.timestamp.isoformat(),
                "btc_price": safe_float(record.btc_price),
                "vault_value": safe_float(record.vault_value_usd),
                "performance_vs_hold": safe_float(record.performance_vs_hold)
            })
        
        # Calculate various correlation metrics
        btc_prices = [safe_float(r.btc_price) for r in records]
        vault_values = [safe_float(r.vault_value_usd) for r in records]
        
        # Price change correlations
        btc_changes = [(btc_prices[i+1] - btc_prices[i]) / btc_prices[i] * 100 for i in range(len(btc_prices)-1)]
        vault_changes = [(vault_values[i+1] - vault_values[i]) / vault_values[i] * 100 for i in range(len(vault_values)-1)]
        
        if len(btc_changes) > 0:
            mean_btc_change = sum(btc_changes) / len(btc_changes)
            mean_vault_change = sum(vault_changes) / len(vault_changes)
            
            change_correlation_numerator = sum((btc_changes[i] - mean_btc_change) * (vault_changes[i] - mean_vault_change) for i in range(len(btc_changes)))
            btc_change_variance = sum((change - mean_btc_change) ** 2 for change in btc_changes)
            vault_change_variance = sum((change - mean_vault_change) ** 2 for change in vault_changes)
            
            change_correlation = change_correlation_numerator / (btc_change_variance * vault_change_variance) ** 0.5 if btc_change_variance > 0 and vault_change_variance > 0 else 0
        else:
            change_correlation = 0
        
        return {
            "correlation_analysis": {
                "price_change_correlation": round(change_correlation, 3),
                "analysis_period_days": days,
                "data_points": len(records),
                "avg_btc_price": round(sum(btc_prices) / len(btc_prices), 2),
                "avg_vault_value": round(sum(vault_values) / len(vault_values), 2)
            },
            "time_series_data": correlation_data[-50:],  # Last 50 data points
            "summary": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "btc_price_range": {
                    "min": min(btc_prices),
                    "max": max(btc_prices)
                },
                "vault_value_range": {
                    "min": min(vault_values),
                    "max": max(vault_values)
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating BTC correlation: {str(e)}")

@router.post("/snapshot")
async def create_vault_snapshot(
    btc_price: float,
    vault_value_usd: float,
    trading_balance_usd: float = 0.0,
    active_strategy: Optional[str] = None,
    trading_mode: str = "paper",
    user_session: Optional[str] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Create a quick vault performance snapshot"""
    try:
        # Calculate derived metrics
        total_portfolio_value = vault_value_usd + trading_balance_usd
        vault_allocation_pct = (vault_value_usd / total_portfolio_value * 100) if total_portfolio_value > 0 else 0
        
        # Create snapshot record
        snapshot = VaultHistory(
            btc_price=btc_price,
            vault_value_usd=vault_value_usd,
            trading_balance_usd=trading_balance_usd,
            total_portfolio_value=total_portfolio_value,
            vault_allocation_pct=vault_allocation_pct,
            active_strategy=active_strategy,
            trading_mode=trading_mode,
            user_session=user_session,
            notes=notes,
            data_quality="snapshot"
        )
        
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        
        return {
            "message": "Vault snapshot created successfully",
            "snapshot": snapshot
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating vault snapshot: {str(e)}")
