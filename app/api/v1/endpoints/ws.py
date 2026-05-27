"""WebSocket endpoints for matchmaking and PvP game sessions.

Two WebSocket endpoints:
  - /ws/matchmaking — join queue, wait for match, get paired
  - /ws/game/{game_id} — play PvP turns in real-time

Game session state lives entirely in Redis (DR-15). This module owns
WebSocket protocol concerns (handshake, message parsing, disconnect
cleanup) and delegates state operations to a singleton `PvPGameSession`
façade injected at startup.

Flow:
  Client → /ws/matchmaking → match_found → disconnect → /ws/game/{id}
"""

import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.auth.jwt_handler import verify_token
from app.core.game_engine.types import Action, MatchStatus
from app.core.game_store import GameStore
from app.core.ws_manager.manager import WSManager
from app.modules.ki_clash.game_session import PvPGameSession
from app.schemas import ws as ws_msg
from app.services.matchmaking_service import MatchmakingService

# Injected at app startup via init_ws_endpoints().
_ws_manager: WSManager | None = None
_matchmaking: MatchmakingService | None = None
_pvp: PvPGameSession | None = None
_store: GameStore | None = None

router = APIRouter()
logger = logging.getLogger(__name__)


def init_ws_endpoints(
    ws_manager: WSManager,
    matchmaking_service: MatchmakingService,
    pvp_session: PvPGameSession,
    game_store: GameStore,
) -> None:
    """Wire the singleton dependencies into this module.

    Called once from app startup (`app/main.py`). Avoids circular imports
    and lets the lifespan manager own the singletons.
    """
    global _ws_manager, _matchmaking, _pvp, _store
    _ws_manager = ws_manager
    _matchmaking = matchmaking_service
    _pvp = pvp_session
    _store = game_store


def _authenticate_ws(token: str) -> UUID:
    """Verify JWT from query parameter (WS can't easily use headers)."""
    return verify_token(token)


@router.websocket("/ws/matchmaking")
async def matchmaking_ws(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """Join the matchmaking queue and wait for a match_found event."""
    assert _ws_manager and _matchmaking
    try:
        player_id = _authenticate_ws(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await _ws_manager.connect(websocket, "matchmaking", player_id)

    try:
        position = await _matchmaking.join_queue(player_id, str(player_id)[:8])
        await websocket.send_json(ws_msg.queue_joined(position))

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")
            if msg_type == "leave_queue":
                await _matchmaking.leave_queue(player_id)
                break
            elif msg_type == "ping":
                await websocket.send_json(ws_msg.pong())

    except WebSocketDisconnect:
        await _matchmaking.leave_queue(player_id)
    finally:
        await _ws_manager.disconnect(player_id)


@router.websocket("/ws/game/{game_id}")
async def game_ws(
    websocket: WebSocket,
    game_id: str,
    token: str = Query(...),
) -> None:
    """Real-time PvP game session.

    Per DR-15, this handler holds no per-game state. All session
    operations delegate to `PvPGameSession` which reads/writes Redis.
    """
    assert _ws_manager and _pvp and _store
    try:
        player_id = _authenticate_ws(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    game_uuid = UUID(game_id)
    room_id = game_id

    # Connect first so we can send error messages on the open socket.
    await _ws_manager.connect(websocket, room_id, player_id)

    # Validate game exists + player belongs.
    session = await _store.load(game_uuid)
    if session is None:
        await websocket.send_json(ws_msg.error_msg("Game not found"))
        await _ws_manager.disconnect(player_id)
        await websocket.close()
        return
    if not session.is_player(player_id):
        await websocket.send_json(ws_msg.error_msg("Not a player in this game"))
        await _ws_manager.disconnect(player_id)
        await websocket.close()
        return

    # Single connect path — façade decides first-connect vs reconnect
    # internally based on session.connected_players.
    await _pvp.handle_connect(game_uuid, player_id)

    # Start the match once both players have connected. Idempotent.
    if _ws_manager.room_size(room_id) >= 2:
        await _pvp.start(game_uuid)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "submit_action":
                action_str = data.get("action", "")
                try:
                    action = Action(action_str)
                except ValueError:
                    await websocket.send_json(
                        ws_msg.error_msg(f"Invalid action: {action_str}")
                    )
                    continue
                await _pvp.submit_action(game_uuid, player_id, action)

            elif msg_type == "ping":
                await websocket.send_json(ws_msg.pong())

    except WebSocketDisconnect:
        await _pvp.handle_disconnect(game_uuid, player_id)
    finally:
        await _ws_manager.disconnect(player_id)

        # Clean up completed game sessions
        final = await _store.load(game_uuid)
        if final is not None and final.game_state.status != MatchStatus.IN_PROGRESS:
            await _pvp.cleanup(game_uuid)
            await _store.delete(game_uuid)
