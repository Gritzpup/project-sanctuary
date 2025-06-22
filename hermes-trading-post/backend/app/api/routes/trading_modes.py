"""
API Routes for Trading Mode Management
Handles trading mode history and configuration tracking
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.models.trading_mode import TradingMode

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

router = APIRouter(prefix="/api/trading-modes", tags=["trading-modes"])

class TradingModeCreate(BaseModel):
    user_session: str
    mode: str
    previous_mode: Optional[str] = None
    balance_usd: float = 1000.0
    vault_allocation_pct: float = 20.0
    starting_btc_balance: float = 0.0
    active_strategy: Optional[str] = None
    strategy_config: Optional[str] = None
    reason_for_change: Optional[str] = None
    notes: Optional[str] = None

class TradingModeUpdate(BaseModel):
    final_portfolio_value: Optional[float] = None
    total_trades: Optional[int] = None
    winning_trades: Optional[int] = None
    reason_for_change: Optional[str] = None
    notes: Optional[str] = None

@router.get("/")
async def get_trading_modes(
    user_session: Optional[str] = Query(None, description="Filter by user session"),
    mode: Optional[str] = Query(None, description="Filter by trading mode"),
    active_only: bool = Query(False, description="Only return active sessions"),
    limit: int = Query(50, description="Number of records to return"),
    db: Session = Depends(get_db)
):
    """Get trading mode history"""
    query = db.query(TradingMode)
    
    if user_session:
        query = query.filter(TradingMode.user_session == user_session)
    
    if mode:
        query = query.filter(TradingMode.mode == mode)
    
    if active_only:
        query = query.filter(TradingMode.deactivated_at.is_(None))
    
    trading_modes = query.order_by(desc(TradingMode.activated_at)).limit(limit).all()
    
    return {
        "trading_modes": trading_modes,
        "count": len(trading_modes)
    }

@router.post("/")
async def create_trading_mode(
    trading_mode_data: TradingModeCreate,
    db: Session = Depends(get_db)
):
    """Create a new trading mode session"""
    
    # Deactivate any existing active sessions for this user using SQL update
    active_sessions = db.query(TradingMode).filter(
        and_(
            TradingMode.user_session == trading_mode_data.user_session,
            TradingMode.deactivated_at.is_(None)
        )
    ).all()
    
    for session in active_sessions:
        now = datetime.utcnow()
        duration_minutes = 0
        if session.activated_at is not None:
            duration = now - session.activated_at
            duration_minutes = int(duration.total_seconds() / 60)
          # Use SQL update to avoid Column assignment issues
        db.query(TradingMode).filter(TradingMode.id == session.id).update({
            TradingMode.deactivated_at: now,
            TradingMode.duration_minutes: duration_minutes
        })
    
    # Create new trading mode session
    new_trading_mode = TradingMode(
        user_session=trading_mode_data.user_session,
        mode=trading_mode_data.mode,
        previous_mode=trading_mode_data.previous_mode,
        balance_usd=trading_mode_data.balance_usd,
        vault_allocation_pct=trading_mode_data.vault_allocation_pct,
        starting_btc_balance=trading_mode_data.starting_btc_balance,
        active_strategy=trading_mode_data.active_strategy,
        strategy_config=trading_mode_data.strategy_config,
        initial_portfolio_value=trading_mode_data.balance_usd,
        reason_for_change=trading_mode_data.reason_for_change,
        notes=trading_mode_data.notes
    )
    
    db.add(new_trading_mode)
    db.commit()
    db.refresh(new_trading_mode)
    
    return {
        "message": "Trading mode session created successfully",
        "trading_mode": new_trading_mode,
        "deactivated_sessions": len(active_sessions)
    }

@router.put("/{session_id}")
async def update_trading_mode(
    session_id: int,
    update_data: TradingModeUpdate,
    db: Session = Depends(get_db)
):
    """Update trading mode session"""
    trading_mode = db.query(TradingMode).filter(TradingMode.id == session_id).first()
    if not trading_mode:
        raise HTTPException(status_code=404, detail="Trading mode session not found")
      # Build update data dictionary using Column objects
    update_dict = {}
    
    if update_data.final_portfolio_value is not None:
        update_dict[TradingMode.final_portfolio_value] = update_data.final_portfolio_value
    
    if update_data.total_trades is not None:
        update_dict[TradingMode.total_trades] = update_data.total_trades
    
    if update_data.winning_trades is not None:
        update_dict[TradingMode.winning_trades] = update_data.winning_trades
    
    if update_data.reason_for_change is not None:
        update_dict[TradingMode.reason_for_change] = update_data.reason_for_change
    
    if update_data.notes is not None:
        update_dict[TradingMode.notes] = update_data.notes
    
    # Use SQL update to avoid Column assignment issues
    if update_dict:
        db.query(TradingMode).filter(TradingMode.id == session_id).update(update_dict)
        db.commit()
        db.refresh(trading_mode)
    
    return {
        "message": "Trading mode session updated successfully",
        "trading_mode": trading_mode
    }

@router.post("/{session_id}/deactivate")
async def deactivate_trading_mode(
    session_id: int,
    reason: Optional[str] = Query(None, description="Reason for deactivation"),
    db: Session = Depends(get_db)
):
    """Deactivate a trading mode session"""
    trading_mode = db.query(TradingMode).filter(TradingMode.id == session_id).first()
    if not trading_mode:
        raise HTTPException(status_code=404, detail="Trading mode session not found")
    
    if trading_mode.deactivated_at is not None:
        raise HTTPException(status_code=400, detail="Session already deactivated")
    
    # Calculate duration
    now = datetime.utcnow()
    duration_minutes = 0
    if trading_mode.activated_at is not None:
        duration = now - trading_mode.activated_at
        duration_minutes = int(duration.total_seconds() / 60)
      # Prepare update data using Column objects
    update_data = {
        TradingMode.deactivated_at: now,
        TradingMode.duration_minutes: duration_minutes
    }
    
    if reason:
        update_data[TradingMode.reason_for_change] = reason
    
    # Use SQL update to avoid Column assignment issues
    db.query(TradingMode).filter(TradingMode.id == session_id).update(update_data)
    db.commit()
    db.refresh(trading_mode)
    
    return {
        "message": "Trading mode session deactivated successfully",
        "trading_mode": trading_mode,
        "duration_hours": safe_float(trading_mode.session_duration_hours) if trading_mode.session_duration_hours is not None else 0.0
    }

@router.get("/current/{user_session}")
async def get_current_trading_mode(user_session: str, db: Session = Depends(get_db)):
    """Get current active trading mode for user"""
    current_mode = db.query(TradingMode).filter(
        and_(
            TradingMode.user_session == user_session,
            TradingMode.deactivated_at.is_(None)
        )
    ).order_by(desc(TradingMode.activated_at)).first()
    
    if not current_mode:
        return {"message": "No active trading mode found", "trading_mode": None}
    
    return {
        "message": "Active trading mode found",
        "trading_mode": current_mode,
        "duration_hours": safe_float(current_mode.session_duration_hours) if current_mode.session_duration_hours is not None else 0.0
    }

@router.get("/analytics/{user_session}")
async def get_trading_mode_analytics(
    user_session: str,
    days: int = Query(30, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """Get trading mode analytics for user"""
    
    since_date = datetime.utcnow() - timedelta(days=days)
    
    sessions = db.query(TradingMode).filter(
        and_(
            TradingMode.user_session == user_session,
            TradingMode.activated_at >= since_date
        )
    ).order_by(TradingMode.activated_at).all()
    
    if not sessions:
        return {"message": "No sessions found", "analytics": None}
    
    # Calculate analytics using safe conversion functions
    total_sessions = len(sessions)
    completed_sessions = [s for s in sessions if s.deactivated_at is not None]
    
    mode_distribution = {}
    total_duration = 0
    total_trades = 0
    total_winning_trades = 0
    
    for session in sessions:
        mode = safe_str(session.mode)
        mode_distribution[mode] = mode_distribution.get(mode, 0) + 1
        
        if session.duration_minutes is not None:
            total_duration += safe_int(session.duration_minutes)
        
        if session.total_trades is not None:
            total_trades += safe_int(session.total_trades)
        
        if session.winning_trades is not None:
            total_winning_trades += safe_int(session.winning_trades)
    
    avg_duration_hours = (total_duration / len(completed_sessions) / 60) if completed_sessions else 0
    win_rate = (total_winning_trades / total_trades * 100) if total_trades > 0 else 0
    
    return {
        "analytics": {
            "period_days": days,
            "total_sessions": total_sessions,
            "completed_sessions": len(completed_sessions),
            "mode_distribution": mode_distribution,
            "avg_session_duration_hours": round(avg_duration_hours, 2),
            "total_trades": total_trades,
            "total_winning_trades": total_winning_trades,
            "win_rate_pct": round(win_rate, 2),
            "most_used_mode": max(mode_distribution.items(), key=lambda x: x[1])[0] if mode_distribution else None
        },
        "sessions": sessions
    }
