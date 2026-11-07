"""projects, project members and admin/builder/client roles

Replaces document sensitivity with project-membership access control:
  - create projects (seeded with the portal's projects) and project_members
  - documents.project_id becomes a foreign key to projects
  - drop documents.sensitivity
  - users.role is restricted to admin | builder | client ('user' -> 'client')

Revision ID: c3f9a1d7e2b4
Revises: b7d4e2a9c1f3
Create Date: 2026-11-07

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c3f9a1d7e2b4"
down_revision = "b7d4e2a9c1f3"
branch_labels = None
depends_on = None

_SEED_PROJECTS = [
    ("p-101", "Surrey Rear Extension"),
    ("p-102", "Guildford Loft Conversion"),
    ("p-103", "Epsom Kitchen Remodel"),
    ("p-104", "Reigate Wraparound Extension"),
    ("p-105", "Cobham Garden Studio"),
]


def upgrade() -> None:
    projects = op.create_table(
        "projects",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.bulk_insert(projects, [{"id": i, "name": n} for i, n in _SEED_PROJECTS])

    op.create_table(
        "project_members",
        sa.Column(
            "project_id",
            sa.Text(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"])

    # Documents tagged with a project id that doesn't exist become admin-only legacy docs.
    op.execute(
        "UPDATE documents SET project_id = NULL "
        "WHERE project_id IS NOT NULL AND project_id NOT IN (SELECT id FROM projects)"
    )
    op.create_foreign_key(
        "fk_documents_project_id", "documents", "projects", ["project_id"], ["id"]
    )
    op.drop_column("documents", "sensitivity")

    op.execute(
        "UPDATE users SET role = 'client' WHERE role NOT IN ('admin', 'builder', 'client')"
    )
    op.create_check_constraint(
        "ck_users_role", "users", "role IN ('admin', 'builder', 'client')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.execute("UPDATE users SET role = 'user' WHERE role IN ('builder', 'client')")

    op.add_column(
        "documents",
        sa.Column("sensitivity", sa.Text(), nullable=False, server_default="STANDARD"),
    )
    op.alter_column("documents", "sensitivity", server_default=None)
    op.drop_constraint("fk_documents_project_id", "documents", type_="foreignkey")

    op.drop_index("ix_project_members_user_id", table_name="project_members")
    op.drop_table("project_members")
    op.drop_table("projects")
