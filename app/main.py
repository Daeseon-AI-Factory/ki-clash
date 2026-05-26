"""Ki Clash — FastAPI application entry point.

Startup sequence:
1. Create FastAPI app with CORS
2. On startup: connect Redis, init WSManager + MatchmakingService
3. On shutdown: stop matchmaking background task, close Redis
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.logging import configure_logging
from app.exceptions import AppError
from app.api.v1.router import router as v1_router
from app.api.v1.endpoints.ws import router as ws_router, init_ws_endpoints
from app.core.ws_manager.manager import WSManager
from app.services.matchmaking_service import MatchmakingService

# Install structured logging at import time so even pre-lifespan messages
# (uvicorn boot, alembic, etc.) are captured in the chosen format.
configure_logging(
    json_mode=not settings.debug,
    level="DEBUG" if settings.debug else "INFO",
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """App lifespan — startup and shutdown logic.

    Startup: connect Redis, create WSManager, start matchmaking loop.
    Shutdown: stop matchmaking, close Redis.
    """
    # --- Startup ---
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=False)
    ws_manager = WSManager()
    matchmaking = MatchmakingService(redis_client, ws_manager)

    # Wire up WebSocket endpoints with shared services
    init_ws_endpoints(ws_manager, matchmaking)

    # Start background matchmaking loop
    await matchmaking.start_background_matching()

    # Store on app.state so other parts of the app can access
    app.state.redis = redis_client
    app.state.ws_manager = ws_manager
    app.state.matchmaking = matchmaking

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


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
