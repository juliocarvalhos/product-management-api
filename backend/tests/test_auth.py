import pytest
from httpx import AsyncClient

from app.models.user import User


class TestLogin:
    async def test_login_success(self, client: AsyncClient, test_user: User):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "password123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # Refresh token is delivered as HttpOnly cookie, not in the body
        assert "refresh_token" not in data
        assert "refresh_token" in client.cookies

    async def test_login_wrong_password(self, client: AsyncClient, test_user: User):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "wrongpassword"},
        )
        assert resp.status_code == 401

    async def test_login_unknown_email(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "validpassword"},
        )
        assert resp.status_code == 401

    async def test_login_invalid_body(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/login", json={"email": "notanemail"})
        assert resp.status_code == 422


class TestRefresh:
    async def test_refresh_success(self, client: AsyncClient, test_user: User):
        await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "password123"},
        )
        resp = await client.post("/api/v1/auth/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" not in data
        assert "refresh_token" in client.cookies

    async def test_refresh_missing_cookie(self, client: AsyncClient):
        client.cookies.clear()
        resp = await client.post("/api/v1/auth/refresh")
        assert resp.status_code == 401

    async def test_refresh_rotation_rejects_reuse(self, client: AsyncClient, test_user: User):
        # Login and capture the original refresh token
        await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "password123"},
        )
        original_token = client.cookies.get("refresh_token")

        # First refresh succeeds and blacklists the original JTI
        resp1 = await client.post("/api/v1/auth/refresh")
        assert resp1.status_code == 200

        # Restore the (now blacklisted) original cookie and try again
        client.cookies.set("refresh_token", original_token)
        resp2 = await client.post("/api/v1/auth/refresh")
        assert resp2.status_code == 401


class TestMe:
    async def test_me_authenticated(self, client: AsyncClient, auth_headers: dict, test_user: User):
        resp = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == test_user.email
        assert data["username"] == test_user.username

    async def test_me_returns_role(self, client: AsyncClient, auth_headers: dict, test_user: User):
        resp = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["role"] == test_user.role

    async def test_me_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 403

    async def test_me_invalid_token(self, client: AsyncClient):
        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401


class TestLogout:
    async def test_logout_success(self, client: AsyncClient, test_user: User):
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "password123"},
        )
        access_token = login.json()["access_token"]

        resp = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Logged out successfully"
        assert client.cookies.get("refresh_token") in (None, "")

    async def test_logout_invalidates_refresh_token(
        self, client: AsyncClient, test_user: User
    ):
        # Login to get both tokens
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "password123"},
        )
        access_token = login.json()["access_token"]
        original_refresh = client.cookies.get("refresh_token")
        assert original_refresh

        # Logout blacklists the refresh token JTI
        await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        # Restore the blacklisted cookie and try to refresh
        client.cookies.set("refresh_token", original_refresh)
        resp = await client.post("/api/v1/auth/refresh")
        assert resp.status_code == 401
