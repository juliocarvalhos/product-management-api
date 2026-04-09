import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=255, examples=["Mochila Executiva"])
    descricao: str | None = Field(default=None, examples=["Mochila resistente com compartimento para notebook"])
    preco: Decimal = Field(gt=0, decimal_places=2, examples=[199.90])
    quantidade: int = Field(ge=0, default=0, examples=[50])
    ativo: bool = Field(default=True)

    model_config = {
        "json_schema_extra": {
            "example": {
                "nome": "Mochila Executiva",
                "descricao": "Mochila resistente com compartimento para notebook",
                "preco": 199.90,
                "quantidade": 50,
                "ativo": True,
            }
        }
    }


class ProductUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=255)
    descricao: str | None = None
    preco: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    quantidade: int | None = Field(default=None, ge=0)
    ativo: bool | None = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "nome": "Mochila Executiva Premium",
                "preco": 249.90,
                "quantidade": 30,
            }
        }
    }


class ProductResponse(BaseModel):
    id: uuid.UUID
    nome: str
    descricao: str | None
    preco: Decimal
    quantidade: int
    ativo: bool
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "nome": "Mochila Executiva",
                "descricao": "Mochila resistente com compartimento para notebook",
                "preco": 199.90,
                "quantidade": 50,
                "ativo": True,
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-01-15T10:30:00Z",
            }
        },
    }


class ProductFilters(BaseModel):
    nome: str | None = None
    ativo: bool | None = None
    preco_min: Decimal | None = None
    preco_max: Decimal | None = None
    order_by: str = Field(default="created_at", pattern="^(nome|preco|created_at|quantidade)$")
    order_dir: str = Field(default="desc", pattern="^(asc|desc)$")
