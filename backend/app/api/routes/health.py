from fastapi import APIRouter, HTTPException, status
from engine.engine_pool import engine_pool
from app.services.cache import cache

router = APIRouter()

@router.get("/health", status_code=status.HTTP_200_OK)
async def liveness_probe():
    """
    Liveness probe for k8s/docker.
    Returns 200 if the service is running.
    """
    return {"status": "healthy"}

@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness_probe():
    """
    Readiness probe.
    Checks if:
    1. Engine pool has available engines or is initialized.
    2. Redis is connected (optional, but good to know).
    """
    health_status = {
        "engine_pool": "unknown",
        "redis": "unknown"
    }
    
    # Check Engine Pool
    # We consider it ready if it's initialized. 
    # If the queue is empty, it might be under load, but still "ready" to accept requests (which will queue).
    # If it's shutdown, it's not ready.
    if engine_pool._shutdown:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Engine pool shutting down")
    
    # We can inspect the pool size (approximate)
    health_status["engine_pool"] = {
        "size": engine_pool.pool.qsize(),
        "max_size": engine_pool.pool.maxsize
    }
    
    # Check Redis
    stats = cache.get_stats()
    health_status["redis"] = stats.get("status", "unknown")
    
    return health_status
