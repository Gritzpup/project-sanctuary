"""
API Routes for Alpaca Account Management
Handles Alpaca account tracking and synchronization
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.alpaca_account import AlpacaAccount
from app.services.alpaca_service import AlpacaService

def safe_float(value: Any, default: float = 0.0) -> float:
    """Safely convert any value to float, handling None and SQLAlchemy objects"""
    if value is None:
        return default
    try:
        return float(value)
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

router = APIRouter(prefix="/api/alpaca", tags=["alpaca"])

@router.get("/accounts")
async def get_alpaca_accounts(
    limit: int = Query(10, description="Number of accounts to return"),
    db: Session = Depends(get_db)
):
    """Get all Alpaca accounts"""
    accounts = db.query(AlpacaAccount).order_by(desc(AlpacaAccount.updated_at)).limit(limit).all()
    return {
        "accounts": accounts,
        "count": len(accounts)
    }

@router.get("/accounts/{account_id}")
async def get_alpaca_account(account_id: str, db: Session = Depends(get_db)):
    """Get specific Alpaca account by ID"""
    account = db.query(AlpacaAccount).filter(AlpacaAccount.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account

@router.post("/accounts/sync")
async def sync_alpaca_account(db: Session = Depends(get_db)):
    """Sync current Alpaca account information"""
    try:
        alpaca_service = AlpacaService()
        account_info = await alpaca_service.get_account_info()
        
        if not account_info:
            raise HTTPException(status_code=500, detail="Failed to fetch account info from Alpaca")
        
        account_id = account_info.get("account_id", "unknown")
        
        # Check if account already exists
        existing_account = db.query(AlpacaAccount).filter(AlpacaAccount.account_id == account_id).first()
        
        if existing_account:            # Update existing account using SQL update to avoid Column assignment issues
            update_data = {
                AlpacaAccount.current_balance: safe_float(account_info.get("cash", 0.0)),
                AlpacaAccount.portfolio_value: safe_float(account_info.get("portfolio_value", 0.0)),
                AlpacaAccount.buying_power: safe_float(account_info.get("buying_power", 0.0)),
                AlpacaAccount.unrealized_pl: safe_float(account_info.get("unrealized_pl", 0.0)),
                AlpacaAccount.account_status: safe_str(account_info.get("status", "ACTIVE")),
                AlpacaAccount.last_sync_at: datetime.utcnow(),
                AlpacaAccount.updated_at: datetime.utcnow()
            }
            
            db.query(AlpacaAccount).filter(AlpacaAccount.account_id == account_id).update(update_data)
            db.commit()
            db.refresh(existing_account)
            
            return {
                "message": "Account updated successfully",
                "account": existing_account,
                "action": "updated"
            }
        else:
            # Create new account
            new_account = AlpacaAccount(
                account_id=account_id,
                starting_balance=safe_float(account_info.get("cash", 0.0)),
                current_balance=safe_float(account_info.get("cash", 0.0)),
                portfolio_value=safe_float(account_info.get("portfolio_value", 0.0)),
                buying_power=safe_float(account_info.get("buying_power", 0.0)),
                unrealized_pl=safe_float(account_info.get("unrealized_pl", 0.0)),
                account_status=safe_str(account_info.get("status", "ACTIVE")),
                paper_trading=True,  # Always paper trading for safety
                last_sync_at=datetime.utcnow()
            )
            
            db.add(new_account)
            db.commit()
            db.refresh(new_account)
            
            return {
                "message": "New account created successfully",
                "account": new_account,
                "action": "created"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync account: {str(e)}")

@router.get("/accounts/{account_id}/performance")
async def get_account_performance(account_id: str, db: Session = Depends(get_db)):
    """Get account performance metrics"""
    account = db.query(AlpacaAccount).filter(AlpacaAccount.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {
        "account_id": account.account_id,
        "current_balance": safe_float(account.current_balance),
        "starting_balance": safe_float(account.starting_balance),
        "portfolio_value": safe_float(account.portfolio_value),
        "total_return_pct": safe_float(account.total_return_pct) if account.total_return_pct is not None else 0.0,
        "total_pl": safe_float(account.total_pl) if account.total_pl is not None else 0.0,
        "unrealized_pl": safe_float(account.unrealized_pl),
        "realized_pl": safe_float(account.realized_pl) if account.realized_pl is not None else 0.0,
        "day_pl": safe_float(account.day_pl) if account.day_pl is not None else 0.0,
        "account_mode": safe_str(account.account_mode) if account.account_mode is not None else "paper",
        "last_sync": account.last_sync_at.isoformat() if account.last_sync_at is not None else None
    }

@router.put("/accounts/{account_id}/notes")
async def update_account_notes(
    account_id: str,
    notes: str,
    db: Session = Depends(get_db)
):
    """Update account notes"""
    account = db.query(AlpacaAccount).filter(AlpacaAccount.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
      # Use SQL update to avoid Column assignment issues
    db.query(AlpacaAccount).filter(AlpacaAccount.account_id == account_id).update({
        AlpacaAccount.notes: notes,
        AlpacaAccount.updated_at: datetime.utcnow()
    })
    db.commit()
    
    return {"message": "Notes updated successfully", "account_id": account_id}
