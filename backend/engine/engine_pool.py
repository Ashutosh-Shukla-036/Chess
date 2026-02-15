import queue
import threading
import time
import contextlib
from typing import Optional, Generator

import os
STOCKFISH_PATH = os.getenv("STOCKFISH_PATH", "/app/engine/bin/stockfish")

from app.core.config import settings
from engine.stockfish_engine import StockfishEngine, StockfishError


class EnginePool:
    def __init__(self):
        self.pool: queue.Queue[StockfishEngine] = queue.Queue(maxsize=settings.ENGINE_POOL_SIZE)
        self.max_uses = 100
        self.engine_usage = {}  # Track usage count per engine
        self._shutdown = False
        self._lock = threading.Lock()  # For usage tracking safety

    def initialize(self):
        """Pre-creates engines on startup."""
        print(f"🚀 Initializing engine pool with {settings.ENGINE_POOL_SIZE} engines...")
        for i in range(settings.ENGINE_POOL_SIZE):
            try:
                engine = self._create_engine()
                self.pool.put(engine)
                print(f"✅ Engine {i + 1}/{settings.ENGINE_POOL_SIZE} ready")
            except Exception as e:
                print(f"❌ Failed to initialize engine {i}: {e}")
                raise RuntimeError("Engine pool initialization failed") from e

    def _create_engine(self) -> StockfishEngine:
        """Creates and starts a new Stockfish engine."""
        try:
            engine = StockfishEngine(
                stockfish_path=STOCKFISH_PATH,
                threads=settings.ENGINE_THREADS
            )
            engine.start()
            with self._lock:
                self.engine_usage[id(engine)] = 0
            return engine
        except Exception as e:
            raise

    def _recycle_engine(self, engine: StockfishEngine):
        """Closes and replaces an unhealthy or overused engine."""
        engine_id = id(engine)
        print(f"♻️  Recycling engine {engine_id}...")
        try:
            engine.close()
            print(f"✅ Engine {engine_id} closed successfully")
        except Exception as e:
            print(f"❌ Error closing engine {engine_id} during recycle: {e}")
        
        with self._lock:
            if engine_id in self.engine_usage:
                del self.engine_usage[engine_id]

        # Replace with a fresh engine
        try:
            new_engine = self._create_engine()
            self.pool.put(new_engine)
            print(f"✅ Replacement engine {id(new_engine)} added to pool")
        except Exception as e:
            print(f"❌ CRITICAL: Failed to replace recycled engine: {e}")
            print(f"   Pool is now degraded: {self.pool.qsize()}/{settings.ENGINE_POOL_SIZE} engines available")
            import traceback
            traceback.print_exc()
           
    def shutdown(self):
        """Cleanly closes all engines."""
        self._shutdown = True
        print("🛑 Shutting down engine pool...")
        while not self.pool.empty():
            try:
                engine = self.pool.get_nowait()
                engine.close()
            except queue.Empty:
                break
            except Exception as e:
                print(f"⚠️  Error closing engine during shutdown: {e}")

    @contextlib.contextmanager
    def acquire(self, timeout: float = 10.0) -> Generator[StockfishEngine, None, None]:
        if self._shutdown:
            print("❌ Engine pool is shutting down - cannot acquire engine")
            raise RuntimeError("Engine pool is shutting down")

        engine = None
        acquire_start = time.time()
        print(f"🔄 Acquiring engine from pool (available: {self.pool.qsize()}/{settings.ENGINE_POOL_SIZE})")
        
        try:
            engine = self.pool.get(block=True, timeout=timeout)
            acquire_time = time.time() - acquire_start
            print(f"✅ Engine acquired in {acquire_time:.2f}s (ID: {id(engine)}, usage: {self.engine_usage.get(id(engine), 0)})")
        except queue.Empty:
            print(f"❌ TIMEOUT: No engines available after {timeout}s wait")
            print(f"   Pool status: {self.pool.qsize()}/{settings.ENGINE_POOL_SIZE} available")
            print(f"   Active engines: {len(self.engine_usage)}")
            raise TimeoutError("No engines available in pool")

        try:
            yield engine
        except Exception as e:
            print(f"❌ Exception while using engine {id(engine)}: {e}")
            raise
        finally:
            # Check usage and recycle if needed
            should_recycle = False
            with self._lock:
                usage = self.engine_usage.get(id(engine), 0) + 1
                self.engine_usage[id(engine)] = usage
                if usage >= self.max_uses:
                    should_recycle = True
                    print(f"♻️  Engine {id(engine)} reached max usage ({usage}/{self.max_uses}) - recycling")
            
            # Also recycle if the engine crashed or is known unhealthy (e.g. wrapper marked it)
            # For now, we assume simple usage counting + exception safety
            
            if should_recycle:
                threading.Thread(target=self._recycle_engine, args=(engine,), daemon=True).start()
            else:
                try:
                    # Reset board state before returning to pool
                    engine.reset() 
                    self.pool.put(engine)
                except Exception as e:
                    print(f"❌ Error resetting engine {id(engine)}: {e} - recycling instead")
                    threading.Thread(target=self._recycle_engine, args=(engine,), daemon=True).start()

# Global singleton
engine_pool = EnginePool()