"""drop project health

Revision ID: c5b2f7a9d4e1
Revises: a7d4e9c1f3b8
Create Date: 2026-11-08

"""

import sqlalchemy as sa

from alembic import op

revision = "c5b2f7a9d4e1"
down_revision = "a7d4e9c1f3b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("projects", "health")


def downgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("health", sa.Text(), nullable=False, server_default="On track"),
    )
