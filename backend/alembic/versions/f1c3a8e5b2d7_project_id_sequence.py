"""project id sequence: new projects get p-<next number> from Postgres

Revision ID: f1c3a8e5b2d7
Revises: e4a7c2d9f6b1
Create Date: 2026-11-07

"""

from alembic import op

revision = "f1c3a8e5b2d7"
down_revision = "e4a7c2d9f6b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE project_number_seq")
    # Continue after the highest existing "p-<n>" id (or start at p-101).
    op.execute(
        """
        SELECT setval(
            'project_number_seq',
            COALESCE(
                (SELECT MAX(CAST(SUBSTR(id, 3) AS INTEGER))
                 FROM projects WHERE id ~ '^p-[0-9]+$'),
                100
            )
        )
        """
    )
    op.execute(
        "ALTER TABLE projects ALTER COLUMN id "
        "SET DEFAULT 'p-' || nextval('project_number_seq')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE projects ALTER COLUMN id DROP DEFAULT")
    op.execute("DROP SEQUENCE project_number_seq")
