import os

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "Satsway API"
    app_version: str = "0.1.0"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./satsway.db")
    auth_token_secret: str = os.getenv("AUTH_TOKEN_SECRET", "dev-change-me")
    cors_origins: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    celery_broker_url: str = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
    celery_result_backend: str = os.getenv("CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/1")
    stripe_secret_key: str = os.getenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
    stripe_webhook_secret: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    river_api_base_url: str = os.getenv("RIVER_API_BASE_URL", "https://api.rls.dev")
    river_api_key: str = os.getenv("RIVER_API_KEY", "")
    river_account_id: str = os.getenv("RIVER_ACCOUNT_ID", "")
    river_webhook_secret: str = os.getenv("RIVER_WEBHOOK_SECRET", "")
    frontend_success_url: str = os.getenv("FRONTEND_SUCCESS_URL", "http://localhost:3000")
    frontend_cancel_url: str = os.getenv("FRONTEND_CANCEL_URL", "http://localhost:3000")
    coingecko_api_base_url: str = os.getenv("COINGECKO_API_BASE_URL", "https://api.coingecko.com/api/v3")
    coingecko_api_key: str = os.getenv("COINGECKO_API_KEY", "")
    grid_api_token_id: str = os.getenv("GRID_API_TOKEN_ID", "")
    grid_api_client_secret: str = os.getenv("GRID_API_CLIENT_SECRET", "")
    grid_sandbox_links_enabled: bool = os.getenv("GRID_SANDBOX_LINKS_ENABLED", "false").lower() == "true"
    grid_sandbox_demo_access_code: str = os.getenv("GRID_SANDBOX_DEMO_ACCESS_CODE", "")

    @property
    def allowed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def uses_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")

    @property
    def stripe_configured(self) -> bool:
        return self.stripe_secret_key.startswith("sk_") and self.stripe_secret_key != "sk_test_placeholder"

    @property
    def stripe_webhook_configured(self) -> bool:
        return self.stripe_webhook_secret.startswith("whsec_")

    @property
    def river_configured(self) -> bool:
        return bool(self.river_api_key and self.river_account_id and self.river_webhook_secret)


settings = Settings()
