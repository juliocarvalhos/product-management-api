"""create audit_logs table

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-12 00:02:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("actor_id", UUID(as_uuid=True), nullable=True),
        sa.Column("payload", JSONB, nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_audit_logs_entity_id", "audit_logs", ["entity_id"])
    op.create_index("idx_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("idx_audit_logs_occurred_at", "audit_logs", ["occurred_at"])


def downgrade() -> None:
    op.drop_index("idx_audit_logs_occurred_at", table_name="audit_logs")
    op.drop_index("idx_audit_logs_actor_id", table_name="audit_logs")
    op.drop_index("idx_audit_logs_entity_id", table_name="audit_logs")
    op.drop_table("audit_logs")
