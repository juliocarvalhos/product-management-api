"""add role to users

Revision ID: 0004
Revises: 0003
Create Date: 2024-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(20), nullable=False, server_default="leitor"),
    )


def downgrade() -> None:
    op.drop_column("users", "role")
