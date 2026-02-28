from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse
from app.api.routes.analyze import router as analyze_router
from app.api.routes.health import router as health_router
from engine.engine_pool import engine_pool
from app.services.cache import cache
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import asyncio


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    # Startup: Initialize Engine Pool and Cache
    print("Startup: Initializing resources...")
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, engine_pool.initialize)
        print("Engine pool initialized successfully.")
    except Exception as e:
        print(f"CRITICAL: Failed to initialize engine pool: {e}")
        
    if cache.enabled:
        print("Redis cache initialized and enabled.")
    else:
        print("Redis cache disabled (connection failed or not configured).")
    
    yield
    
    # Shutdown: Clean up resources
    print("Shutdown: Cleaning up resources...")
    engine_pool.shutdown()
    print("Shutdown complete.")


class TimeoutMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, timeout: float = 120.0):
        super().__init__(app)
        self.timeout = timeout

    async def dispatch(self, request: Request, call_next):
        # Skip timeout for WebSocket connections
        if request.url.path.startswith("/ws/") or \
           request.headers.get("upgrade") == "websocket":
            return await call_next(request)
        
        try:
            return await asyncio.wait_for(call_next(request), timeout=self.timeout)
        except asyncio.TimeoutError:
            return Response("Request processing time exceeded limit", status_code=504)

app = FastAPI(
    title="Chess Analyzer API",
    description="Analyze chess games with Stockfish engine",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://chessmind-six.vercel.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TimeoutMiddleware, timeout=120.0)

# Register routes
app.include_router(analyze_router, tags=["Analysis"])
app.include_router(health_router, tags=["Health"])

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")

@app.get("/test", summary="Test Endpoint", description="Verifies that the API is running and Swagger UI is accessible.")
def test_endpoint():
    return {"message": "Swagger is working!"}
