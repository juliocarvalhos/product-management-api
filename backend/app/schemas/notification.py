from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    product_id: str
    product_name: str
    actor_id: str | None
    occurred_at: datetime
    read: bool
