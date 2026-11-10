"""add project photos

Revision ID: c3d8f1a6e2b4
Revises: b9e4c2a7d1f3
Create Date: 2026-11-10

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "c3d8f1a6e2b4"
down_revision = "b9e4c2a7d1f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.Text(), nullable=False, unique=True),
        sa.Column("content_type", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "uploaded_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_project_photos_project_id", "project_photos", ["project_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_project_photos_project_id", table_name="project_photos")
    op.drop_table("project_photos")
