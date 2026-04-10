import json
import uuid
from collections.abc import AsyncGenerator
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.postgres import PostgresContainer

from app.db.base import Base
from app.db.redis import get_redis
from app.db.session import get_session
from app.main import app
from app.core.security import hash_password
from app.messaging.publisher import ProductEventPublisher
from app.models.audit_log import AuditLog  # noqa: F401 — ensures table is registered
from app.models.product import Product  # noqa: F401 — ensures table is registered
from app.models.user import User
from app.routes.products import get_product_service
from app.services.product_service import ProductService


# ── Stateful Redis mock ───────────────────────────────────────────────────────
# AsyncMock(return_value=None) is fine for simple cases, but can't model
# blacklisting (setex → get round-trip). This class makes token rotation and
# logout-invalidation tests reliable.

class StatefulRedisMock:
    """In-memory Redis substitute that tracks state across calls within a test."""

    def __init__(self):
        self._store: dict = {}

    async def get(self, key: str):
        return self._store.get(key)

    async def setex(self, key: str, ttl: int, value) -> bool:
        self._store[key] = value
        return True

    async def set(self, key: str, value, ex=None, px=None, nx: bool = False) -> bool:
        self._store[key] = value
        return True

    async def sadd(self, key: str, *values) -> int:
        if key not in self._store:
            self._store[key] = set()
        self._store[key].update(str(v) for v in values)
        return len(values)

    async def smembers(self, key: str) -> set:
        return self._store.get(key, set())

    async def lpush(self, key: str, *values) -> int:
        if key not in self._store:
            self._store[key] = []
        for v in reversed(values):
            self._store[key].insert(0, v)
        return len(self._store[key])

    async def lrange(self, key: str, start: int, end: int) -> list:
        lst = self._store.get(key, [])
        if end == -1:
            return lst[start:]
        return lst[start : end + 1]

    async def ltrim(self, key: str, start: int, end: int) -> bool:
        lst = self._store.get(key, [])
        if end == -1:
            self._store[key] = lst[start:]
        else:
            self._store[key] = lst[start : end + 1]
        return True


# ── Rate limiter: swap Redis storage for in-memory ───────────────────────────
# The slowapi limiter is configured with storage_uri=REDIS_URL. In the test
# environment there is no Redis, so we replace the storage before any test
# runs to avoid connection errors on rate-limited endpoints (login, refresh).

@pytest.fixture(autouse=True, scope="session")
def disable_rate_limiter():
    from app.core.limiter import limiter as app_limiter

    # Disable rate limiting for the test session. Tests hit the login endpoint
    # multiple times (TestLogin, TestRefresh, TestLogout classes call it
    # directly), which would exhaust the 5/min limit quickly from 127.0.0.1.
    app_limiter.enabled = False
    yield
    app_limiter.enabled = True


# ── Real Postgres via testcontainers ─────────────────────────────────────────
# SQLite does not support ILIKE, Numeric(12,2) precision, or UUID natively,
# meaning tests could pass while production-only behaviours remain untested.

@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg


@pytest_asyncio.fixture(scope="session")
async def engine(postgres_container):
    url = (
        postgres_container.get_connection_url()
        .replace("postgresql+psycopg2://", "postgresql+asyncpg://")
        .replace("postgresql://", "postgresql+asyncpg://")
    )
    # NullPool disables connection pooling. Each acquire creates a fresh
    # asyncpg connection, avoiding "Future attached to a different loop"
    # errors that arise when pooled connections are reused across tasks
    # created by BaseHTTPMiddleware.
    e = create_async_engine(url, echo=False, poolclass=NullPool)
    async with e.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield e
    async with e.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await e.dispose()


@pytest_asyncio.fixture(scope="session")
async def session_factory(engine):
    return async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


# ── Per-test session with automatic rollback ──────────────────────────────────

@pytest_asyncio.fixture
async def session(session_factory) -> AsyncGenerator[AsyncSession, None]:
    async with session_factory() as s:
        yield s
        # Best-effort cleanup: ignore errors that occur when the session-scoped
        # event loop is already closing (a known pytest-asyncio 0.24 + NullPool
        # interaction where function-scoped teardowns may fire after the loop
        # has started its own shutdown sequence).
        try:
            await s.rollback()
        except Exception:
            pass


# ── Persistent user fixtures (session-scoped, committed once) ─────────────────

@pytest_asyncio.fixture(scope="session")
async def test_user(session_factory) -> User:
    async with session_factory() as s:
        user = User(
            id=uuid.uuid4(),
            email="test@example.com",
            username="testuser",
            hashed_password=hash_password("password123"),
            role="admin",
            is_active=True,
        )
        s.add(user)
        await s.commit()
        await s.refresh(user)
        return user


@pytest_asyncio.fixture(scope="session")
async def leitor_user(session_factory) -> User:
    async with session_factory() as s:
        user = User(
            id=uuid.uuid4(),
            email="leitor@example.com",
            username="leitoruser",
            hashed_password=hash_password("password123"),
            role="leitor",
            is_active=True,
        )
        s.add(user)
        await s.commit()
        await s.refresh(user)
        return user


@pytest_asyncio.fixture(scope="session")
async def editor_user(session_factory) -> User:
    async with session_factory() as s:
        user = User(
            id=uuid.uuid4(),
            email="editor@example.com",
            username="editoruser",
            hashed_password=hash_password("password123"),
            role="editor",
            is_active=True,
        )
        s.add(user)
        await s.commit()
        await s.refresh(user)
        return user


# ── Audit log fixture ─────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def audit_log(session_factory, test_user) -> AuditLog:
    async with session_factory() as s:
        log = AuditLog(
            entity_type="product",
            entity_id=uuid.uuid4(),
            action="CREATE",
            actor_id=test_user.id,
            payload={"nome": "Produto Auditado"},
        )
        s.add(log)
        await s.commit()
        await s.refresh(log)
        return log


# ── Mocks ─────────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_redis():
    return StatefulRedisMock()


@pytest.fixture
def mock_publisher():
    from unittest.mock import AsyncMock
    publisher = AsyncMock(spec=ProductEventPublisher)
    publisher.product_created = AsyncMock()
    publisher.product_updated = AsyncMock()
    publisher.product_deleted = AsyncMock()
    return publisher


# ── HTTP client with dependency overrides ─────────────────────────────────────

@pytest_asyncio.fixture
async def client(
    session: AsyncSession, mock_redis, mock_publisher
) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_session():
        yield session

    async def override_get_redis():
        return mock_redis

    async def fake_get_redis():
        return mock_redis

    def override_get_product_service():
        return ProductService(session, mock_publisher)

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_redis] = override_get_redis
    app.dependency_overrides[get_product_service] = override_get_product_service

    # notifications.py calls get_redis() directly (not via Depends), so we
    # patch the module-level reference as well to keep the same mock instance.
    with patch("app.routes.notifications.get_redis", new=fake_get_redis):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c

    app.dependency_overrides.clear()


# ── Auth helpers ──────────────────────────────────────────────────────────────
# Tokens are generated directly (no HTTP call) so these fixtures are
# session-scoped and don't hit the login rate limit during the test run.
# Tests that specifically exercise the login/refresh/logout HTTP flow
# (TestLogin, TestRefresh, TestLogout) call the endpoint themselves.

@pytest.fixture(scope="session")
def auth_headers(test_user: User) -> dict[str, str]:
    from app.core.security import create_access_token
    token = create_access_token(str(test_user.id), test_user.email, test_user.role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def leitor_auth_headers(leitor_user: User) -> dict[str, str]:
    from app.core.security import create_access_token
    token = create_access_token(str(leitor_user.id), leitor_user.email, leitor_user.role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def editor_auth_headers(editor_user: User) -> dict[str, str]:
    from app.core.security import create_access_token
    token = create_access_token(str(editor_user.id), editor_user.email, editor_user.role)
    return {"Authorization": f"Bearer {token}"}


# ── Product fixture ───────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def test_product(client: AsyncClient, auth_headers: dict) -> dict:
    resp = await client.post(
        "/api/v1/products/",
        json={
            "nome": "Produto Teste",
            "descricao": "Descrição de teste",
            "preco": 99.90,
            "quantidade": 10,
            "ativo": True,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()
