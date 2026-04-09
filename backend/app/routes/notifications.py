import json

from fastapi import APIRouter

from app.db.redis import get_redis
from app.dependencies import CurrentUser, require_roles
from app.messaging.notifier import _NOTIFICATIONS_KEY, _READ_KEY
from app.schemas.common import MessageResponse
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "/",
    response_model=list[NotificationResponse],
    summary="Listar notificações",
    description="Retorna as notificações de estoque zerado, indicando quais já foram lidas.",
    dependencies=[require_roles("editor", "admin")],
)
async def list_notifications(_current_user: CurrentUser) -> list[NotificationResponse]:
    redis = await get_redis()
    raw = await redis.lrange(_NOTIFICATIONS_KEY, 0, -1)
    read_ids: set[str] = set(await redis.smembers(_READ_KEY))

    notifications = []
    for item in raw:
        data = json.loads(item)
        notifications.append(
            NotificationResponse(
                **data,
                read=data["id"] in read_ids,
            )
        )
    return notifications


@router.patch(
    "/{notification_id}/read",
    response_model=MessageResponse,
    summary="Marcar notificação como lida",
    dependencies=[require_roles("editor", "admin")],
)
async def mark_as_read(notification_id: str, _current_user: CurrentUser) -> MessageResponse:
    redis = await get_redis()
    await redis.sadd(_READ_KEY, notification_id)
    return MessageResponse(message="Notification marked as read")
