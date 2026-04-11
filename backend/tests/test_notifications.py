import json
import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import StatefulRedisMock


def _make_notification(product_name: str = "Produto Esgotado") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "product_id": str(uuid.uuid4()),
        "product_name": product_name,
        "actor_id": None,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }


class TestListNotifications:
    async def test_list_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/notifications/")
        assert resp.status_code == 403

    async def test_list_requires_editor_or_admin(
        self, client: AsyncClient, leitor_auth_headers: dict
    ):
        resp = await client.get("/api/v1/notifications/", headers=leitor_auth_headers)
        assert resp.status_code == 403

    async def test_list_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/notifications/", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_shows_notifications(
        self, client: AsyncClient, auth_headers: dict, mock_redis: StatefulRedisMock
    ):
        notif = _make_notification("Mochila Esgotada")
        await mock_redis.lpush("notifications:stock", json.dumps(notif))

        resp = await client.get("/api/v1/notifications/", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["product_name"] == "Mochila Esgotada"
        assert items[0]["read"] is False

    async def test_list_editor_can_access(
        self, client: AsyncClient, editor_auth_headers: dict
    ):
        resp = await client.get("/api/v1/notifications/", headers=editor_auth_headers)
        assert resp.status_code == 200


class TestMarkAsRead:
    async def test_mark_as_read(
        self, client: AsyncClient, auth_headers: dict, mock_redis: StatefulRedisMock
    ):
        notif = _make_notification()
        notif_id = notif["id"]
        await mock_redis.lpush("notifications:stock", json.dumps(notif))

        resp = await client.patch(
            f"/api/v1/notifications/{notif_id}/read", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Notification marked as read"

    async def test_mark_as_read_reflects_in_list(
        self, client: AsyncClient, auth_headers: dict, mock_redis: StatefulRedisMock
    ):
        notif = _make_notification()
        notif_id = notif["id"]
        await mock_redis.lpush("notifications:stock", json.dumps(notif))

        # Mark as read
        await client.patch(
            f"/api/v1/notifications/{notif_id}/read", headers=auth_headers
        )

        # List should now show read=True
        resp = await client.get("/api/v1/notifications/", headers=auth_headers)
        items = resp.json()
        target = next(i for i in items if i["id"] == notif_id)
        assert target["read"] is True

    async def test_mark_as_read_requires_editor_or_admin(
        self, client: AsyncClient, leitor_auth_headers: dict
    ):
        resp = await client.patch(
            f"/api/v1/notifications/{uuid.uuid4()}/read",
            headers=leitor_auth_headers,
        )
        assert resp.status_code == 403
