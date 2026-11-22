"""Production configuration and logging security tests."""

import logging

import pytest
from pydantic import ValidationError

from app.config import (
    DEV_CORS_ORIGINS,
    DEV_DATABASE_URL,
    DEV_JWT_SECRET,
    Settings,
)
from app.db import database_connect_args, database_engine_url
from app.logging_config import JsonFormatter, RedactingFilter

SAFE_DB_URL_BASE = "mysql+pymysql://stockiq_app:Str0ng!Pass@db.internal.example.com:3306/stockiq"
SAFE_DB_URL = SAFE_DB_URL_BASE + "?ssl_mode=VERIFY_IDENTITY&ssl_ca=/etc/ssl/ca.pem"
SAFE_JWT_SECRET = "k7Qx2Lm9Pv4Nz8Rc1Tg6Wy3Bd5Hj0FsA1b2C3d4"
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
        "database_url": SAFE_DB_URL,
        "jwt_secret": SAFE_JWT_SECRET,
        "cors_origins": "https://app.example.com",
        "admin_password": SAFE_ADMIN_PASSWORD,
        "staff_password": SAFE_STAFF_PASSWORD,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_development_defaults_remain_convenient(clean_env):
    settings = Settings(_env_file=None, environment="development")
    assert settings.is_production is False
    assert settings.database_url_value == DEV_DATABASE_URL
    assert settings.jwt_secret_value == DEV_JWT_SECRET
    assert settings.docs_enabled is True
    assert settings.openapi_enabled is True


def test_production_requires_explicit_database_url():
    with pytest.raises(ValidationError, match="explicitly set"):
        production_settings(database_url=DEV_DATABASE_URL)
    with pytest.raises(ValidationError, match="not a valid SQLAlchemy URL"):
        production_settings(database_url="   ")


def test_production_rejects_default_database_credentials():
    with pytest.raises(ValidationError, match="default or unsafe credentials"):
        production_settings(
            database_url="mysql+pymysql://stockiq:stockiq@db.internal.example.com:3306/stockiq"
        )
    with pytest.raises(ValidationError, match="default or unsafe credentials"):
        production_settings(
            database_url="mysql+pymysql://root:root@db.internal.example.com:3306/stockiq"
        )


def test_production_requires_verified_tls():
    with pytest.raises(ValidationError, match="verified TLS"):
        production_settings(database_url=SAFE_DB_URL_BASE)
    with pytest.raises(ValidationError, match="explicitly disables TLS"):
        production_settings(database_url=SAFE_DB_URL_BASE + "?ssl_disabled=true")
    with pytest.raises(ValidationError, match="ssl_ca or ssl_capath"):
        production_settings(database_url=SAFE_DB_URL_BASE + "?ssl_mode=VERIFY_IDENTITY")


def test_production_rejects_invalid_tls_mode():
    with pytest.raises(ValidationError, match="invalid TLS mode"):
        production_settings(
            database_url=SAFE_DB_URL_BASE + "?ssl_mode=BOGUS&ssl_ca=/etc/ssl/ca.pem"
        )


def test_production_accepts_uppercase_tls_query_keys():
    settings = production_settings(
        database_url=SAFE_DB_URL_BASE
        + "?SSL_MODE=VERIFY_IDENTITY&SSL_CA=/etc/ssl/ca.pem"
    )
    assert settings.is_production is True


def test_production_rejects_unverified_tls_modes():
    for mode in ("DISABLED", "PREFERRED", "REQUIRED"):
        with pytest.raises(ValidationError, match="unverified TLS mode"):
            production_settings(database_url=SAFE_DB_URL_BASE + f"?ssl_mode={mode}")


def test_production_rejects_disabled_verification_flags():
    with pytest.raises(ValidationError, match="certificate verification"):
        production_settings(
            database_url=SAFE_DB_URL_BASE + "?ssl_ca=/etc/ssl/ca.pem&ssl_verify_cert=false"
        )
    with pytest.raises(ValidationError, match="hostname verification"):
        production_settings(
            database_url=SAFE_DB_URL_BASE
            + "?ssl_mode=VERIFY_IDENTITY&ssl_verify_identity=false"
        )


def test_production_accepts_explicit_ca_verification():
    settings = production_settings(
        database_url=SAFE_DB_URL_BASE
        + "?ssl_ca=/etc/ssl/ca.pem&ssl_verify_cert=true"
    )
    assert settings.is_production is True


def test_production_requires_strong_jwt_secret():
    with pytest.raises(ValidationError, match="at least 32 characters"):
        production_settings(jwt_secret="short")
    with pytest.raises(ValidationError, match="unsafe development value"):
        production_settings(jwt_secret=DEV_JWT_SECRET)
    with pytest.raises(ValidationError, match="unsafe development value"):
        production_settings(jwt_secret="change-me-to-a-long-random-string-1234567890")


def test_jwt_validation_errors_do_not_expose_secret_value():
    with pytest.raises(ValidationError) as exc_info:
        production_settings(jwt_secret="SensitiveShortValue")
    assert "SensitiveShortValue" not in str(exc_info.value)


def test_production_rejects_wildcard_and_default_cors():
    with pytest.raises(ValidationError, match="Wildcard CORS"):
        production_settings(cors_origins="*")
    with pytest.raises(ValidationError, match="Wildcard CORS"):
        production_settings(cors_origins="https://app.example.com, *")
    with pytest.raises(ValidationError, match="CORS_ORIGINS must be explicitly set"):
        production_settings(cors_origins=DEV_CORS_ORIGINS)


def test_production_requires_safe_bootstrap_passwords():
    with pytest.raises(ValidationError, match="ADMIN_PASSWORD must be explicitly set"):
        production_settings(admin_password=None)
    with pytest.raises(ValidationError, match="ADMIN_PASSWORD is unsafe"):
        production_settings(admin_password="admin12345")
    with pytest.raises(ValidationError, match="STAFF_PASSWORD is unsafe"):
        production_settings(staff_password="staff12345")


def test_production_docs_disabled_unless_explicitly_enabled():
    settings = production_settings()
    assert settings.docs_enabled is False
    assert settings.openapi_enabled is False

    enabled = production_settings(docs_enabled=True, openapi_enabled=True)
    assert enabled.docs_enabled is True
    assert enabled.openapi_enabled is True


def test_database_tls_options_are_forwarded_without_url_query():
    url = (
        "mysql+pymysql://app:Str0ng!Pass@db.example.com:3306/stockiq"
        "?SSL_CA=/etc/ssl/ca.pem&SSL_MODE=VERIFY_IDENTITY&charset=utf8mb4"
    )
    assert database_connect_args(url) == {
        "ssl": {
            "ca": "/etc/ssl/ca.pem",
            "verify_mode": True,
            "check_hostname": True,
        }
    }

    engine_url = database_engine_url(url)
    assert "ssl_ca" not in engine_url.query
    assert "SSL_MODE" not in engine_url.query
    assert engine_url.query["charset"] == "utf8mb4"


def test_database_tls_capath_and_verify_ca_are_supported():
    url = (
        "mysql+pymysql://app:Str0ng!Pass@db.example.com:3306/stockiq"
        "?ssl_capath=/etc/ssl/certs&ssl_mode=VERIFY_CA"
    )
    assert database_connect_args(url) == {
        "ssl": {
            "capath": "/etc/ssl/certs",
            "verify_mode": True,
            "check_hostname": False,
        }
    }


def test_log_redaction_masks_secrets():
    record = logging.LogRecord(
        "stockiq",
        logging.INFO,
        __file__,
        1,
        "DATABASE_URL=mysql+pymysql://user:password@host/db Bearer abc123 password=hunter2",
        (),
        None,
    )
    assert RedactingFilter().filter(record) is True

    message = record.getMessage()
    assert "password@host" not in message
    assert "abc123" not in message
    assert "hunter2" not in message
    assert "***REDACTED***" in message

    rendered = JsonFormatter().format(record)
    assert "hunter2" not in rendered
    assert "abc123" not in rendered
