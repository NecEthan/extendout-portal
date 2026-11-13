"""passwordless login: drop users.password_hash, lowercase emails

People now log in with a code emailed to them, so passwords are no longer
stored. Emails are matched case-insensitively and stored lowercase from now on;
existing ones are lowercased here unless that would clash with another user.

Revision ID: a3f8c1e6d9b2
Revises: e7b3c9d1a5f2
Create Date: 2026-11-12

"""

import sqlalchemy as sa

from alembic import op

revision = "a3f8c1e6d9b2"
down_revision = "e7b3c9d1a5f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "password_hash")
    op.execute(
        """
        UPDATE users AS u
        SET email = lower(u.email)
        WHERE u.email <> lower(u.email)
          AND NOT EXISTS (
            SELECT 1 FROM users AS other
            WHERE other.id <> u.id AND lower(other.email) = lower(u.email)
          )
        """
    )


def downgrade() -> None:
    # Old password hashes are gone; the column comes back empty.
    op.add_column("users", sa.Column("password_hash", sa.Text(), nullable=True))
