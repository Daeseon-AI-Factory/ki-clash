"""Add ranked ELO, ranked stats, and ad_free fields to players.

Revision ID: b8f3c72e1a44
Revises: a67ac29dd885
Create Date: 2026-02-22
"""

from alembic import op
import sqlalchemy as sa

revision = "b8f3c72e1a44"
down_revision = "a67ac29dd885"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("players", sa.Column("elo_rating", sa.Integer(), server_default="1000", nullable=False))
    op.add_column("players", sa.Column("ranked_wins", sa.Integer(), server_default="0", nullable=False))
    op.add_column("players", sa.Column("ranked_losses", sa.Integer(), server_default="0", nullable=False))
    op.add_column("players", sa.Column("ad_free", sa.Boolean(), server_default="false", nullable=False))


def downgrade() -> None:
    op.drop_column("players", "ad_free")
    op.drop_column("players", "ranked_losses")
    op.drop_column("players", "ranked_wins")
    op.drop_column("players", "elo_rating")
