import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ProductEvent(BaseModel):
    event_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_type: Literal["product.created", "product.updated", "product.deleted"]
    schema_version: str = "1.0"
    occurred_at: datetime
    actor_id: uuid.UUID | None
    entity_id: uuid.UUID
    entity_type: str = "product"
    payload: dict[str, Any | None]

    model_config = {"json_encoders": {uuid.UUID: str, datetime: lambda v: v.isoformat()}}
