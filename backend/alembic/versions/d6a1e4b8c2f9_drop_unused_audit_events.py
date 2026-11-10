"""drop unused audit_events table

The table was created by a migration that no longer exists, so databases
built from the current migrations never had it; older ones still do, always
empty and unused by any code. IF EXISTS makes this safe for both. Audit
logging is planned separately (see docs/todo.md).

Revision ID: d6a1e4b8c2f9
Revises: c3d8f1a6e2b4
Create Date: 2026-11-10

"""

from alembic import op

revision = "d6a1e4b8c2f9"
down_revision = "c3d8f1a6e2b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS audit_events")


def downgrade() -> None:
    # Intentionally empty: no migration in this history ever created the
    # table, so there's nothing to restore.
    pass
