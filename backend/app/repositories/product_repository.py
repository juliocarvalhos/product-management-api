import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


class ProductRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _active_query(self):
        return select(Product).where(Product.deleted_at.is_(None))

    async def get_by_id(self, product_id: uuid.UUID) -> Product | None:
        result = await self.session.execute(
            self._active_query().where(Product.id == product_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        page: int = 1,
        size: int = 20,
        nome: str | None = None,
        ativo: bool | None = None,
        preco_min: Decimal | None = None,
        preco_max: Decimal | None = None,
        order_by: str = "created_at",
        order_dir: str = "desc",
    ) -> tuple[list[Product], int]:
        query = self._active_query()

        if nome:
            query = query.where(Product.nome.ilike(f"%{nome}%"))
        if ativo is not None:
            query = query.where(Product.ativo == ativo)
        if preco_min is not None:
            query = query.where(Product.preco >= preco_min)
        if preco_max is not None:
            query = query.where(Product.preco <= preco_max)

        count_result = await self.session.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar_one()

        column = getattr(Product, order_by, Product.created_at)
        sort = desc(column) if order_dir == "desc" else asc(column)
        query = query.order_by(sort).offset((page - 1) * size).limit(size)

        result = await self.session.execute(query)
        return list(result.scalars().all()), total

    async def create(self, **kwargs) -> Product:
        product = Product(**kwargs)
        self.session.add(product)
        await self.session.flush()
        await self.session.refresh(product)
        return product

    async def update(self, product: Product, **kwargs) -> Product:
        for key, value in kwargs.items():
            if value is not None:
                setattr(product, key, value)
        product.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.refresh(product)
        return product

    async def soft_delete(self, product: Product) -> Product:
        product.deleted_at = datetime.now(timezone.utc)
        product.ativo = False
        await self.session.flush()
        return product
