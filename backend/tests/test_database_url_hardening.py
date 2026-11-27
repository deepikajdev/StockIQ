"""Database URL normalization and parsed-URL regression tests."""

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.db import database_engine_url

MYSQL_URL = (
    "mysql+pymysql://app:Str0ng!Pass@db.example.com:3306/stockiq"
    "?application_name=stockiq"
)
SAFE_PG_URL = (
    "postgresql+psycopg://stockiq_app:Str0ng!Pass@db.internal.example.com:5432/stockiq"
    "?sslmode=verify-full&sslrootcert=/etc/ssl/ca.pem"
)
SAFE_JWT_SECRET = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0"
SAFE_ADMIN_PASSWORD = "Adm!n-Str0ng-Passphrase-2026"
SAFE_STAFF_PASSWORD = "St4ff-Str0ng-Passphrase-2026"


@pytest.fixture()
def clean_env(monkeypatch):
    for name in ("DATABASE_URL", "ENVIRONMENT", "STOCKIQ_TEST_DB"):
        monkeypatch.delenv(name, raising=False)


def test_database_url_outer_whitespace_is_trimmed(clean_env):
    settings = Settings(
        _env_file=None,
        environment="development",
        database_url=f"  {MYSQL_URL}  ",
    )

    assert settings.database_url_value == MYSQL_URL


def test_database_url_control_characters_are_rejected(clean_env):
    with pytest.raises(ValidationError, match="control characters"):
        Settings(
            _env_file=None,
            environment="development",
            database_url=MYSQL_URL + "\nunexpected",
        )


def test_parsed_url_keeps_password_available_without_stringifying_it(clean_env):
    settings = Settings(_env_file=None, environment="development", database_url=MYSQL_URL)
    url = settings.database_url_object

    assert url.password == "Str0ng!Pass"
    assert url.database == "stockiq"
    assert "Str0ng!Pass" not in str(url)


def test_engine_url_helpers_accept_the_parsed_settings_url(clean_env):
    settings = Settings(_env_file=None, environment="development", database_url=MYSQL_URL)

    engine_url = database_engine_url(settings.database_url_object)

    assert engine_url.query["application_name"] == "stockiq"
    assert engine_url.password == "Str0ng!Pass"


def test_production_accepts_trimmed_postgresql_url(clean_env):
    settings = Settings(
        _env_file=None,
        environment="production",
        database_url=f"\t{SAFE_PG_URL}\n",
        jwt_secret=SAFE_JWT_SECRET,
        cors_origins="https://app.example.com",
        admin_password=SAFE_ADMIN_PASSWORD,
        staff_password=SAFE_STAFF_PASSWORD,
    )

    assert settings.database_url_value == SAFE_PG_URL
