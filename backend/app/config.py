from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"  # development | test | production
    database_url: str = "postgresql+psycopg://artisan:artisan@localhost:5432/artisan"
    jwt_secret: str = "dev-only-change-me-dev-only-change-me-0123456789"
    frontend_url: str = "http://localhost:5173"
    public_api_url: str = "http://localhost:8000"
    allowed_email_domains: str = ""  # comma-separated; empty = open signup
    commission_rate: float = 0.10  # seed value for app_config
    payment_mode: str = "mock"  # mock | razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    resend_api_key: str = ""
    email_from: str = "Campus Artisans <onboarding@resend.dev>"
    upload_dir: str = "uploads"

    access_token_minutes: int = 15
    refresh_token_days: int = 14
    order_expiry_minutes: int = 30
    rate_limit_enabled: bool = True
    background_tasks_enabled: bool = True

    @field_validator("jwt_secret")
    @classmethod
    def _secret_long_enough(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return v

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def email_domains(self) -> list[str]:
        return [d.strip().lower().lstrip("@") for d in self.allowed_email_domains.split(",") if d.strip()]

    def check_startup(self) -> None:
        """Refuse unsafe configurations. Called when the app starts."""
        if self.payment_mode not in ("mock", "razorpay"):
            raise RuntimeError("PAYMENT_MODE must be 'mock' or 'razorpay'")
        if self.is_production and self.payment_mode == "mock":
            raise RuntimeError("PAYMENT_MODE=mock is not allowed when ENVIRONMENT=production")
        if self.is_production and self.jwt_secret.startswith("dev-only"):
            raise RuntimeError("Set a real JWT_SECRET in production")
        if self.payment_mode == "razorpay" and not (
            self.razorpay_key_id and self.razorpay_key_secret and self.razorpay_webhook_secret
        ):
            raise RuntimeError("Razorpay keys and webhook secret are required when PAYMENT_MODE=razorpay")


@lru_cache
def get_settings() -> Settings:
    return Settings()
