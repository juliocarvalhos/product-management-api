from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response

from app.config import settings
from app.core.exceptions import CredentialsException
from app.core.limiter import limiter
from app.dependencies import CurrentUser, get_auth_service
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserResponse,
)
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])

_COOKIE_NAME = "refresh_token"
_COOKIE_PATH = "/api/v1/auth"
_COOKIE_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        max_age=_COOKIE_MAX_AGE,
        path=_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=_COOKIE_NAME, path=_COOKIE_PATH)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Autenticar usuário",
    description=(
        "Autentica com email e senha. Retorna o access token no corpo e define o "
        "refresh token como cookie HttpOnly."
    ),
)
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    tokens = await auth_service.login(body.email, body.password)
    _set_refresh_cookie(response, tokens.refresh_token)
    return TokenResponse(access_token=tokens.access_token)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renovar tokens",
    description=(
        "Troca o refresh token (enviado via cookie HttpOnly) por um novo par de tokens. "
        "O novo refresh token é definido como cookie e o access token retorna no corpo."
    ),
)
@limiter.limit("10/minute")
async def refresh(
    request: Request,
    response: Response,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    refresh_token: str | None = Cookie(default=None, alias=_COOKIE_NAME),
) -> TokenResponse:
    if not refresh_token:
        raise CredentialsException("Refresh token missing")
    tokens = await auth_service.refresh(refresh_token)
    _set_refresh_cookie(response, tokens.refresh_token)
    return TokenResponse(access_token=tokens.access_token)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Encerrar sessão",
    description="Invalida o refresh token (cookie HttpOnly) adicionando seu JTI à blacklist no Redis.",
)
async def logout(
    response: Response,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    _current_user: CurrentUser,
    refresh_token: str | None = Cookie(default=None, alias=_COOKIE_NAME),
) -> MessageResponse:
    if refresh_token:
        await auth_service.logout(refresh_token)
    _clear_refresh_cookie(response)
    return MessageResponse(message="Logged out successfully")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Usuário autenticado",
    description="Retorna os dados do usuário autenticado.",
)
async def me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)
