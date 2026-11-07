"""add project_id to documents

Revision ID: b7d4e2a9c1f3
Revises: 34e8176c3210
Create Date: 2026-11-07

"""

import sqlalchemy as sa
from alembic import op

revision = "b7d4e2a9c1f3"
down_revision = "34e8176c3210"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("project_id", sa.Text(), nullable=True))
    op.create_index("ix_documents_project_id", "documents", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_documents_project_id", table_name="documents")
    op.drop_column("documents", "project_id")
