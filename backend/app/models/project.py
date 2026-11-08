import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Identity, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    client: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    address: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    # On track | At risk | Delayed | Complete
    health: Mapped[str] = mapped_column(Text, nullable=False, server_default="On track")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ProjectMember(Base):
    """Link table: which users may access which projects (admins see all)."""

    __tablename__ = "project_members"

    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
