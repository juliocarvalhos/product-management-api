"""create products table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-12 00:01:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("descricao", sa.Text, nullable=True),
        sa.Column("preco", sa.Numeric(12, 2), nullable=False),
        sa.Column("quantidade", sa.Integer, nullable=False, server_default="0"),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("preco >= 0", name="ck_products_preco_positive"),
        sa.CheckConstraint("quantidade >= 0", name="ck_products_quantidade_positive"),
    )
    op.create_index("idx_products_nome", "products", ["nome"])
    op.create_index("idx_products_ativo", "products", ["ativo"])
    op.create_index("idx_products_preco", "products", ["preco"])
    op.create_index(
        "idx_products_active_only",
        "products",
        ["id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_products_active_only", table_name="products")
    op.drop_index("idx_products_preco", table_name="products")
    op.drop_index("idx_products_ativo", table_name="products")
    op.drop_index("idx_products_nome", table_name="products")
    op.drop_table("products")
