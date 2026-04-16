from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_SECRET_PREFIXES = ("change-me", "changeme", "insecure")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    # Connection URLs and secrets have no defaults: they must come from the
    # environment (.env locally, real env vars in deployed environments).

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # RabbitMQ
    RABBITMQ_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # App
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "Product Manager API"
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:4200", "http://localhost:3000"]

    # Cookie
    COOKIE_SECURE: bool = False  # set True in HTTPS production deployments
    COOKIE_SAMESITE: str = "lax"

    @model_validator(mode="after")
    def _check_production_secret(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            key = self.SECRET_KEY.lower()
            if len(self.SECRET_KEY) < 32 or key.startswith(_INSECURE_SECRET_PREFIXES):
                raise ValueError(
                    "SECRET_KEY is insecure for production: use at least 32 random "
                    "characters (e.g. `openssl rand -hex 32`)."
                )
        return self


settings = Settings()
