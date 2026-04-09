import uuid
from datetime import datetime, timezone

import aio_pika

from app.core.logging import get_logger
from app.messaging.connection import EXCHANGE_NAME, get_connection
from app.messaging.schemas import ProductEvent

logger = get_logger(__name__)


class ProductEventPublisher:
    async def _publish(self, event: ProductEvent) -> None:
        try:
            conn = await get_connection()
            async with conn.channel() as channel:
                exchange = await channel.get_exchange(EXCHANGE_NAME)
                body = event.model_dump_json().encode()
                message = aio_pika.Message(
                    body=body,
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    message_id=str(event.event_id),
                )
                await exchange.publish(message, routing_key=event.event_type)
                logger.info(
                    "event published",
                    event_type=event.event_type,
                    entity_id=str(event.entity_id),
                )
        except Exception as exc:
            logger.error("failed to publish event", error=str(exc), event_type=event.event_type)

    async def product_created(
        self, product_id: uuid.UUID, actor_id: uuid.UUID | None, after: dict
    ) -> None:
        await self._publish(
            ProductEvent(
                event_type="product.created",
                occurred_at=datetime.now(timezone.utc),
                actor_id=actor_id,
                entity_id=product_id,
                payload={"before": None, "after": after},
            )
        )

    async def product_updated(
        self, product_id: uuid.UUID, actor_id: uuid.UUID | None, before: dict, after: dict
    ) -> None:
        await self._publish(
            ProductEvent(
                event_type="product.updated",
                occurred_at=datetime.now(timezone.utc),
                actor_id=actor_id,
                entity_id=product_id,
                payload={"before": before, "after": after},
            )
        )

    async def product_deleted(
        self, product_id: uuid.UUID, actor_id: uuid.UUID | None, before: dict
    ) -> None:
        await self._publish(
            ProductEvent(
                event_type="product.deleted",
                occurred_at=datetime.now(timezone.utc),
                actor_id=actor_id,
                entity_id=product_id,
                payload={"before": before, "after": None},
            )
        )
