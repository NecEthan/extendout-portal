import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    source_type: Mapped[str] = mapped_column(Text, nullable=False)  # upload | google_docs
    # Access is granted per project via project_members (admins see everything).
    # Nullable only for legacy documents uploaded before projects existed.
    project_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("projects.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner: Mapped["User | None"] = relationship(back_populates="documents")
    versions: Mapped[list["DocumentVersion"]] = relationship(back_populates="document")
