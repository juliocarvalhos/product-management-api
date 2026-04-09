"""
Stock depletion notifier.

Persists notifications in Redis and emits a structured log.
In production the log entry would be replaced (or supplemented) by
an email, push, or webhook dispatch.
"""

import json
import uuid
from datetime import datetime, timezone

from app.core.logging import get_logger
from app.db.redis import get_redis

logger = get_logger(__name__)

_NOTIFICATIONS_KEY = "notifications:stock"
_READ_KEY = "notifications:read"
_MAX_NOTIFICATIONS = 100


async def notify_stock_depleted(product_id: uuid.UUID, actor_id: uuid.UUID | None, product_name: str) -> None:
    """Persist a stock-depleted notification in Redis and emit a structured log."""
    notification = {
        "id": str(uuid.uuid4()),
        "product_id": str(product_id),
        "product_name": product_name,
        "actor_id": str(actor_id) if actor_id else None,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }

    redis = await get_redis()
    await redis.lpush(_NOTIFICATIONS_KEY, json.dumps(notification))
    await redis.ltrim(_NOTIFICATIONS_KEY, 0, _MAX_NOTIFICATIONS - 1)

    logger.warning(
        "stock depleted",
        notification="stock_depleted",
        product_id=str(product_id),
        product_name=product_name,
        actor_id=str(actor_id) if actor_id else None,
    )
