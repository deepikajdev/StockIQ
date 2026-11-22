"""Application settings with production-only security validation.

Secrets are stored as ``SecretStr`` so they are masked in reprs and Pydantic
validation errors.  Development defaults remain available for local work, but
``ENVIRONMENT=production`` turns every one of them into a startup error.
"""

from __future__ import annotations

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

from .tls import (
    TLS_TRUE_VALUES,
    UNVERIFIED_TLS_MODES,
    VERIFIED_TLS_MODES,
    tls_query_options,
)

PRODUCTION_ENVIRONMENTS = {"production", "prod", "live"}
MIN_JWT_SECRET_LENGTH = 32

DEV_DATABASE_URL = "mysql+pymysql://stockiq:stockiq@localhost:3306/stockiq"
DEV_JWT_SECRET = "dev-only-change-me-minimum-32-chars-secret"
DEV_CORS_ORIGINS = "http://localhost:5173"

INSECURE_JWT_SECRETS = {
    DEV_JWT_SECRET,
    "change-me-to-a-long-random-string",
    "changeme",
    "secret",
    "password",
}
INSECURE_JWT_MARKERS = ("change-me", "changeme", "dev-only", "example", "password", "secret")

INSECURE_DB_USERNAMES = {"stockiq", "root", "admin", "test", "sa"}
INSECURE_DB_PASSWORDS = {
    "stockiq",
    "root",
    "admin",
    "password",
    "passwd",
    "changeme",
    "change-me",
    "secret",
    "test",
    "",
}
INSECURE_BOOTSTRAP_PASSWORDS = {
    "admin12345",
    "staff12345",
    "admin",
    "staff",
    "password",
    "passwd",
    "changeme",
    "change-me",
    "secret",
    "",
}

def is_production_environment(value: str | None) -> bool:
    """Return True for values that explicitly select a production profile."""
    return bool(value) and value.strip().lower() in PRODUCTION_ENVIRONMENTS


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    database_url: SecretStr = SecretStr(DEV_DATABASE_URL)
    jwt_secret: SecretStr = SecretStr(DEV_JWT_SECRET)
    jwt_expire_minutes: int = 480
    cors_origins: str = DEV_CORS_ORIGINS

    # Optional in dev; required in production by the validator below.
    admin_password: SecretStr | None = None
    staff_password: SecretStr | None = None

    # None means "derive from environment"; production defaults to disabled.
    docs_enabled: bool | None = None
    openapi_enabled: bool | None = None

    # Intelligence Engine tunables (rule-based analytics, not ML).
    lookback_days: int = 30
    review_period_days: int = 7
    min_history_days: int = 7

    @property
    def is_production(self) -> bool:
        return is_production_environment(self.environment)

    @property
    def database_url_value(self) -> str:
        return self.database_url.get_secret_value()

    @property
    def jwt_secret_value(self) -> str:
        return self.jwt_secret.get_secret_value()

    @field_validator("environment", mode="before")
    @classmethod
    def normalize_environment(cls, value: str | None) -> str:
        return (value or "development").strip().lower()

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        production = self.is_production

        if self.jwt_expire_minutes <= 0:
            raise ValueError("JWT_EXPIRE_MINUTES must be positive")

        self._validate_jwt_secret(production)
        self._validate_database_url(production)
        self._validate_cors(production)
        self._validate_bootstrap_passwords(production)

        if self.docs_enabled is None:
            self.docs_enabled = not production
        if self.openapi_enabled is None:
            self.openapi_enabled = not production

        return self

    def _validate_jwt_secret(self, production: bool) -> None:
        secret = self.jwt_secret_value
        if not production:
            return

        if len(secret) < MIN_JWT_SECRET_LENGTH:
            raise ValueError(
                f"JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} characters in production"
            )
        lowered = secret.lower()
        if (
            secret in INSECURE_JWT_SECRETS
            or any(marker in lowered for marker in INSECURE_JWT_MARKERS)
            or len(set(secret)) < 10
        ):
            raise ValueError(
                "JWT_SECRET is an unsafe development value and cannot be used in production"
            )

    def _validate_database_url(self, production: bool) -> None:
        raw = self.database_url_value
        try:
            url = make_url(raw)
        except Exception as exc:  # pragma: no cover - depends on SQLAlchemy error class
            raise ValueError("DATABASE_URL is not a valid SQLAlchemy URL") from exc

        if not production:
            return

        if not raw.strip() or raw == DEV_DATABASE_URL:
            raise ValueError("DATABASE_URL must be explicitly set in production")
        if url.get_backend_name() not in {"mysql", "mariadb"}:
            raise ValueError("Production DATABASE_URL must use MySQL or MariaDB")
        if not url.host or not url.database:
            raise ValueError("Production DATABASE_URL must include a host and database name")
        if not url.username or not url.password:
            raise ValueError("Production DATABASE_URL must include credentials")

        username = url.username.strip().lower()
        password = url.password.strip().lower()
        if (
            username in INSECURE_DB_USERNAMES
            or password in INSECURE_DB_PASSWORDS
            or username == password
        ):
            raise ValueError("DATABASE_URL uses default or unsafe credentials")
        self._validate_production_tls(url)

    def _validate_production_tls(self, url) -> None:
        """Require certificate-verified TLS for managed production MySQL.

        PyMySQL only checks hostnames when an explicit CA file or CA directory is
        supplied, so production requires one even when ``ssl_mode`` is present.
        """
        query = tls_query_options(url)

        def flag(name: str) -> str:
            return (query.get(name) or "").strip().lower()

        if flag("ssl_disabled") in TLS_TRUE_VALUES:
            raise ValueError("DATABASE_URL explicitly disables TLS")

        mode = flag("ssl_mode")
        if mode in UNVERIFIED_TLS_MODES:
            raise ValueError("DATABASE_URL uses an unverified TLS mode")
        if mode and mode not in VERIFIED_TLS_MODES:
            raise ValueError("DATABASE_URL uses an invalid TLS mode")

        for key, message in (
            ("ssl_verify_cert", "DATABASE_URL disables TLS certificate verification"),
            ("ssl_verify_identity", "DATABASE_URL disables TLS hostname verification"),
        ):
            if key in query and flag(key) not in TLS_TRUE_VALUES:
                raise ValueError(message)

        if not (query.get("ssl_ca") or query.get("ssl_capath")):
            raise ValueError(
                "DATABASE_URL must include ssl_ca or ssl_capath for verified TLS in production"
            )
        if not mode and flag("ssl_verify_cert") not in TLS_TRUE_VALUES:
            raise ValueError("DATABASE_URL must enable TLS certificate verification in production")

    def _validate_cors(self, production: bool) -> None:
        raw = (self.cors_origins or "").strip()
        origins = [origin.strip() for origin in raw.split(",") if origin.strip()]

        if production:
            if not raw or raw == DEV_CORS_ORIGINS:
                raise ValueError("CORS_ORIGINS must be explicitly set in production")
            if any(origin == "*" or "*" in origin for origin in origins):
                raise ValueError("Wildcard CORS origins are not allowed in production")
            if not origins:
                raise ValueError("CORS_ORIGINS must include at least one trusted origin")

    def _validate_bootstrap_passwords(self, production: bool) -> None:
        if not production:
            return

        for name, value in (
            ("ADMIN_PASSWORD", self.admin_password),
            ("STAFF_PASSWORD", self.staff_password),
        ):
            raw = value.get_secret_value() if value else ""
            if not raw:
                raise ValueError(f"{name} must be explicitly set in production")
            if raw.strip().lower() in INSECURE_BOOTSTRAP_PASSWORDS:
                raise ValueError(f"{name} is unsafe in production")


settings = Settings()
