"""Fail-fast guard that keeps pytest away from non-test databases.

The stock workflow tests call ``scripts.bootstrap.run()`` through the real
application engine, so an accidentally configured ``DATABASE_URL`` can create
and mutate data in a production database.  This module validates the target
before ``app.main`` is imported and the engine is constructed.

A target is accepted only when all of the following are true:

* ``DATABASE_URL`` is present and parseable.
* The dialect is MySQL/MariaDB.
* The host is local (remote targets require an explicit override).
* The database name is explicitly test-shaped, e.g. ``stockiq_test`` or
  ``test_stockiq``.
* ``STOCKIQ_TEST_DB`` exactly matches the database name.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

from sqlalchemy.engine import make_url

CONFIRMATION_ENV = "STOCKIQ_TEST_DB"
REMOTE_OVERRIDE_ENV = "STOCKIQ_TEST_DB_ALLOW_REMOTE"

TEST_DB_PATTERN = re.compile(
    r"^(?:test_[a-z0-9_]+|[a-z0-9]+_test|[a-z0-9]+_tests)$", re.IGNORECASE
)
FORBIDDEN_DB_NAMES = {
    "stockiq",
    "stockiq_prod",
    "stockiq_production",
    "production",
    "prod",
    "live",
    "main",
    "master",
}
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
TRUTHY_VALUES = {"1", "true", "yes", "on"}


def _env_files() -> list[Path]:
    """Candidate .env files, current working directory first."""
    backend_dir = Path(__file__).resolve().parents[1]
    repo_dir = backend_dir.parent
    candidates = [Path.cwd() / ".env", backend_dir / ".env", repo_dir / ".env"]
    unique: list[Path] = []
    for path in candidates:
        if path not in unique:
            unique.append(path)
    return unique


def get_env_value(name: str) -> str | None:
    """Read a value from the OS environment or a local .env file.

    OS environment variables take precedence, matching Pydantic BaseSettings.
    """
    if name in os.environ:
        return os.environ[name]

    for path in _env_files():
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            if key.strip() == name:
                return value.strip().strip('"').strip("'")
    return None


def is_truthy(value: str | None) -> bool:
    return bool(value) and value.strip().lower() in TRUTHY_VALUES


def validate_test_database_url(
    database_url: str | None,
    confirmed_name: str | None,
    *,
    allow_remote: bool = False,
) -> str:
    """Return the validated database name or raise ``RuntimeError``."""
    if not database_url or not database_url.strip():
        raise RuntimeError(
            "pytest requires DATABASE_URL to point at an explicitly named local test database."
        )

    try:
        url = make_url(database_url)
    except Exception as exc:  # pragma: no cover - depends on SQLAlchemy error class
        raise RuntimeError("DATABASE_URL is not a valid SQLAlchemy URL.") from exc

    dialect = url.get_backend_name()
    if dialect not in {"mysql", "mariadb"}:
        raise RuntimeError(
            f"pytest requires a MySQL/MariaDB test database, got dialect {dialect!r}."
        )

    host = (url.host or "").strip().lower()
    if not host:
        raise RuntimeError("DATABASE_URL must include a host for the test database.")
    if host not in LOCAL_HOSTS and not allow_remote:
        raise RuntimeError(
            f"Refusing to run tests against remote host {host!r}. "
            f"Set {REMOTE_OVERRIDE_ENV}=true only for a deliberately isolated remote test DB."
        )

    name = (url.database or "").strip()
    if not name:
        raise RuntimeError("DATABASE_URL must explicitly name a test database.")
    if name.lower() in FORBIDDEN_DB_NAMES or not TEST_DB_PATTERN.fullmatch(name):
        raise RuntimeError(
            f"Refusing to run tests against unsafe database {name!r}. "
            "Expected an explicit test name such as 'stockiq_test' or 'test_stockiq'."
        )

    expected = (confirmed_name or "").strip()
    if not expected:
        raise RuntimeError(
            f"Set {CONFIRMATION_ENV} to the exact test database name before running tests."
        )
    if expected.lower() != name.lower():
        raise RuntimeError(
            f"{CONFIRMATION_ENV}={expected!r} does not match DATABASE_URL database {name!r}."
        )

    return name


def enforce_test_database() -> str:
    """Validate the exact URL that the application settings will use.

    Importing ``app.config`` does not create the SQLAlchemy engine, so this can
    safely run before ``app.main`` is imported.  Reading ``settings`` rather
    than re-parsing ``DATABASE_URL`` here prevents a working-directory change
    from letting the guard validate one URL while the app connects to another.
    """
    from app.config import settings

    return validate_test_database_url(
        settings.database_url_value,
        get_env_value(CONFIRMATION_ENV),
        allow_remote=is_truthy(get_env_value(REMOTE_OVERRIDE_ENV)),
    )
