from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://bagaggio:changeme@localhost:5432/bagaggio"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # RabbitMQ
    RABBITMQ_URL: str = "amqp://bagaggio:changeme@localhost:5672/"

    # Security
    SECRET_KEY: str = "insecure-dev-secret-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # App
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "Bagaggio API"
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:4200", "http://localhost:3000"]

    # Cookie
    COOKIE_SECURE: bool = False  # set True in HTTPS production deployments
    COOKIE_SAMESITE: str = "lax"


settings = Settings()
