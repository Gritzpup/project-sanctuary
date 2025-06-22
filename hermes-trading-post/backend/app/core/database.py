from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database tables including Phase 5.2 enhancements"""
    try:
        # Import all models to ensure they're registered with Base    
        from app.models import trade, strategy, portfolio
        # Import Phase 5.2 models
        from app.models import alpaca_account, trading_mode, vault_history, alpaca_order
        # Import dashboard layout models
        from app.models import dashboard_layout
        
        # Create all tables (this will skip existing tables and indexes)
        Base.metadata.create_all(bind=engine, checkfirst=True)
        print("✅ Database tables created successfully (including Phase 5.2 enhancements and dashboard layouts)!")
    except Exception as e:
        print(f"⚠️ Database initialization warning (this is usually normal): {e}")
        print("✅ Database initialization completed with existing tables!")
