"""Tests for the pytest database safety guard."""

import pytest
from pydantic import SecretStr

from tests import db_guard
from tests.db_guard import CONFIRMATION_ENV, validate_test_database_url

LOCAL_TEST_URL = "mysql+pymysql://tester:secret@127.0.0.1:3307/stockiq_test"
LOCAL_POSTGRES_TEST_URL = (
    "postgresql+psycopg://tester:placeholder@127.0.0.1:5432/stockiq_pg_test"
)


def test_accepts_explicit_local_test_database():
    assert validate_test_database_url(LOCAL_TEST_URL, "stockiq_test") == "stockiq_test"
    assert (
        validate_test_database_url(
            "mysql+pymysql://tester:secret@localhost:3306/test_stockiq", "test_stockiq"
        )
        == "test_stockiq"
    )


def test_accepts_explicit_local_postgresql_test_database():
    assert validate_test_database_url(LOCAL_POSTGRES_TEST_URL, "stockiq_pg_test") == (
        "stockiq_pg_test"
    )
    assert (
        validate_test_database_url(
            "postgresql+psycopg://tester:placeholder@localhost:5432/stockiq_pg_test",
            "stockiq_pg_test",
        )
        == "stockiq_pg_test"
    )


def test_rejects_wrong_postgresql_database_name():
    wrong = "postgresql+psycopg://tester:placeholder@127.0.0.1:5432/stockiq_test"
    with pytest.raises(RuntimeError, match="Expected exactly"):
        validate_test_database_url(wrong, "stockiq_test")


def test_rejects_missing_postgresql_confirmation():
    with pytest.raises(RuntimeError, match="STOCKIQ_TEST_DB"):
        validate_test_database_url(LOCAL_POSTGRES_TEST_URL, None)


def test_rejects_remote_postgresql_host_without_explicit_override():
    remote = "postgresql+psycopg://tester:placeholder@db.example.com:5432/stockiq_pg_test"
    with pytest.raises(RuntimeError, match="remote host"):
        validate_test_database_url(remote, "stockiq_pg_test")
    assert (
        validate_test_database_url(remote, "stockiq_pg_test", allow_remote=True)
        == "stockiq_pg_test"
    )


def test_rejects_missing_database_url():
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        validate_test_database_url(None, "stockiq_test")
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        validate_test_database_url("   ", "stockiq_test")


def test_rejects_production_database_name():
    with pytest.raises(RuntimeError, match="unsafe database"):
        validate_test_database_url(
            "mysql+pymysql://tester:secret@127.0.0.1:3306/stockiq", "stockiq"
        )
    with pytest.raises(RuntimeError, match="unsafe database"):
        validate_test_database_url(
            "mysql+pymysql://tester:secret@127.0.0.1:3306/stockiq_prod", "stockiq_prod"
        )


def test_rejects_missing_or_mismatched_confirmation():
    with pytest.raises(RuntimeError, match="STOCKIQ_TEST_DB"):
        validate_test_database_url(LOCAL_TEST_URL, None)
    with pytest.raises(RuntimeError, match="does not match"):
        validate_test_database_url(LOCAL_TEST_URL, "other_test")


def test_rejects_remote_host_without_explicit_override():
    remote = "mysql+pymysql://tester:secret@db.example.com:3306/stockiq_test"
    with pytest.raises(RuntimeError, match="remote host"):
        validate_test_database_url(remote, "stockiq_test")
    assert (
        validate_test_database_url(remote, "stockiq_test", allow_remote=True)
        == "stockiq_test"
    )


def test_rejects_unsupported_dialect():
    with pytest.raises(RuntimeError, match="MySQL/MariaDB or PostgreSQL"):
        validate_test_database_url("sqlite:///stockiq_test.db", "stockiq_test")


def test_rejects_ambiguous_test_like_names():
    with pytest.raises(RuntimeError, match="unsafe database"):
        validate_test_database_url(
            "mysql+pymysql://tester:secret@127.0.0.1:3306/stockiq_test_backup",
            "stockiq_test_backup",
        )


def test_enforce_checks_effective_application_settings(monkeypatch):
    """The guard must inspect the URL used by app.config, not a second parser."""
    from app.config import settings

    monkeypatch.setattr(settings, "database_url", SecretStr(LOCAL_TEST_URL))
    monkeypatch.setattr(
        db_guard,
        "get_env_value",
        lambda name: "stockiq_test" if name == CONFIRMATION_ENV else None,
    )
    assert db_guard.enforce_test_database() == "stockiq_test"

    monkeypatch.setattr(
        settings,
        "database_url",
        SecretStr("mysql+pymysql://stockiq:stockiq@localhost:3306/stockiq"),
    )
    with pytest.raises(RuntimeError, match="unsafe database"):
        db_guard.enforce_test_database()


def test_enforce_checks_postgresql_application_settings(monkeypatch):
    """The guard must accept the dedicated PostgreSQL test database."""
    from app.config import settings

    monkeypatch.setattr(settings, "database_url", SecretStr(LOCAL_POSTGRES_TEST_URL))
    monkeypatch.setattr(
        db_guard,
        "get_env_value",
        lambda name: "stockiq_pg_test" if name == CONFIRMATION_ENV else None,
    )
    assert db_guard.enforce_test_database() == "stockiq_pg_test"
