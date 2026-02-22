"""Turn SQLAlchemy model."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Turn(Base):
    __tablename__ = "turns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    round_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False
    )
    turn_number: Mapped[int] = mapped_column(Integer, nullable=False)
    p1_action: Mapped[str] = mapped_column(String(20), nullable=False)
    p2_action: Mapped[str] = mapped_column(String(20), nullable=False)
    p1_ki_before: Mapped[int] = mapped_column(Integer, nullable=False)
    p2_ki_before: Mapped[int] = mapped_column(Integer, nullable=False)
    p1_ki_after: Mapped[int] = mapped_column(Integer, nullable=False)
    p2_ki_after: Mapped[int] = mapped_column(Integer, nullable=False)
    outcome: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    round: Mapped["Round"] = relationship("Round", back_populates="turns")
