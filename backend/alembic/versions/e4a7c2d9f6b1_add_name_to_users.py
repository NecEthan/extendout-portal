"""add name to users

Revision ID: e4a7c2d9f6b1
Revises: d8e2b6f4a1c9
Create Date: 2026-11-07

"""

import sqlalchemy as sa
from alembic import op

revision = "e4a7c2d9f6b1"
down_revision = "d8e2b6f4a1c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "name")
