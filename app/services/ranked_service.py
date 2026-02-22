"""Ranked service — ELO calculation and leaderboard queries.

ELO parameters:
- K-factor: 32 (standard for new systems)
- Default rating: 1000
- Minimum rating: 100 (prevents going below)
"""

from uuid import UUID

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.player import Player

# Standard ELO parameters
K_FACTOR = 32
DEFAULT_RATING = 1000
MIN_RATING = 100


def calculate_elo_change(
    winner_elo: int,
    loser_elo: int,
) -> tuple[int, int]:
    """Calculate ELO rating changes after a match.

    Args:
        winner_elo: Current ELO of the winner.
        loser_elo: Current ELO of the loser.

    Returns:
        Tuple of (winner_new_elo, loser_new_elo).
    """
    expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
    expected_loser = 1 - expected_winner

    winner_new = max(MIN_RATING, round(winner_elo + K_FACTOR * (1 - expected_winner)))
    loser_new = max(MIN_RATING, round(loser_elo + K_FACTOR * (0 - expected_loser)))

    return winner_new, loser_new


def calculate_elo_draw(
    elo_a: int,
    elo_b: int,
) -> tuple[int, int]:
    """Calculate ELO changes for a draw.

    Args:
        elo_a: Player A's current ELO.
        elo_b: Player B's current ELO.

    Returns:
        Tuple of (a_new_elo, b_new_elo).
    """
    expected_a = 1 / (1 + 10 ** ((elo_b - elo_a) / 400))
    expected_b = 1 - expected_a

    a_new = max(MIN_RATING, round(elo_a + K_FACTOR * (0.5 - expected_a)))
    b_new = max(MIN_RATING, round(elo_b + K_FACTOR * (0.5 - expected_b)))

    return a_new, b_new


async def update_elo_after_match(
    db: AsyncSession,
    winner_id: UUID | None,
    player1_id: UUID,
    player2_id: UUID,
) -> dict:
    """Update ELO ratings after a ranked match.

    Args:
        db: Database session.
        winner_id: UUID of the winner, or None for a draw.
        player1_id: Player 1 UUID.
        player2_id: Player 2 UUID.

    Returns:
        Dict with old/new ELO for both players.
    """
    p1 = await db.get(Player, player1_id)
    p2 = await db.get(Player, player2_id)

    if not p1 or not p2:
        return {}

    old_p1_elo = p1.elo_rating
    old_p2_elo = p2.elo_rating

    if winner_id is None:
        # Draw
        p1.elo_rating, p2.elo_rating = calculate_elo_draw(old_p1_elo, old_p2_elo)
    elif winner_id == player1_id:
        p1.elo_rating, p2.elo_rating = calculate_elo_change(old_p1_elo, old_p2_elo)
        p1.ranked_wins += 1
        p2.ranked_losses += 1
    else:
        p2.elo_rating, p1.elo_rating = calculate_elo_change(old_p2_elo, old_p1_elo)
        p2.ranked_wins += 1
        p1.ranked_losses += 1

    await db.commit()

    return {
        "player1": {
            "id": str(player1_id),
            "old_elo": old_p1_elo,
            "new_elo": p1.elo_rating,
            "change": p1.elo_rating - old_p1_elo,
        },
        "player2": {
            "id": str(player2_id),
            "old_elo": old_p2_elo,
            "new_elo": p2.elo_rating,
            "change": p2.elo_rating - old_p2_elo,
        },
    }


async def get_leaderboard(
    db: AsyncSession,
    limit: int = 50,
) -> list[dict]:
    """Get the top players by ELO rating.

    Args:
        db: Database session.
        limit: Max number of players to return.

    Returns:
        List of dicts with rank, display_name, elo_rating, ranked_wins, ranked_losses.
    """
    result = await db.execute(
        select(Player)
        .where((Player.ranked_wins + Player.ranked_losses) > 0)
        .order_by(desc(Player.elo_rating))
        .limit(limit)
    )
    players = result.scalars().all()

    return [
        {
            "rank": i + 1,
            "player_id": str(p.id),
            "display_name": p.display_name,
            "elo_rating": p.elo_rating,
            "ranked_wins": p.ranked_wins,
            "ranked_losses": p.ranked_losses,
        }
        for i, p in enumerate(players)
    ]


async def get_player_rank(
    db: AsyncSession,
    player_id: UUID,
) -> dict | None:
    """Get a specific player's rank and stats.

    Args:
        db: Database session.
        player_id: The player's UUID.

    Returns:
        Dict with rank info, or None if player hasn't played ranked.
    """
    player = await db.get(Player, player_id)
    if not player or (player.ranked_wins + player.ranked_losses) == 0:
        return None

    # Count players with higher ELO
    result = await db.execute(
        select(func.count())
        .select_from(Player)
        .where(
            Player.elo_rating > player.elo_rating,
            (Player.ranked_wins + Player.ranked_losses) > 0,
        )
    )
    rank = result.scalar_one() + 1

    return {
        "rank": rank,
        "player_id": str(player_id),
        "display_name": player.display_name,
        "elo_rating": player.elo_rating,
        "ranked_wins": player.ranked_wins,
        "ranked_losses": player.ranked_losses,
    }
