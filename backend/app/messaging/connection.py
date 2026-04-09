import aio_pika
from aio_pika import RobustConnection

from app.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_connection: RobustConnection | None = None

EXCHANGE_NAME = "product.events"
EXCHANGE_DLX = "product.events.dlx"
QUEUE_NAME = "audit.product.events"
QUEUE_DLQ = "audit.product.events.dead"
ROUTING_KEY_BINDING = "product.*"
ROUTING_KEY_DLQ = "audit.product.events.dead"


async def get_connection() -> RobustConnection:
    global _connection
    if _connection is None or _connection.is_closed:
        _connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
        logger.info("rabbitmq connected")
    return _connection


async def close_connection() -> None:
    global _connection
    if _connection and not _connection.is_closed:
        await _connection.close()
        logger.info("rabbitmq connection closed")


async def setup_topology() -> None:
    """Declare exchanges, queues and bindings."""
    conn = await get_connection()
    async with conn.channel() as channel:
        # Dead-letter exchange
        dlx = await channel.declare_exchange(
            EXCHANGE_DLX, aio_pika.ExchangeType.DIRECT, durable=True
        )
        # Main exchange
        exchange = await channel.declare_exchange(
            EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True
        )
        # Dead-letter queue
        dlq = await channel.declare_queue(QUEUE_DLQ, durable=True)
        await dlq.bind(dlx, routing_key=ROUTING_KEY_DLQ)

        # Main queue with DLX config
        queue = await channel.declare_queue(
            QUEUE_NAME,
            durable=True,
            arguments={
                "x-dead-letter-exchange": EXCHANGE_DLX,
                "x-dead-letter-routing-key": ROUTING_KEY_DLQ,
                "x-message-ttl": 60000,
            },
        )
        await queue.bind(exchange, routing_key=ROUTING_KEY_BINDING)

    logger.info("rabbitmq topology configured", exchange=EXCHANGE_NAME, queue=QUEUE_NAME)
