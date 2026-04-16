import uuid
from dataclasses import dataclass

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import CredentialsException, TokenExpiredException
from app.core.security import (
    burn_password_check,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_token_remaining_seconds,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repository import UserRepository

_BLACKLIST_PREFIX = "blacklist:jti:"


@dataclass
class _IssuedTokens:
    access_token: str
    refresh_token: str


class AuthService:
    def __init__(self, session: AsyncSession, redis: Redis) -> None:
        self.session = session
        self.redis = redis
        self.user_repo = UserRepository(session)

    async def login(self, email: str, password: str) -> _IssuedTokens:
        user = await self.user_repo.get_by_email(email)
        if not user:
            burn_password_check(password)  # constant-time: avoid user enumeration
            raise CredentialsException("Invalid email or password")
        if not verify_password(password, user.hashed_password):
            raise CredentialsException("Invalid email or password")
        if not user.is_active:
            raise CredentialsException("Inactive user")
        return await self._issue_tokens(user)

    async def refresh(self, refresh_token: str) -> _IssuedTokens:
        payload = decode_token(refresh_token)

        # Fix 4: distinguish expired from invalid
        if payload.get("_expired"):
            raise TokenExpiredException()
        if not payload or payload.get("type") != "refresh":
            raise CredentialsException("Invalid refresh token")

        jti: str = payload.get("jti", "")
        exp: int = payload.get("exp", 0)

        if not jti or not exp:
            raise CredentialsException()

        if await self.redis.get(f"{_BLACKLIST_PREFIX}{jti}"):
            raise CredentialsException("Token has been revoked")

        try:
            user_id = uuid.UUID(payload["sub"])
        except (ValueError, KeyError):
            raise CredentialsException()
        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise CredentialsException("User not found or inactive")

        # Invalidate old refresh token
        remaining = get_token_remaining_seconds(exp)
        await self.redis.setex(f"{_BLACKLIST_PREFIX}{jti}", remaining, "1")

        return await self._issue_tokens(user)

    async def logout(self, refresh_token: str) -> None:
        payload = decode_token(refresh_token)
        if not payload or payload.get("_expired") or payload.get("type") != "refresh":
            return
        jti: str = payload.get("jti", "")
        exp: int = payload.get("exp", 0)
        if jti and exp:
            remaining = get_token_remaining_seconds(exp)
            if remaining > 0:
                await self.redis.setex(f"{_BLACKLIST_PREFIX}{jti}", remaining, "1")

    async def get_current_user(self, access_token: str) -> User:
        payload = decode_token(access_token)

        # Fix 4: distinguish expired from invalid
        if payload.get("_expired"):
            raise TokenExpiredException()
        if not payload or payload.get("type") != "access":
            raise CredentialsException()

        try:
            user_id = uuid.UUID(payload["sub"])
        except (ValueError, KeyError):
            raise CredentialsException()
        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise CredentialsException("User not found")
        return user

    async def _issue_tokens(self, user: User) -> _IssuedTokens:
        access = create_access_token(str(user.id), user.email, user.role)
        refresh, _ = create_refresh_token(str(user.id))
        return _IssuedTokens(access_token=access, refresh_token=refresh)

    @staticmethod
    def hash_password(plain: str) -> str:
        return hash_password(plain)
