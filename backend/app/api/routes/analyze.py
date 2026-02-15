from fastapi import APIRouter, HTTPException, BackgroundTasks, status, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from starlette.websockets import WebSocketState
import uuid
import json
import hashlib
import asyncio
from starlette.concurrency import run_in_threadpool
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    MoveAnalysis,
    GameSummary,
    TacticalInfoSchema
)
from engine.stockfish_engine import analyze_game, parse_pgn, StockfishError
from engine.pgn_parser import get_game_info
from engine.engine_pool import engine_pool
from app.services.cache import cache

router = APIRouter()


def _generate_cache_key(request: AnalyzeRequest) -> str:
    """Generates a deterministic cache key from specific request fields."""
    key_data = {
        "pgn": request.pgn,
        "depth": request.depth,
        "move_time_ms": request.move_time_ms,
        "threads": request.threads,
        "hash_mb": request.hash_mb,
        "use_lichess": request.use_lichess,
        "use_tablebase": request.use_tablebase,
        "version": "v1"
    }
    key_str = json.dumps(key_data, sort_keys=True)
    return hashlib.sha256(key_str.encode()).hexdigest()


def _is_websocket_connected(websocket: WebSocket) -> bool:
    """Safe check for WebSocket connection state using enum, not string."""
    return websocket.client_state == WebSocketState.CONNECTED


@router.post(
    "/analyze",
    summary="Analyze Chess Game",
    description="Analyzes a chess game from PGN. Returns cached result immediately (200) or signals WebSocket usage (202)."
)
async def analyze(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    correlation_id = str(uuid.uuid4())

    cache_key = _generate_cache_key(request)
    cached_data = cache.get(cache_key)
    if cached_data:
        return AnalyzeResponse(**cached_data)

    return JSONResponse(
        status_code=202,
        content={
            "cached": False,
            "cache_key": cache_key,
            "message": "Analysis not cached. Connect to WebSocket for progressive results.",
            "websocket_url": "/ws/analyze"
        }
    )


async def _run_analysis_with_engine(
    request: AnalyzeRequest,
    moves: list,
    cache_key: str,
    progress_callback,
    loop: asyncio.AbstractEventLoop,
    correlation_id: str,
) -> dict:
    """
    Acquires an engine, runs full analysis, caches result, releases engine.

    Separated from the WebSocket handler so the engine lifecycle is fully
    contained here — the engine is ONLY released after analysis completes,
    regardless of whether the WebSocket client is still connected.
    """
    print(f"[{correlation_id}] 🔍 Attempting to acquire engine (timeout: 10s)...")
    try:
        with engine_pool.acquire(timeout=10.0) as engine:
            print(f"[{correlation_id}] ✅ Engine acquired successfully (ID: {id(engine)})")
            result = await run_in_threadpool(
                analyze_game,
                moves=moves,
                depth=request.depth,
                move_time_ms=request.move_time_ms,
                use_lichess_api=request.use_lichess,
                use_tablebase=request.use_tablebase,
                multi_pv=5,
                threads=request.threads,
                hash_mb=request.hash_mb,
                adaptive_depth=False,
                min_depth=18,
                max_depth=28,
                timeout=600.0,
                engine=engine,
                progress_callback=progress_callback,
                event_loop=loop,
            )
            print(f"[{correlation_id}] ✅ Analysis complete. Engine released back to pool")
    except TimeoutError as e:
        print(f"[{correlation_id}] ❌ TIMEOUT: No engines available in pool after 10s")
        raise StockfishError("Engine pool timeout - all engines busy")
    except StockfishError as e:
        print(f"[{correlation_id}] ❌ STOCKFISH ERROR: {e}")
        raise
    except Exception as e:
        print(f"[{correlation_id}] ❌ UNEXPECTED ERROR during analysis: {e}")
        import traceback
        traceback.print_exc()
        raise

    return result


def _build_response(result: dict, pgn: str) -> AnalyzeResponse:
    """Build AnalyzeResponse from raw engine result dict."""
    move_analyses = []
    for move_data in result["moves"]:
        tac_raw = move_data.get("tactical_info")
        tac = None
        if tac_raw and isinstance(tac_raw, dict):
            tac = TacticalInfoSchema(**tac_raw)
        move_analyses.append(MoveAnalysis(
            **{k: v for k, v in move_data.items() if k != "tactical_info"},
            tactical_info=tac
        ))

    summary = None
    if result.get("summary"):
        summary_data = dict(result["summary"])  
        game_info = get_game_info(pgn)
        if game_info:
            summary_data["game_info"] = game_info
        summary = GameSummary(**summary_data)

    return AnalyzeResponse(moves=move_analyses, summary=summary)


@router.websocket("/ws/analyze")
async def websocket_analyze(websocket: WebSocket):
    """
    WebSocket endpoint for progressive chess analysis with real-time updates.

    If client disconnects mid-analysis, the backend continues processing
    to completion and caches the result for future use.
    """
    await websocket.accept()
    correlation_id = str(uuid.uuid4())
    print(f"\n{'='*60}")
    print(f"[{correlation_id}] 🎯 NEW WEBSOCKET CONNECTION ACCEPTED")
    print(f"{'='*60}\n")
    analysis_task: asyncio.Task | None = None
    websocket_active = True

    try:
        # Receive analysis request
        print(f"[{correlation_id}] 📥 Waiting to receive analysis request...")
        data = await websocket.receive_json()
        print(f"[{correlation_id}] ✅ Request received, parsing...")
        request = AnalyzeRequest(**data)
        print(f"[{correlation_id}] ═══════════════════════════════════════")
        print(f"[{correlation_id}] 🚀 WebSocket analysis STARTED")
        print(f"[{correlation_id}] Depth: {request.depth}, MoveTime: {request.move_time_ms}ms")
        print(f"[{correlation_id}] ═══════════════════════════════════════")

        # Check cache again (race condition protection — another request might
        # have cached this between the HTTP check and the WS connection)
        cache_key = _generate_cache_key(request)
        print(f"[{correlation_id}] 🔎 Checking cache...")
        cached_data = cache.get(cache_key)
        if cached_data:
            print(f"[{correlation_id}] ✅ Cache HIT - sending cached result")
            await websocket.send_json({"type": "complete", "data": cached_data})
            return
        print(f"[{correlation_id}] ❌ Cache MISS - proceeding with analysis")

        # Parse PGN
        print(f"[{correlation_id}] 📝 Parsing PGN...")
        moves = parse_pgn(request.pgn)
        if not moves:
            print(f"[{correlation_id}] ❌ No moves found in PGN!")
            await websocket.send_json({"type": "error", "message": "No moves found in PGN"})
            return

        total_moves = len(moves)
        print(f"[{correlation_id}] ✅ Found {total_moves} moves to analyze")
        print(f"[{correlation_id}] 🔍 Acquiring engine from pool...")

        # Capture the running event loop NOW, in this async context.
        # The analysis runs in a thread (via run_in_threadpool) which has no
        # event loop. We pass this loop to progress_callback_sync so it can
        # use run_coroutine_threadsafe() to safely schedule WS sends.
        loop = asyncio.get_running_loop()

        # Progress callback — sync function called from the analysis thread.
        # Uses run_coroutine_threadsafe to safely push updates to this event loop.
        def progress_callback_sync(move_analysis: dict, current: int, total: int):
            if not websocket_active:
                return  # Client gone — skip send, but analysis continues

            try:
                future = asyncio.run_coroutine_threadsafe(
                    websocket.send_json({
                        "type": "progress",
                        "move": move_analysis,
                        "current": current,
                        "total": total,
                        "percentage": round((current / total) * 100, 1),
                    }),
                    loop
                )
                # Fire-and-forget: don't block the analysis thread waiting for send.
                # If WS is closed, the send will raise and be caught silently.
            except Exception:
                pass  # Connection closed — fine, analysis continues

        analysis_task = asyncio.create_task(
            _run_analysis_with_engine(
                request=request,
                moves=[{
                    "move_number": m.move_number,
                    "side": m.side,
                    "san": m.san,
                    "uci": m.uci,
                } for m in moves],
                cache_key=cache_key,
                progress_callback=progress_callback_sync,
                loop=loop,
                correlation_id=correlation_id,
            )
        )

        # Wait for analysis to complete
        result = await analysis_task

        # Build and cache response
        response = _build_response(result, request.pgn)
        cache.set(cache_key, response.model_dump())
        print(f"[{correlation_id}] ✅ Analysis complete and cached")

        # Send final result if client still connected
        if websocket_active and _is_websocket_connected(websocket):
            await websocket.send_json({
                "type": "complete",
                "data": response.model_dump()
            })
            print(f"[{correlation_id}] ✅ Results sent to client")
            print(f"[{correlation_id}] ═══ WebSocket analysis COMPLETED ═══")
        else:
            print(f"[{correlation_id}] Client disconnected — result cached for next request")

    except WebSocketDisconnect:
        print(f"[{correlation_id}] ⚠️  Client disconnected during analysis")
        websocket_active = False

        if analysis_task and not analysis_task.done():
            print(f"[{correlation_id}] 🔄 Analysis continuing in background for caching...")
            try:
                result = await analysis_task
                response = _build_response(result, request.pgn)
                cache.set(cache_key, response.model_dump())
                print(f"[{correlation_id}] ✅ Background analysis cached successfully")
            except Exception as e:
                print(f"[{correlation_id}] ❌ Background analysis failed: {e}")
                import traceback
                traceback.print_exc()

    except asyncio.CancelledError:
        print(f"[{correlation_id}] ⚠️  WebSocket handler cancelled")
        websocket_active = False
        # Let analysis complete for caching
        if analysis_task and not analysis_task.done():
            try:
                result = await analysis_task
                response = _build_response(result, request.pgn)
                cache.set(cache_key, response.model_dump())
            except Exception:
                pass
        raise  # Re-raise CancelledError so FastAPI can clean up properly

    except StockfishError as e:
        print(f"[{correlation_id}] ══════════════════════════════════")
        print(f"[{correlation_id}] ❌❌❌ STOCKFISH ENGINE FAILURE ❌❌❌")
        print(f"[{correlation_id}] Error: {e}")
        print(f"[{correlation_id}] ══════════════════════════════════")
        websocket_active = False
        if _is_websocket_connected(websocket):
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Engine error: {str(e)}"
                })
            except Exception:
                pass

    except Exception as e:
        print(f"[{correlation_id}] ══════════════════════════════════")
        print(f"[{correlation_id}] ❌❌❌ WEBSOCKET ERROR ❌❌❌")
        print(f"[{correlation_id}] Error: {e}")
        print(f"[{correlation_id}] ══════════════════════════════════")
        websocket_active = False
        if _is_websocket_connected(websocket):
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
            except Exception:
                pass

    finally:
        websocket_active = False
        if _is_websocket_connected(websocket):
            try:
                await websocket.close()
            except Exception:
                pass


@router.get("/pool-stats", summary="Get Engine Pool Statistics")
def pool_stats():
    """Returns current status of the Stockfish engine pool."""
    return {
        "size": engine_pool.pool.qsize(),
        "max_size": engine_pool.pool.maxsize,
        "usage_stats": dict(list(engine_pool.engine_usage.items())[:10])
    }


@router.get("/cache-stats", summary="Get Cache Statistics")
def cache_stats():
    """Returns Redis cache statistics."""
    return cache.get_stats()