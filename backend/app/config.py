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
    image_storage_provider: str = "local"  # local | cloudinary
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    payout_provider: str = "manual"  # manual | razorpayx
    payout_hold_hours: int = 36  # time after fulfilment before a payout becomes eligible
    payout_max_paise: int = 1_000_000  # per-payout cap (exception if above)
    payout_seller_daily_cap_paise: int = 2_000_000
    payout_platform_daily_cap_paise: int = 50_000_000  # circuit breaker
    payout_new_seller_days: int = 14  # extra scrutiny for sellers approved more recently than this
    payout_upi_change_cooldown_days: int = 3  # extra scrutiny if UPI id changed more recently than this
    payout_max_attempts: int = 3  # failures before a payout needs manual review

    google_client_id: str = ""
    google_client_secret: str = ""
    session_secret: str = "dev-only-session-secret-change-me-0123456789"  # SessionMiddleware (OAuth state/nonce only)
    totp_issuer: str = "Campus Artisan Marketplace"
    mfa_pending_minutes: int = 5
    admin_access_token_minutes: int = 10  # shorter-lived session for admin accounts
    admin_2fa_attempt_limit: str = "10/15 minutes"

    access_token_minutes: int = 15
    refresh_token_days: int = 14
    order_expiry_minutes: int = 30
    rate_limit_enabled: bool = True
    background_tasks_enabled: bool = True
    # Off while the project is only run locally (no email provider yet). Must be on in production.
    require_email_verification: bool = False

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
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def email_domains(self) -> list[str]:
        return [d.strip().lower().lstrip("@") for d in self.allowed_email_domains.split(",") if d.strip()]

    def check_startup(self) -> None:
        """Refuse unsafe configurations. Called when the app starts."""
        if self.payment_mode not in ("mock", "razorpay"):
            raise RuntimeError("PAYMENT_MODE must be 'mock' or 'razorpay'")
        if self.is_production and self.payment_mode == "mock":
            raise RuntimeError("PAYMENT_MODE=mock is not allowed when ENVIRONMENT=production")
        if self.is_production and not self.require_email_verification:
            raise RuntimeError("REQUIRE_EMAIL_VERIFICATION must be true when ENVIRONMENT=production")
        if self.is_production and self.jwt_secret.startswith("dev-only"):
            raise RuntimeError("Set a real JWT_SECRET in production")
        if self.is_production and self.google_client_id and self.session_secret.startswith("dev-only"):
            raise RuntimeError("Set a real SESSION_SECRET in production")
        if bool(self.google_client_id) != bool(self.google_client_secret):
            raise RuntimeError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together")
        if self.payout_provider not in ("manual", "razorpayx"):
            raise RuntimeError("PAYOUT_PROVIDER must be 'manual' or 'razorpayx'")
        if self.payment_mode == "razorpay" and not (
            self.razorpay_key_id and self.razorpay_key_secret and self.razorpay_webhook_secret
        ):
            raise RuntimeError("Razorpay keys and webhook secret are required when PAYMENT_MODE=razorpay")
        if self.image_storage_provider not in ("local", "cloudinary"):
            raise RuntimeError("IMAGE_STORAGE_PROVIDER must be 'local' or 'cloudinary'")
        if self.image_storage_provider == "cloudinary" and not (
            self.cloudinary_cloud_name and self.cloudinary_api_key and self.cloudinary_api_secret
        ):
            raise RuntimeError("Cloudinary credentials are required when IMAGE_STORAGE_PROVIDER=cloudinary")


@lru_cache
def get_settings() -> Settings:
    return Settings()
