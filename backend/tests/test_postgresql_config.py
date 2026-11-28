"""PostgreSQL dialect configuration and TLS safety tests."""

import logging

import pytest
from pydantic import ValidationError

from app.config import DEV_DATABASE_URL, Settings
from app.db import database_connect_args, database_engine_url
from app.logging_config import RedactingFilter

SAFE_PG_URL_BASE = (
    "postgresql+psycopg://stockiq_app:Str0ng!Pass@db.internal.example.com:5432/stockiq"
)
SAFE_PG_URL = SAFE_PG_URL_BASE + "?sslmode=verify-full&sslrootcert=/etc/ssl/ca.pem"
SAFE_JWT_SECRET = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0"
SAFE_ADMIN_PASSWORD = "Adm!n-Str0ng-Passphrase-2026"
SAFE_STAFF_PASSWORD = "St4ff-Str0ng-Passphrase-2026"


@pytest.fixture()
def clean_env(monkeypatch):
    """Keep host process secrets out of direct Settings construction."""
    for name in (
        "ENVIRONMENT",
        "DATABASE_URL",
        "JWT_SECRET",
        "JWT_EXPIRE_MINUTES",
        "CORS_ORIGINS",
        "ADMIN_PASSWORD",
        "STAFF_PASSWORD",
        "DOCS_ENABLED",
        "OPENAPI_ENABLED",
    ):
        monkeypatch.delenv(name, raising=False)


def production_settings(**overrides) -> Settings:
    values = {
        "environment": "production",
        "database_url": SAFE_PG_URL,
        "jwt_secret": SAFE_JWT_SECRET,
        "cors_origins": "https://app.example.com",
        "admin_password": SAFE_ADMIN_PASSWORD,
        "staff_password": SAFE_STAFF_PASSWORD,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_development_default_remains_mysql(clean_env):
    settings = Settings(_env_file=None, environment="development")
    assert settings.database_url_value == DEV_DATABASE_URL


def test_production_accepts_postgresql_with_verified_tls(clean_env):
    settings = production_settings()
    assert settings.is_production is True
    assert settings.database_url_value == SAFE_PG_URL


def test_production_rejects_default_postgresql_credentials(clean_env):
    with pytest.raises(ValidationError, match="default or unsafe credentials"):
        production_settings(
            database_url=(
                "postgresql+psycopg://postgres:postgres@db.internal.example.com:5432/stockiq"
                "?sslmode=verify-full&sslrootcert=/etc/ssl/ca.pem"
            )
        )


def test_production_requires_postgresql_sslmode(clean_env):
    with pytest.raises(ValidationError, match="must include sslmode"):
        production_settings(database_url=SAFE_PG_URL_BASE)


def test_production_rejects_unverified_postgresql_modes(clean_env):
    for mode in ("disable", "allow", "prefer", "require"):
        with pytest.raises(ValidationError, match="unverified TLS mode"):
            production_settings(
                database_url=(
                    SAFE_PG_URL_BASE + f"?sslmode={mode}&sslrootcert=/etc/ssl/ca.pem"
                )
            )


def test_production_rejects_invalid_postgresql_tls_mode(clean_env):
    with pytest.raises(ValidationError, match="invalid TLS mode"):
        production_settings(
            database_url=(
                SAFE_PG_URL_BASE + "?sslmode=bogus&sslrootcert=/etc/ssl/ca.pem"
            )
        )


def test_production_requires_postgresql_root_certificate(clean_env):
    with pytest.raises(ValidationError, match="must include sslrootcert"):
        production_settings(database_url=SAFE_PG_URL_BASE + "?sslmode=verify-full")


def test_production_accepts_postgresql_verify_ca(clean_env):
    settings = production_settings(
        database_url=(
            SAFE_PG_URL_BASE + "?sslmode=verify-ca&sslrootcert=/etc/ssl/ca.pem"
        )
    )
    assert settings.is_production is True


def test_production_requires_client_cert_and_key_together(clean_env):
    with pytest.raises(ValidationError, match="both sslcert and sslkey together"):
        production_settings(
            database_url=(
                SAFE_PG_URL_BASE
                + "?sslmode=verify-full&sslrootcert=/etc/ssl/ca.pem"
                + "&sslcert=/etc/ssl/client.pem"
            )
        )


def test_production_rejects_unsupported_dialect(clean_env):
    with pytest.raises(ValidationError, match="MySQL, MariaDB, or PostgreSQL"):
        production_settings(database_url="sqlite:///stockiq.db")


def test_postgresql_tls_options_are_forwarded_without_url_query():
    url = (
        "postgresql+psycopg://app:Str0ng!Pass@db.example.com:5432/stockiq"
        "?SSLMODE=VERIFY-FULL&SSLROOTCERT=/etc/ssl/ca.pem&application_name=stockiq"
    )
    assert database_connect_args(url) == {
        "sslmode": "verify-full",
        "sslrootcert": "/etc/ssl/ca.pem",
    }

    engine_url = database_engine_url(url)
    assert "sslmode" not in engine_url.query
    assert "SSLROOTCERT" not in engine_url.query
    assert engine_url.query["application_name"] == "stockiq"


def test_mysql_tls_arguments_remain_unchanged():
    url = (
        "mysql+pymysql://app:Str0ng!Pass@db.example.com:3306/stockiq"
        "?ssl_ca=/etc/ssl/ca.pem&ssl_mode=VERIFY_IDENTITY"
    )
    assert database_connect_args(url) == {
        "ssl": {
            "ca": "/etc/ssl/ca.pem",
            "verify_mode": True,
            "check_hostname": True,
        }
    }


def test_log_redaction_masks_postgresql_credentials():
    record = logging.LogRecord(
        "stockiq",
        logging.INFO,
        __file__,
        1,
        "postgresql+psycopg://user:password@host:5432/db",
        (),
        None,
    )
    assert RedactingFilter().filter(record) is True
    message = record.getMessage()
    assert "password@host" not in message
    assert "***REDACTED***" in message
