import asyncio
import json

import aio_pika
from pydantic import ValidationError

from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.db.redis import get_redis
from app.messaging.connection import EXCHANGE_NAME, QUEUE_NAME, get_connection
from app.messaging.handlers import handle_product_event
from app.messaging.schemas import ProductEvent

logger = get_logger(__name__)

_DEDUP_PREFIX = "dedup:event:"
_DEDUP_TTL = 86400  # 24 hours
_MAX_RETRIES = 3


async def _is_duplicate(event_id: str) -> bool:
    """Returns True if this event_id was already successfully processed."""
    redis = await get_redis()
    key = f"{_DEDUP_PREFIX}{event_id}"
    result = await redis.set(key, "1", ex=_DEDUP_TTL, nx=True)
    return result is None  # None means key already existed


async def _release_dedup(event_id: str) -> None:
    """Remove dedup key so the event can be retried after a processing failure."""
    redis = await get_redis()
    await redis.delete(f"{_DEDUP_PREFIX}{event_id}")


async def _process_message(message: aio_pika.IncomingMessage) -> None:
    headers = message.headers or {}
    retry_count = int(headers.get("x-retry-count", 0))

    try:
        body = json.loads(message.body)
        event = ProductEvent.model_validate(body)
    except (json.JSONDecodeError, ValidationError) as exc:
        logger.error("invalid message, sending to DLQ", error=str(exc))
        await message.nack(requeue=False)
        return

    event_id = str(event.event_id)

    if await _is_duplicate(event_id):
        logger.info("duplicate event, discarding", event_id=event_id)
        await message.ack()
        return

    try:
        async with AsyncSessionLocal() as session:
            await handle_product_event(event, session)
        logger.info("audit log created", event_type=event.event_type, entity_id=str(event.entity_id))
        await message.ack()
    except Exception as exc:
        logger.error("error processing event", error=str(exc), retry_count=retry_count)
        await _release_dedup(event_id)

        if retry_count < _MAX_RETRIES:
            await message.nack(requeue=False)
            conn = await get_connection()
            async with conn.channel() as channel:
                exchange = await channel.get_exchange(EXCHANGE_NAME)
                new_headers = dict(headers)
                new_headers["x-retry-count"] = retry_count + 1
                republish = aio_pika.Message(
                    body=message.body,
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    headers=new_headers,
                )
                await exchange.publish(republish, routing_key=event.event_type)
        else:
            logger.error("max retries exceeded, sending to DLQ", event_id=event_id)
            await message.nack(requeue=False)


async def start_consumer() -> None:
    """Start consuming messages in a background task."""
    while True:
        try:
            conn = await get_connection()
            async with conn.channel() as channel:
                await channel.set_qos(prefetch_count=10)
                queue = await channel.get_queue(QUEUE_NAME)
                logger.info("consumer started", queue=QUEUE_NAME)
                async with queue.iterator() as queue_iter:
                    async for message in queue_iter:
                        await _process_message(message)
        except asyncio.CancelledError:
            logger.info("consumer cancelled")
            return
        except Exception as exc:
            logger.error("consumer error, reconnecting in 5s", error=str(exc))
            await asyncio.sleep(5)
