import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.messaging.notifier import notify_stock_depleted
from app.messaging.schemas import ProductEvent
from app.repositories.audit_log_repository import AuditLogRepository


async def handle_product_event(event: ProductEvent, session: AsyncSession) -> None:
    """Persist a product event as an audit log entry and trigger side-effects."""
    action_map = {
        "product.created": "CREATE",
        "product.updated": "UPDATE",
        "product.deleted": "DELETE",
    }
    action = action_map.get(event.event_type, event.event_type.upper())

    repo = AuditLogRepository(session)
    await repo.create(
        entity_type=event.entity_type,
        entity_id=event.entity_id,
        action=action,
        actor_id=event.actor_id,
        payload=event.payload,
    )
    await session.commit()

    if event.event_type == "product.updated":
        after = event.payload.get("after") or {}
        if after.get("ativo") is True and after.get("quantidade") == 0:
            await notify_stock_depleted(
                product_id=event.entity_id,
                actor_id=event.actor_id,
                product_name=after.get("nome", "unknown"),
            )
