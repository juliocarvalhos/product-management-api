import uuid

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "admin@productmanager.dev",
                "password": "secret123",
            }
        }
    }


class TokenResponse(BaseModel):
    """Public token response — refresh token is delivered via HttpOnly cookie, not in the body."""
    access_token: str
    token_type: str = "bearer"

    model_config = {
        "json_schema_extra": {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
            }
        }
    }


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    role: str
    is_active: bool

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "email": "admin@productmanager.dev",
                "username": "admin",
                "role": "admin",
                "is_active": True,
            }
        },
    }
