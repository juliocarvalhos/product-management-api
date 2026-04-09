import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


class AuditLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        action: str,
        actor_id: uuid.UUID | None = None,
        payload: dict | None = None,
    ) -> AuditLog:
        log = AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            actor_id=actor_id,
            payload=payload,
        )
        self.session.add(log)
        await self.session.flush()
        return log

    async def list(
        self,
        page: int = 1,
        size: int = 20,
        entity_id: uuid.UUID | None = None,
        action: str | None = None,
        actor_id: uuid.UUID | None = None,
    ) -> tuple[list[AuditLog], int]:
        query = select(AuditLog)

        if entity_id:
            query = query.where(AuditLog.entity_id == entity_id)
        if action:
            query = query.where(AuditLog.action == action)
        if actor_id:
            query = query.where(AuditLog.actor_id == actor_id)

        total = await self.session.scalar(
            select(func.count()).select_from(query.subquery())
        ) or 0

        query = query.order_by(AuditLog.occurred_at.desc()).offset((page - 1) * size).limit(size)
        result = await self.session.execute(query)
        return list(result.scalars().all()), total
