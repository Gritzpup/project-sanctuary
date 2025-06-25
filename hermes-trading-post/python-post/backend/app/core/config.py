from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os

class Settings(BaseSettings):
    # App Configuration
    APP_NAME: str = "Alpaca Trading Bot"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Alpaca API Configuration
    ALPACA_API_KEY: str = "your_api_key_here"
    ALPACA_SECRET_KEY: str = "your_secret_key_here"
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"
    
    # Database Configuration
    DATABASE_URL: str = "sqlite:///./trading_bot.db"

    # Trading Configuration
    DEFAULT_STRATEGY: str = "always_gain_btc"
    MAX_POSITION_SIZE: float = 10000.0
    DEFAULT_VAULT_ALLOCATION: float = 0.01

    # Backtesting Configuration
    HISTORICAL_DATA_PERIOD: int = 365  # days
    DEFAULT_TIMEFRAME: str = "1Min"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), "../../../.env"),
        extra="ignore"
    )

settings = Settings()
