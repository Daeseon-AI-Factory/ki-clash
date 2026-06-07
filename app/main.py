"""Ki Clash — FastAPI application entry point.

Startup sequence:
1. Create FastAPI app with CORS
2. On startup: connect Redis, init WSManager + MatchmakingService
3. On shutdown: stop matchmaking background task, close Redis
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.game_store import GameStore
from app.core.logging import configure_logging
from app.core.observability import init_sentry, metrics_payload
from app.exceptions import AppError
from app.api.v1.router import router as v1_router
from app.api.v1.endpoints.ws import router as ws_router, init_ws_endpoints
from app.core.ws_manager.manager import WSManager
from app.modules.ki_clash.game_session import PvPGameSession
from app.services.matchmaking_service import MatchmakingService

# Install structured logging at import time so even pre-lifespan messages
# (uvicorn boot, alembic, etc.) are captured in the chosen format.
configure_logging(
    json_mode=not settings.debug,
    level="DEBUG" if settings.debug else "INFO",
)

# Initialize Sentry before app construction so even startup errors are reported.
# No-op if SENTRY_DSN is empty or sentry-sdk isn't installed.
init_sentry(
    dsn=settings.sentry_dsn,
    environment=settings.environment,
    traces_sample_rate=settings.sentry_traces_sample_rate,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """App lifespan — startup and shutdown logic.

    Startup: connect Redis, create WSManager, start matchmaking loop.
    Shutdown: stop matchmaking, close Redis.
    """
    # --- Startup ---
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=False)
    # WSManager wired with the Redis client so cross-worker pub/sub (DR-13)
    # is active. Without Redis it falls back to single-worker in-memory mode.
    ws_manager = WSManager(redis_client=redis_client)
    game_store = GameStore(redis_client)
    pvp_session = PvPGameSession(store=game_store, ws_manager=ws_manager)
    matchmaking = MatchmakingService(
        redis_client=redis_client,
        ws_manager=ws_manager,
        game_store=game_store,
    )

    # Wire up WebSocket endpoints with shared services
    init_ws_endpoints(ws_manager, matchmaking, pvp_session, game_store)

    # Start background matchmaking loop
    await matchmaking.start_background_matching()

    # Store on app.state so other parts of the app can access
    app.state.redis = redis_client
    app.state.ws_manager = ws_manager
    app.state.matchmaking = matchmaking
    app.state.game_store = game_store
    app.state.pvp_session = pvp_session

    yield

    # --- Shutdown ---
    await matchmaking.stop_background_matching()
    await redis_client.aclose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Consistent error response format for all AppError subclasses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


# REST routes
app.include_router(v1_router)

# WebSocket routes (mounted at /api/v1 alongside REST)
app.include_router(ws_router, prefix="/api/v1")


# Allow HEAD as well as GET (bug #4): many uptime monitors / load
# balancers probe with HEAD, and a GET-only route answered 405 to HEAD.
@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/metrics")
async def metrics() -> Response:
    """Prometheus scrape endpoint. Returns text in exposition format."""
    body, content_type = metrics_payload()
    return Response(content=body, media_type=content_type)
