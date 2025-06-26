from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.services.backtesting import backtesting_service
from app.services.alpaca_service import alpaca_service
from typing import Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class BacktestRequest(BaseModel):
    strategy_name: str
    parameters: Dict[str, Any] = {}
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    initial_balance: float = 10000.0

# Store running backtests
running_backtests = {}

@router.post("/start")
async def start_backtest(request: BacktestRequest, background_tasks: BackgroundTasks):
    """Start a new backtest"""
    try:
        # Generate unique backtest ID
        backtest_id = f"{request.strategy_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Initialize backtest status
        running_backtests[backtest_id] = {
            "status": "starting",
            "progress": 0,
            "message": "Initializing backtest...",
            "strategy_name": request.strategy_name,
            "parameters": request.parameters,
            "start_time": datetime.now()
        }
        
        # Start backtest in background
        background_tasks.add_task(
            run_backtest_task,
            backtest_id,
            request.strategy_name,
            request.parameters,
            request.initial_balance,
            request.start_date,
            request.end_date
        )
        
        return {
            "backtest_id": backtest_id,
            "status": "started",
            "message": "Backtest initiated"
        }
        
    except Exception as e:
        logger.error(f"Error starting backtest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{backtest_id}")
async def get_backtest_status(backtest_id: str):
    """Get backtest status and progress"""
    if backtest_id not in running_backtests:
        raise HTTPException(status_code=404, detail="Backtest not found")
    
    return running_backtests[backtest_id]

@router.get("/results/{backtest_id}")
async def get_backtest_results(backtest_id: str):
    """Get backtest results"""
    if backtest_id not in running_backtests:
        raise HTTPException(status_code=404, detail="Backtest not found")
    
    backtest = running_backtests[backtest_id]
    
    if backtest["status"] != "completed":
        return {
            "status": backtest["status"],
            "message": backtest.get("message", "Backtest in progress"),
            "progress": backtest.get("progress", 0)
        }
    
    return backtest.get("results", {})

@router.delete("/{backtest_id}")
async def cancel_backtest(backtest_id: str):
    """Cancel a running backtest"""
    if backtest_id not in running_backtests:
        raise HTTPException(status_code=404, detail="Backtest not found")
    
    # Mark as cancelled (actual cancellation would require more complex implementation)
    running_backtests[backtest_id]["status"] = "cancelled"
    
    return {"message": "Backtest cancellation requested"}

async def run_backtest_task(
    backtest_id: str,
    strategy_name: str,
    parameters: Dict[str, Any],
    initial_balance: float,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Background task to run backtest"""
    try:
        # Update status
        running_backtests[backtest_id]["status"] = "fetching_data"
        running_backtests[backtest_id]["message"] = "Fetching historical data..."
        running_backtests[backtest_id]["progress"] = 10
          # Get historical data
        data = alpaca_service.get_historical_data("BTC/USD", "365D")
        
        if data is None or data.empty:
            running_backtests[backtest_id]["status"] = "error"
            running_backtests[backtest_id]["message"] = "Failed to fetch historical data"
            return
        
        # Filter data by date range if provided
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            data = data[data.index >= start_dt]
        
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            data = data[data.index <= end_dt]
        
        # Update status
        running_backtests[backtest_id]["status"] = "running"
        running_backtests[backtest_id]["message"] = "Running backtest simulation..."
        running_backtests[backtest_id]["progress"] = 30
        
        # Run backtest
        results = backtesting_service.run_backtest(
            strategy_name=strategy_name,
            data=data,
            initial_balance=initial_balance,
            parameters=parameters
        )
        
        # Update status with results
        running_backtests[backtest_id]["status"] = "completed"
        running_backtests[backtest_id]["message"] = "Backtest completed successfully"
        running_backtests[backtest_id]["progress"] = 100
        running_backtests[backtest_id]["results"] = results
        running_backtests[backtest_id]["end_time"] = datetime.now()
        
        logger.info(f"Backtest {backtest_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Backtest {backtest_id} failed: {e}")
        running_backtests[backtest_id]["status"] = "error"
        running_backtests[backtest_id]["message"] = f"Backtest failed: {str(e)}"
        running_backtests[backtest_id]["error"] = str(e)

@router.get("/quick/{strategy_name}")
async def quick_backtest(strategy_name: str):
    """Run a quick backtest with default parameters"""
    try:        # Get historical data (last 30 days for quick test)
        data = alpaca_service.get_historical_data("BTC/USD", "30D")
        
        if data is None or data.empty:
            raise HTTPException(status_code=500, detail="Failed to fetch historical data")
        
        # Run backtest with default parameters
        results = backtesting_service.run_backtest(
            strategy_name=strategy_name,
            data=data,
            initial_balance=10000.0
        )
        
        return results
        
    except Exception as e:
        logger.error(f"Quick backtest failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))