from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routes import strategies, backtesting, portfolio, market_data, trades
from app.api.routes import alpaca_accounts, trading_modes, vault_history, alpaca_orders
from app.core.config import settings
from app.core.database import engine, Base
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Sophisticated cryptocurrency trading bot with real-time backtesting"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(strategies.router, prefix="/api/strategies", tags=["strategies"])
app.include_router(backtesting.router, prefix="/api/backtesting", tags=["backtesting"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(market_data.router, prefix="/api/market-data", tags=["market-data"])
app.include_router(trades.router, prefix="/api/trades", tags=["trades"])

# Phase 5.2 - New API routes
app.include_router(alpaca_accounts.router, tags=["alpaca-accounts"])
app.include_router(trading_modes.router, tags=["trading-modes"])
app.include_router(vault_history.router, tags=["vault-history"])
app.include_router(alpaca_orders.router, tags=["alpaca-orders"])

# Backtest management routes (NEW)
from app.api.routes import backtest_management
app.include_router(backtest_management.router, prefix="/api/backtest", tags=["backtest-management"])

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"Message received: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
async def root():
    return {
        "message": "Alpaca Trading Bot API",
        "version": settings.APP_VERSION,
        "status": "active"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": "2025-06-04T00:00:00Z"}

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("🚀 Starting Alpaca Trader Backend")
    
    # Initialize daily Bitcoin data update scheduler
    try:
        from app.services.daily_scheduler import initialize_scheduler
        initialize_scheduler()
        logger.info("✅ Daily update scheduler initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize scheduler: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down Alpaca Trader Backend")
    
    try:
        from app.services.daily_scheduler import daily_scheduler
        daily_scheduler.stop_scheduler()
        logger.info("✅ Daily scheduler stopped")
    except Exception as e:
        logger.error(f"❌ Error stopping scheduler: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
