"""add audit_events (append-only audit log)

Revision ID: e7b3c9d1a5f2
Revises: d6a1e4b8c2f9
Create Date: 2026-11-11

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "e7b3c9d1a5f2"
down_revision = "d6a1e4b8c2f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        # No foreign keys: entries must outlive deleted users and projects.
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_email", sa.Text(), nullable=True),
        sa.Column("actor_name", sa.Text(), nullable=True),
        sa.Column("actor_role", sa.Text(), nullable=True),
        sa.Column("method", sa.Text(), nullable=False),
        sa.Column("route", sa.Text(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("entity_type", sa.Text(), nullable=True),
        sa.Column("entity_id", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.Text(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column(
            "details",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_audit_events_created_at", "audit_events", [sa.text("created_at DESC")]
    )
    for name, column in [
        ("ix_audit_events_project_created", "project_id"),
        ("ix_audit_events_actor_created", "actor_user_id"),
        ("ix_audit_events_outcome_created", "outcome"),
    ]:
        op.create_index(
            name, "audit_events", [sa.text(column), sa.text("created_at DESC")]
        )

    # Append-only: reject UPDATE / DELETE / TRUNCATE for every role, including
    # the superuser the app currently connects as. Retention cleanup must
    # disable the trigger explicitly as a privileged user.
    op.execute(
        """
        CREATE FUNCTION audit_events_append_only() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'audit_events is append-only (% blocked)', TG_OP;
        END;
        $$;
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_events_no_update_delete
        BEFORE UPDATE OR DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_events_no_truncate
        BEFORE TRUNCATE ON audit_events
        FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only();
        """
    )


def downgrade() -> None:
    op.drop_table("audit_events")  # drops its triggers and indexes too
    op.execute("DROP FUNCTION IF EXISTS audit_events_append_only()")
