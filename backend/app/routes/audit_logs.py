import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies import CurrentUser, DBSession, require_roles
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.audit_log import AuditLogResponse
from app.schemas.common import PaginatedResponse
import math

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


def get_repo(session: DBSession) -> AuditLogRepository:
    return AuditLogRepository(session)


@router.get(
    "/",
    response_model=PaginatedResponse[AuditLogResponse],
    summary="Listar logs de auditoria",
    dependencies=[require_roles("admin")],
)
async def list_audit_logs(
    repo: Annotated[AuditLogRepository, Depends(get_repo)],
    _current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    entity_id: uuid.UUID | None = Query(default=None),
    action: str | None = Query(default=None, pattern="^(CREATE|UPDATE|DELETE)$"),
    actor_id: uuid.UUID | None = Query(default=None),
) -> PaginatedResponse[AuditLogResponse]:
    items, total = await repo.list(
        page=page,
        size=size,
        entity_id=entity_id,
        action=action,
        actor_id=actor_id,
    )
    return PaginatedResponse(
        items=[AuditLogResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )
