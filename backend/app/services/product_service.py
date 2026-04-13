import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.messaging.publisher import ProductEventPublisher
from app.models.product import Product
from app.repositories.product_repository import ProductRepository
from app.schemas.common import PaginatedResponse
from app.schemas.product import ProductCreate, ProductFilters, ProductResponse, ProductUpdate


def _to_dict(product: Product) -> dict:
    # Fix 10: include all timestamp fields so audit logs have a complete snapshot
    return {
        "id": str(product.id),
        "nome": product.nome,
        "descricao": product.descricao,
        "preco": float(product.preco),
        "quantidade": product.quantidade,
        "ativo": product.ativo,
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "updated_at": product.updated_at.isoformat() if product.updated_at else None,
        "deleted_at": product.deleted_at.isoformat() if product.deleted_at else None,
    }


class ProductService:
    # Fix 5: publisher injected via __init__ — no module-level singleton; tests can inject a mock cleanly
    def __init__(self, session: AsyncSession, publisher: ProductEventPublisher | None = None) -> None:
        self.session = session
        self.repo = ProductRepository(session)
        self._publisher = publisher if publisher is not None else ProductEventPublisher()

    async def list_products(
        self, filters: ProductFilters, page: int, size: int
    ) -> PaginatedResponse[ProductResponse]:
        products, total = await self.repo.list(
            page=page,
            size=size,
            nome=filters.nome,
            ativo=filters.ativo,
            preco_min=filters.preco_min,
            preco_max=filters.preco_max,
            order_by=filters.order_by,
            order_dir=filters.order_dir,
        )
        pages = (total + size - 1) // size if total > 0 else 0
        return PaginatedResponse(
            items=[ProductResponse.model_validate(p) for p in products],
            total=total,
            page=page,
            size=size,
            pages=pages,
        )

    async def get_product(self, product_id: uuid.UUID) -> ProductResponse:
        product = await self.repo.get_by_id(product_id)
        if not product:
            raise NotFoundException("Product")
        return ProductResponse.model_validate(product)

    async def create_product(
        self, data: ProductCreate, actor_id: uuid.UUID | None = None
    ) -> ProductResponse:
        product = await self.repo.create(**data.model_dump())
        # Fix 2: commit to DB BEFORE publishing to RabbitMQ — prevents orphan events
        # if the commit fails after publish (dual-write without Outbox).
        await self.session.commit()
        response = ProductResponse.model_validate(product)
        await self._publisher.product_created(product.id, actor_id, _to_dict(product))
        return response

    async def update_product(
        self, product_id: uuid.UUID, data: ProductUpdate, actor_id: uuid.UUID | None = None
    ) -> ProductResponse:
        product = await self.repo.get_by_id(product_id)
        if not product:
            raise NotFoundException("Product")

        before = _to_dict(product)
        # Fix 6: exclude_unset=True so callers can explicitly null-out optional fields
        # (e.g. clearing a description). The old `if v is not None` filter silently
        # ignored any intentional None value.
        updates = data.model_dump(exclude_unset=True)
        product = await self.repo.update(product, **updates)
        # Fix 2: commit before publish
        await self.session.commit()
        after = _to_dict(product)

        response = ProductResponse.model_validate(product)
        await self._publisher.product_updated(product.id, actor_id, before, after)
        return response

    async def delete_product(
        self, product_id: uuid.UUID, actor_id: uuid.UUID | None = None
    ) -> None:
        product = await self.repo.get_by_id(product_id)
        if not product:
            raise NotFoundException("Product")

        before = _to_dict(product)
        await self.repo.soft_delete(product)
        # Fix 2: commit before publish
        await self.session.commit()
        await self._publisher.product_deleted(product.id, actor_id, before)
