"""add project details (client, address, health)

Moves the portal's project details from frontend mock data into the database,
seeding the five existing projects with their current values.

Revision ID: d8e2b6f4a1c9
Revises: c3f9a1d7e2b4
Create Date: 2026-11-07

"""

import sqlalchemy as sa
from alembic import op

revision = "d8e2b6f4a1c9"
down_revision = "c3f9a1d7e2b4"
branch_labels = None
depends_on = None

_COLUMNS = {"client": "", "address": "", "health": "On track"}

_SEED = [
    {
        "id": "p-101",
        "client": "Sarah & James Holloway",
        "address": "14 Ashcombe Road, Dorking, RH4 1LX",
        "health": "On track",
    },
    {
        "id": "p-102",
        "client": "Priya Natarajan",
        "address": "7 Pewley Hill, Guildford, GU1 3SN",
        "health": "At risk",
    },
    {
        "id": "p-103",
        "client": "Daniel Okafor",
        "address": "22 Church Street, Epsom, KT17 4PF",
        "health": "On track",
    },
    {
        "id": "p-104",
        "client": "The Bennett Family",
        "address": "3 Doods Way, Reigate, RH2 0JT",
        "health": "Delayed",
    },
    {
        "id": "p-105",
        "client": "Emma Lawson",
        "address": "51 Portsmouth Road, Cobham, KT11 1JQ",
        "health": "Complete",
    },
]


def upgrade() -> None:
    for name, default in _COLUMNS.items():
        op.add_column(
            "projects",
            sa.Column(name, sa.Text(), nullable=False, server_default=default),
        )

    for row in _SEED:
        op.execute(
            sa.text(
                "UPDATE projects SET client = :client, address = :address, "
                "health = :health WHERE id = :id"
            ).bindparams(**row)
        )


def downgrade() -> None:
    for name in _COLUMNS:
        op.drop_column("projects", name)
