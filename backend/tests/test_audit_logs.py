from httpx import AsyncClient

from app.models.audit_log import AuditLog


class TestListAuditLogs:
    async def test_list_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/audit-logs/")
        assert resp.status_code == 403

    async def test_list_requires_admin(
        self, client: AsyncClient, editor_auth_headers: dict
    ):
        resp = await client.get("/api/v1/audit-logs/", headers=editor_auth_headers)
        assert resp.status_code == 403

    async def test_list_returns_paginated(
        self, client: AsyncClient, auth_headers: dict, audit_log: AuditLog
    ):
        resp = await client.get("/api/v1/audit-logs/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert data["total"] >= 1

    async def test_list_filter_by_action(
        self, client: AsyncClient, auth_headers: dict, audit_log: AuditLog
    ):
        # audit_log fixture creates a CREATE entry
        resp = await client.get(
            "/api/v1/audit-logs/",
            params={"action": "CREATE"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) >= 1
        assert all(i["action"] == "CREATE" for i in items)

    async def test_list_filter_action_invalid(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get(
            "/api/v1/audit-logs/",
            params={"action": "INVALID"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
