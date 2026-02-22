"""API v1 router — aggregates all endpoint routers."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, games, players, ranked, purchases

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(games.router, prefix="/games", tags=["games"])
router.include_router(players.router, prefix="/players", tags=["players"])
router.include_router(ranked.router, prefix="/ranked", tags=["ranked"])
router.include_router(purchases.router, prefix="/purchases", tags=["purchases"])
