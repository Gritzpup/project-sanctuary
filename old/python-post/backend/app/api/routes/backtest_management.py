"""
Backtest Management API Routes
Handles saving/loading backtest configurations and results
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Path
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.database import get_db
from app.models.backtest_models import BacktestConfig, BacktestResult
from app.services.bitcoin_update_service import bitcoin_update_service

router = APIRouter()

# ==================== BACKTEST CONFIGURATIONS ====================

@router.get("/configs", response_model=List[Dict])
async def get_backtest_configs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    active_only: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Get all backtest configurations"""
    query = db.query(BacktestConfig)
    
    if active_only:
        query = query.filter(BacktestConfig.is_active == True)
    
    configs = query.offset(skip).limit(limit).all()
    return [config.to_dict() for config in configs]


@router.post("/configs", response_model=Dict)
async def create_backtest_config(
    config_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Create a new backtest configuration"""
    try:
        config = BacktestConfig(
            name=config_data.get('name', f"Config_{datetime.now().strftime('%Y%m%d_%H%M%S')}"),
            strategy_type=config_data.get('strategy_type', 'always_gain'),
            entry_threshold=config_data.get('entry_threshold', 2.0),
            exit_target=config_data.get('exit_target', 5.0),
            vault_allocation=config_data.get('vault_allocation', 1.0),
            max_position_size=config_data.get('max_position_size', 0.8),
            timeframe_category=config_data.get('timeframe_category', 'Historical'),
            timeframe_period=config_data.get('timeframe_period', '1 Year'),
            timeframe_code=config_data.get('timeframe_code', '1year'),
            days_count=config_data.get('days_count', 365)
        )
        
        db.add(config)
        db.commit()
        db.refresh(config)
        
        return {
            "success": True,
            "config": config.to_dict(),
            "message": f"Backtest configuration '{config.name}' created successfully"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create config: {str(e)}")


@router.get("/configs/{config_id}", response_model=Dict)
async def get_backtest_config(
    config_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific backtest configuration"""
    config = db.query(BacktestConfig).filter(BacktestConfig.id == config_id).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Backtest configuration not found")
    
    return config.to_dict()


@router.put("/configs/{config_id}", response_model=Dict)
async def update_backtest_config(
    config_id: int,
    config_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Update a backtest configuration"""
    config = db.query(BacktestConfig).filter(BacktestConfig.id == config_id).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Backtest configuration not found")
    
    try:
        # Update fields
        for field, value in config_data.items():
            if hasattr(config, field) and field != 'id':
                setattr(config, field, value)
        
        config.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(config)
        
        return {
            "success": True,
            "config": config.to_dict(),
            "message": f"Configuration '{config.name}' updated successfully"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update config: {str(e)}")


@router.delete("/configs/{config_id}")
async def delete_backtest_config(
    config_id: int,
    hard_delete: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Delete a backtest configuration (soft delete by default)"""
    config = db.query(BacktestConfig).filter(BacktestConfig.id == config_id).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Backtest configuration not found")
    
    try:
        if hard_delete:
            db.delete(config)
        else:
            config.is_active = False
            config.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Configuration '{config.name}' {'deleted' if hard_delete else 'deactivated'} successfully"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete config: {str(e)}")


# ==================== BACKTEST RESULTS ====================

@router.get("/results", response_model=List[Dict])
async def get_backtest_results(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    strategy_name: Optional[str] = Query(None),
    config_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get backtest results with optional filtering"""
    query = db.query(BacktestResult)
    
    if strategy_name:
        query = query.filter(BacktestResult.strategy_name.ilike(f"%{strategy_name}%"))
    
    if config_id:
        query = query.filter(BacktestResult.config_id == config_id)
    
    results = query.order_by(BacktestResult.execution_date.desc()).offset(skip).limit(limit).all()
    return [result.to_dict() for result in results]


@router.post("/results", response_model=Dict)
async def save_backtest_result(
    result_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Save a backtest result"""
    try:
        result = BacktestResult(
            config_id=result_data.get('config_id'),
            strategy_name=result_data.get('strategy_name', 'Always Gain'),
            data_period=result_data.get('data_period', '1 Year'),
            initial_balance=result_data.get('initial_balance', 10000.0),
            final_balance=result_data.get('final_balance', 10000.0),
            total_profit=result_data.get('total_profit', 0.0),
            total_return_pct=result_data.get('total_return_pct', 0.0),
            current_btc_balance=result_data.get('current_btc_balance', 0.0),
            current_btc_value=result_data.get('current_btc_value', 0.0),
            total_trades=result_data.get('total_trades', 0),
            buy_trades=result_data.get('buy_trades', 0),
            sell_trades=result_data.get('sell_trades', 0),
            winning_trades=result_data.get('winning_trades', 0),
            losing_trades=result_data.get('losing_trades', 0),
            win_rate=result_data.get('win_rate', 0.0),
            avg_profit_per_trade=result_data.get('avg_profit_per_trade', 0.0),
            max_drawdown=result_data.get('max_drawdown', 0.0),
            sharpe_ratio=result_data.get('sharpe_ratio'),
            vault_balance=result_data.get('vault_balance', 0.0),
            vault_contributions=result_data.get('vault_contributions', 0),
            trade_details=result_data.get('trade_details'),
            equity_curve=result_data.get('equity_curve'),
            execution_time_seconds=result_data.get('execution_time_seconds'),
            data_source=result_data.get('data_source', 'alpaca')
        )
        
        db.add(result)
        db.commit()
        db.refresh(result)
        
        return {
            "success": True,
            "result": result.to_dict(),
            "message": f"Backtest result saved successfully"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save result: {str(e)}")


@router.get("/results/{result_id}", response_model=Dict)
async def get_backtest_result(
    result_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific backtest result"""
    result = db.query(BacktestResult).filter(BacktestResult.id == result_id).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Backtest result not found")
    
    return result.to_dict()


# ==================== DATA MANAGEMENT ====================

@router.post("/data/update", response_model=Dict)
async def update_bitcoin_data(
    days: int = Query(1, ge=1, le=30, description="Number of recent days to update")
):
    """Manually trigger Bitcoin data update"""
    try:
        result = await bitcoin_update_service.update_daily_data(days_to_fetch=days)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data update failed: {str(e)}")


@router.get("/data/status", response_model=Dict)
async def get_data_status(db: Session = Depends(get_db)):
    """Get status of Bitcoin data in database"""
    try:
        from app.models.historical_data import HistoricalData
        from sqlalchemy import func
        
        # Get data statistics
        stats = db.query(
            func.count(HistoricalData.id).label('total_records'),
            func.min(HistoricalData.timestamp).label('earliest_date'),
            func.max(HistoricalData.timestamp).label('latest_date')
        ).filter(HistoricalData.symbol == 'BTCUSD').first()
        
        return {
            "success": True,
            "total_records": stats.total_records if stats else 0,
            "earliest_date": stats.earliest_date.isoformat() if stats and stats.earliest_date else None,
            "latest_date": stats.latest_date.isoformat() if stats and stats.latest_date else None,
            "data_available": stats.total_records > 0 if stats else False
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get data status: {str(e)}")


@router.get("/data/cached/{days}", response_model=Dict)
async def get_cached_bitcoin_data(
    days: int = Path(..., ge=1, le=1825, description="Number of days to retrieve")
):
    """Get cached Bitcoin data from database"""
    try:
        data = bitcoin_update_service.get_cached_data(days=days)
        
        if not data:
            raise HTTPException(status_code=404, detail="No cached data found for the requested period")
        
        return {
            "success": True,
            "data_points": len(data),
            "period_days": days,
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cached data: {str(e)}")
