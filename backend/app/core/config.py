import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    APP_NAME: str = "Chess Analyzer API"
    LOG_LEVEL: str = "INFO"
    
    # Engine Pool
    ENGINE_POOL_SIZE: int = 1
    ENGINE_THREADS: int = 1
    STOCKFISH_PATH: str = "/app/engine/bin/stockfish"

    
    # Cache
    REDIS_URL: str = "redis://redis:6379"
    REDIS_ANALYSIS_TTL: int = 864000
    
    # Security / Validation
    PGN_MAX_SIZE_BYTES: int = 51200  # 50KB
    PGN_MAX_COMMENTS: int = 1000

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()