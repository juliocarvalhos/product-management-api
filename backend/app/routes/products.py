import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.dependencies import CurrentUser, DBSession, require_roles
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.product import (
    ProductCreate,
    ProductFilters,
    ProductResponse,
    ProductUpdate,
)
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["Products"])


def get_product_service(session: DBSession) -> ProductService:
    # Fix 5: publisher not passed here — ProductService creates its own instance.
    # In tests, override this dependency to inject a mock publisher instead.
    return ProductService(session)


@router.get(
    "/",
    response_model=PaginatedResponse[ProductResponse],
    summary="Listar produtos",
    description="Retorna lista paginada de produtos com filtros opcionais.",
)
async def list_products(
    service: Annotated[ProductService, Depends(get_product_service)],
    _current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    nome: str | None = Query(default=None),
    ativo: bool | None = Query(default=None),
    preco_min: float | None = Query(default=None, ge=0),
    preco_max: float | None = Query(default=None, ge=0),
    order_by: str = Query(default="created_at", pattern="^(nome|preco|created_at|quantidade)$"),
    order_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> PaginatedResponse[ProductResponse]:
    filters = ProductFilters(
        nome=nome,
        ativo=ativo,
        preco_min=preco_min,
        preco_max=preco_max,
        order_by=order_by,
        order_dir=order_dir,
    )
    return await service.list_products(filters, page, size)


@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar produto",
    description="Cria um novo produto e publica evento `product.created` no RabbitMQ.",
    dependencies=[require_roles("editor", "admin")],
)
async def create_product(
    body: ProductCreate,
    service: Annotated[ProductService, Depends(get_product_service)],
    current_user: CurrentUser,
) -> ProductResponse:
    return await service.create_product(body, current_user.id)


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Buscar produto por ID",
)
async def get_product(
    product_id: uuid.UUID,
    service: Annotated[ProductService, Depends(get_product_service)],
    _current_user: CurrentUser,
) -> ProductResponse:
    return await service.get_product(product_id)


@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Atualizar produto",
    description="Atualiza produto e publica evento `product.updated` no RabbitMQ.",
    dependencies=[require_roles("editor", "admin")],
)
async def update_product(
    product_id: uuid.UUID,
    body: ProductUpdate,
    service: Annotated[ProductService, Depends(get_product_service)],
    current_user: CurrentUser,
) -> ProductResponse:
    return await service.update_product(product_id, body, current_user.id)


@router.delete(
    "/{product_id}",
    response_model=MessageResponse,
    summary="Remover produto",
    description="Soft delete do produto e publica evento `product.deleted` no RabbitMQ.",
    dependencies=[require_roles("admin")],
)
async def delete_product(
    product_id: uuid.UUID,
    service: Annotated[ProductService, Depends(get_product_service)],
    current_user: CurrentUser,
) -> MessageResponse:
    await service.delete_product(product_id, current_user.id)
    return MessageResponse(message="Product deleted successfully")
