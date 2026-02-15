import hashlib
import json
import logging
import os
from typing import Optional, Any, Dict
import redis
from app.core.config import settings

logger = logging.getLogger(__name__)

class AnalysisCache:
    # Default TTL: 10 days in seconds
    DEFAULT_TTL = 864000
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.enabled = False
        self.default_ttl = self._get_ttl_from_env()
        self._init_redis()
    
    def _get_ttl_from_env(self) -> int:
        """
        Get TTL from environment variable REDIS_ANALYSIS_TTL.
        Falls back to DEFAULT_TTL (10 days) if not set or invalid.
        """
        try:
            ttl_str = os.getenv("REDIS_ANALYSIS_TTL")
            if ttl_str is None:
                logger.info(f"REDIS_ANALYSIS_TTL not set, using default: {self.DEFAULT_TTL}s")
                return self.DEFAULT_TTL
            
            ttl = int(ttl_str)
            if ttl <= 0:
                logger.warning(f"Invalid REDIS_ANALYSIS_TTL value: {ttl}. Must be positive. Using default: {self.DEFAULT_TTL}s")
                return self.DEFAULT_TTL
            
            logger.info(f"Using REDIS_ANALYSIS_TTL from environment: {ttl}s")
            return ttl
        except ValueError as e:
            logger.warning(f"Invalid REDIS_ANALYSIS_TTL format: {ttl_str}. Using default: {self.DEFAULT_TTL}s")
            return self.DEFAULT_TTL

    def _init_redis(self):
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1
            )
            # Test connection
            self.redis_client.ping()
            self.enabled = True
            logger.info("Redis cache initialized successfully")
        except redis.ConnectionError as e:
            logger.warning("Redis not available, caching disabled: %s", e)
            self.enabled = False
        except Exception as e:
            logger.error("Redis initialization failed: %s", e)
            self.enabled = False

    def _generate_key(self, pgn: str, depth: int, move_number: int) -> str:
        """Generates a deterministic cache key."""
        # Normalize PGN (remove whitespace/comments if needed, but simple hash is fast)
        # We rely on the request pgn being somewhat normalized or just exact match
        payload = f"{pgn}|{depth}|{move_number}"
        return hashlib.sha256(payload.encode()).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        """Generic get method for retrieved cached data by key."""
        if not self.enabled:
            return None
        try:
            data = self.redis_client.get(key)
            if data:
                logger.debug("Cache HIT for %s", key[:8])
                return json.loads(data)
            return None
        except redis.RedisError as e:
            logger.warning("Redis error on GET: %s", e)
            return None

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None):
        """
        Generic set method to cache data by key with configurable TTL.
        
        Args:
            key: Cache key
            value: Data to cache (will be JSON serialized)
            ttl_seconds: Time-to-live in seconds. If None, uses default_ttl from environment.
        """
        if not self.enabled:
            return
        
        # Use provided TTL or fall back to default
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        
        try:
            self.redis_client.setex(key, ttl, json.dumps(value))
            logger.debug("Cached result for %s (TTL: %ds)", key[:8], ttl)
        except redis.RedisError as e:
            logger.warning("Redis error on SET: %s", e)

    def get_analysis(self, pgn: str, depth: int, move_number: int) -> Optional[Dict[str, Any]]:
        # Legacy method, can call self.get with generated key if needed, or keep independent
        key = self._generate_key(pgn, depth, move_number)
        return self.get(key)

    def set_analysis(self, pgn: str, depth: int, move_number: int, result: Dict[str, Any], ttl: Optional[int] = None):
        """
        Cache analysis result for a specific move.
        
        Args:
            pgn: PGN string
            depth: Analysis depth
            move_number: Move number
            result: Analysis result to cache
            ttl: Time-to-live in seconds. If None, uses default_ttl.
        """
        key = self._generate_key(pgn, depth, move_number)
        self.set(key, result, ttl_seconds=ttl)

    def get_stats(self) -> Dict[str, Any]:
        if not self.enabled:
            return {"status": "disabled"}
        
        try:
            info = self.redis_client.info()
            return {
                "status": "connected",
                "used_memory_human": info.get("used_memory_human"),
                "total_keys": self.redis_client.dbsize(),
                "hits": info.get("keyspace_hits"),
                "misses": info.get("keyspace_misses")
            }
        except redis.RedisError:
            return {"status": "error"}

cache = AnalysisCache()