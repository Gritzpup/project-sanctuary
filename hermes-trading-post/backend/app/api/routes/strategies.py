from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.backtesting import backtesting_service
from app.models.strategy import Strategy, StrategyPerformance
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from typing import Dict, Any, List
from pydantic import BaseModel

router = APIRouter()

class StrategyCreate(BaseModel):
    name: str
    display_name: str
    description: str = ""
    parameters: Dict[str, Any] = {}

class StrategyUpdate(BaseModel):
    parameters: Dict[str, Any]
    is_active: Optional[bool] = None

@router.get("/available")
async def get_available_strategies():
    """Get list of available strategies"""
    try:
        strategies = backtesting_service.get_available_strategies()
        return {"strategies": strategies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def get_strategies(db: Session = Depends(get_db)):
    """Get all saved strategies"""
    try:
        strategies = db.query(Strategy).all()
        return {"strategies": [
            {
                "id": s.id,
                "name": s.name,
                "display_name": s.display_name,
                "description": s.description,
                "is_active": s.is_active,
                "parameters": s.get_parameters(),
                "created_at": s.created_at,
                "updated_at": s.updated_at
            }
            for s in strategies
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
async def create_strategy(strategy: StrategyCreate, db: Session = Depends(get_db)):
    """Create a new strategy configuration"""
    try:
        # Check if strategy name already exists
        existing = db.query(Strategy).filter(Strategy.name == strategy.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Strategy name already exists")
        
        db_strategy = Strategy(
            name=strategy.name,
            display_name=strategy.display_name,
            description=strategy.description
        )
        db_strategy.set_parameters(strategy.parameters)
        
        db.add(db_strategy)
        db.commit()
        db.refresh(db_strategy)
        
        return {
            "id": db_strategy.id,
            "name": db_strategy.name,
            "display_name": db_strategy.display_name,
            "description": db_strategy.description,
            "parameters": db_strategy.get_parameters()
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{strategy_id}")
async def update_strategy(
    strategy_id: int, 
    strategy_update: StrategyUpdate, 
    db: Session = Depends(get_db)
):
    """Update strategy parameters"""
    try:
        db_strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
        if not db_strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        
        # Update parameters
        if strategy_update.parameters:
            db_strategy.set_parameters(strategy_update.parameters)
          # Update active status
        if strategy_update.is_active is not None:
            # Update using query to avoid SQLAlchemy column assignment issues
            db.query(Strategy).filter(Strategy.id == strategy_id).update(
                {"is_active": strategy_update.is_active}
            )
        
        db.commit()
        db.refresh(db_strategy)
        
        return {
            "id": db_strategy.id,
            "name": db_strategy.name,
            "display_name": db_strategy.display_name,
            "parameters": db_strategy.get_parameters(),
            "is_active": db_strategy.is_active
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{strategy_id}/performance")
async def get_strategy_performance(strategy_id: int, db: Session = Depends(get_db)):
    """Get strategy performance metrics"""
    try:
        strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        
        performance = db.query(StrategyPerformance).filter(
            StrategyPerformance.strategy_name == strategy.name
        ).first()
        
        if not performance:
            return {
                "strategy_name": strategy.name,
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "total_profit": 0.0,
                "vault_balance": 0.0,
                "win_rate": 0.0,
                "avg_profit_per_trade": 0.0
            }
        
        return {
            "strategy_name": performance.strategy_name,
            "total_trades": performance.total_trades,
            "winning_trades": performance.winning_trades,
            "losing_trades": performance.losing_trades,
            "total_profit": performance.total_profit,
            "total_fees": performance.total_fees,
            "vault_balance": performance.vault_balance,
            "max_drawdown": performance.max_drawdown,
            "sharpe_ratio": performance.sharpe_ratio,
            "win_rate": performance.win_rate,
            "avg_profit_per_trade": performance.avg_profit_per_trade,
            "updated_at": performance.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: int, db: Session = Depends(get_db)):
    """Delete a strategy"""
    try:
        db_strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
        if not db_strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        
        db.delete(db_strategy)
        db.commit()
        
        return {"message": "Strategy deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
