"""Application configuration via pydantic-settings.

All settings are loaded from environment variables.
Fails fast on missing required config.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from env vars / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "Ki Clash"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ki_clash"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    jwt_refresh_token_expire_minutes: int = 60 * 24 * 30  # 30 days

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Stripe (optional — payment features disabled if not set)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_ad_free_price_id: str = ""

    # Observability — Sentry (optional — error tracking disabled if no DSN)
    sentry_dsn: str = ""
    environment: str = "development"  # development | staging | production
    sentry_traces_sample_rate: float = 0.1  # 10% of requests sampled for perf


settings = Settings()
