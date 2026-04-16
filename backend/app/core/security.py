import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
    except ValueError:
        return False


# Hash computed once at import time. Used to spend the same bcrypt time when the
# e-mail does not exist, so login response time does not reveal registered users.
_DUMMY_HASH = hash_password(uuid.uuid4().hex)


def burn_password_check(plain_password: str) -> None:
    verify_password(plain_password, _DUMMY_HASH)


def _create_token(data: dict, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {**data, "exp": now + expires_delta, "iat": now}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: str, email: str, role: str = "leitor") -> str:
    return _create_token(
        {"sub": user_id, "email": email, "role": role, "type": "access"},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: str) -> tuple[str, str]:
    jti = str(uuid.uuid4())
    token = _create_token(
        {"sub": user_id, "jti": jti, "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return token, jti


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.ExpiredSignatureError:
        return {"_expired": True}
    except jwt.InvalidTokenError:
        return {}


def get_token_remaining_seconds(exp: int) -> int:
    remaining = exp - int(datetime.now(timezone.utc).timestamp())
    return max(remaining, 0)
