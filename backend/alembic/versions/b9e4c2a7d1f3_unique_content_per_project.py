"""unique document content per project

Copies documents.project_id onto document_versions so a partial unique index
can stop the same file being uploaded twice to one project, including by two
simultaneous requests. FAILED versions are excluded so failed uploads can be
retried.

Revision ID: b9e4c2a7d1f3
Revises: c5b2f7a9d4e1
Create Date: 2026-11-09

"""

import sqlalchemy as sa

from alembic import op

revision = "b9e4c2a7d1f3"
down_revision = "c5b2f7a9d4e1"
branch_labels = None
depends_on = None

INDEX = "uq_document_versions_project_content_hash"


def upgrade() -> None:
    op.add_column(
        "document_versions",
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id"),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE document_versions v
        SET project_id = d.project_id
        FROM documents d
        WHERE d.id = v.document_id
        """
    )
    # Fails with a clear unique-violation error if the data already contains
    # duplicates; resolve those (delete one copy) and re-run.
    op.create_index(
        INDEX,
        "document_versions",
        ["project_id", "content_hash"],
        unique=True,
        postgresql_where=sa.text("status <> 'FAILED'"),
    )


def downgrade() -> None:
    op.drop_index(INDEX, table_name="document_versions")
    op.drop_column("document_versions", "project_id")
