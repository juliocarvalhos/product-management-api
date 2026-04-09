import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    action: str
    actor_id: uuid.UUID | None
    payload: dict | None
    occurred_at: datetime

    model_config = {"from_attributes": True}


class AuditLogFilters(BaseModel):
    entity_id: uuid.UUID | None = None
    action: str | None = None
    actor_id: uuid.UUID | None = None
