"""WebSocket endpoints for matchmaking and PvP game sessions.

Two WebSocket endpoints:
1. /ws/matchmaking — join queue, wait for match, get paired
2. /ws/game/{game_id} — play PvP turns in real-time

Flow:
  Client connects to matchmaking WS → server pairs them →
  server sends match_found with game_id → client disconnects
  matchmaking WS → connects to game WS with game_id → plays
"""

import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.auth.jwt_handler import verify_token
from app.core.game_engine.types import Action
from app.schemas import ws as ws_msg

# These will be set by app startup (see main.py)
# We import them at module level and set via init_ws_endpoints()
_ws_manager = None
_matchmaking = None
_game_sessions: dict[UUID, "PvPGameSession"] = {}

router = APIRouter()
logger = logging.getLogger(__name__)


def init_ws_endpoints(ws_manager, matchmaking_service) -> None:
    """Initialize WebSocket endpoints with shared service instances.

    Called from app startup. This avoids circular imports and lets
    the main app control the lifecycle of shared services.

    Args:
        ws_manager: The WSManager singleton.
        matchmaking_service: The MatchmakingService singleton.
    """
    global _ws_manager, _matchmaking
    _ws_manager = ws_manager
    _matchmaking = matchmaking_service


def _authenticate_ws(token: str) -> UUID:
    """Verify JWT token from WebSocket query parameter.

    WebSockets can't use HTTP headers easily, so we pass
    the token as a query parameter: ws://host/ws/game/123?token=xxx

    Args:
        token: JWT access token string.

    Returns:
        Player UUID.

    Raises:
        Exception if token is invalid.
    """
    return verify_token(token)


@router.websocket("/ws/matchmaking")
async def matchmaking_ws(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """WebSocket endpoint for matchmaking queue.

    Client connects → auto-joins queue → waits for match_found message.
    Client can send: {"type": "leave_queue"} or {"type": "ping"}
    """
    try:
        player_id = _authenticate_ws(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Use "matchmaking" as the room for all queued players
    await _ws_manager.connect(websocket, "matchmaking", player_id)

    try:
        # Join the matchmaking queue
        # We need the display name — for now use player_id as fallback
        position = await _matchmaking.join_queue(player_id, str(player_id)[:8])
        await websocket.send_json(ws_msg.queue_joined(position))

        # Listen for client messages
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
    """WebSocket endpoint for a PvP game session.

    Client connects after receiving match_found from matchmaking.
    Client sends: {"type": "submit_action", "action": "attack"}
    Server sends: turn_result, round_result, match_result, etc.
    """
    try:
        player_id = _authenticate_ws(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    game_uuid = UUID(game_id)
    room_id = game_id

    await _ws_manager.connect(websocket, room_id, player_id)

    # Check if this is a reconnect to an existing session
    session = _game_sessions.get(game_uuid)

    if session is None:
        # First connection — check if matchmaking created this game
        if game_uuid in _matchmaking.active_games:
            from app.modules.ki_clash.game_session import PvPGameSession

            state = _matchmaking.active_games[game_uuid]
            p1_id, p2_id = _matchmaking.game_players[game_uuid]

            session = PvPGameSession(
                game_state=state,
                player1_id=p1_id,
                player2_id=p2_id,
                ws_manager=_ws_manager,
            )
            _game_sessions[game_uuid] = session

            # Start the game when both players are connected
            if _ws_manager.room_size(room_id) >= 2:
                await session.start()
        else:
            await websocket.send_json(
                ws_msg.error_msg("Game not found")
            )
            await websocket.close()
            return
    else:
        # Reconnect scenario
        if session.is_player(player_id):
            await session.handle_reconnect(player_id)

            # If both players are now connected and game hasn't started yet
            if _ws_manager.room_size(room_id) >= 2 and session.state.current_round:
                if session._p1_action is None and session._p2_action is None:
                    await session.start()

    # Check if both players connected — start game if so
    if session and _ws_manager.room_size(room_id) >= 2:
        if session._timeout_task is None and session.state.status == MatchStatus.IN_PROGRESS:
            await session.start()

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

                if session:
                    await session.submit_action(player_id, action)

            elif msg_type == "ping":
                await websocket.send_json(ws_msg.pong())

    except WebSocketDisconnect:
        if session and session.is_player(player_id):
            await session.handle_disconnect(player_id)
    finally:
        await _ws_manager.disconnect(player_id)

        # Clean up completed game sessions
        if session and session.state.status != MatchStatus.IN_PROGRESS:
            await session.cleanup()
            _game_sessions.pop(game_uuid, None)
            _matchmaking.active_games.pop(game_uuid, None)
            _matchmaking.game_players.pop(game_uuid, None)


# Need this import for the type check in game_ws
from app.core.game_engine.types import MatchStatus
